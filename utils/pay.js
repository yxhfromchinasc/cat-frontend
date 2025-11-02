const api = require('./api.js')

// 防重复点击：在一次支付流程中置位
let paying = false

function isPaying() {
  return paying
}

function setPaying(val) {
  paying = !!val
}

/**
 * 金额校验：正数，最多两位小数
 */
function isValidAmount(amount) {
  if (typeof amount !== 'number' || !isFinite(amount)) return false
  if (amount <= 0) return false
  // 最多两位小数
  return Math.round(amount * 100) === amount * 100
}

/**
 * 创建充值订单
 */
async function createOrder(amount) {
  const res = await api.createRecharge(amount)
  
  if (!res || !res.success || !res.data) {
    throw { code: res?.code || 400, message: res?.message || '创建订单失败' }
  }
  
  return res.data 
}

/**
 * 轮询查询订单状态（直到非待支付或超时）
 */
function pollStatus(orderNo, expireTimeIso) {
  const deadline = new Date(expireTimeIso || Date.now() + 15*60*1000).getTime()
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      const now = Date.now()
      
      if (now > deadline) {
        clearInterval(timer)
        resolve({ finished: true, status: 'EXPIRED' })
        return
      }
      try {
        const res = await api.getRechargeStatus(orderNo)
        const { success, data } = res || {}
        if (success && data && data.status !== 1) { // 1=PENDING
          clearInterval(timer)
          resolve({ finished: true, status: data.status, data })
        }
      } catch (error) {
        // 忽略瞬时错误，继续轮询
      }
    }, 2500)
  })
}

/**
 * 唤起支付
 */
function requestPayment(formData) {
  return new Promise((resolve, reject) => {
    try {
      const payParams = typeof formData === 'string' ? JSON.parse(formData) : formData
      
      // 验证小程序支付必要参数
      const requiredParams = ['timeStamp', 'nonceStr', 'package', 'signType', 'paySign']
      const missingParams = requiredParams.filter(param => !payParams[param])
      if (missingParams.length > 0) {
        reject(new Error(`小程序支付参数缺失: ${missingParams.join(', ')}`))
        return
      }
      
      // 检查package参数格式
      if (!payParams.package || !payParams.package.startsWith('prepay_id=')) {
        reject(new Error('package参数格式错误，应为prepay_id=xxx'))
        return
      }
      
      // 构建微信小程序支付的正确参数
      const finalPayParams = {
        timeStamp: String(payParams.timeStamp),
        nonceStr: payParams.nonceStr,
        package: payParams.package,
        signType: payParams.signType,
        paySign: payParams.paySign
      }
      
      wx.requestPayment({
        ...finalPayParams,
        success: () => resolve({ success: true }),
        fail: (err) => {
          console.error('微信支付失败:', err)
          reject(err)
        }
      })
    } catch (e) {
      console.error('支付参数解析失败:', e)
      reject(e)
    }
  })
}

/**
 * 主流程：创建 → 拉起支付 → 轮询
 */
async function pay(amount) {
  if (isPaying()) {
    wx.showToast({ title: '请勿重复操作', icon: 'none' })
    return { success: false, message: '重复操作' }
  }

  if (!isValidAmount(amount)) {
    wx.showToast({ title: '金额不合法', icon: 'none' })
    return { success: false, message: '金额不合法' }
  }

  setPaying(true)
  api.showLoadingToast('发起支付...')
  
  try {
    const order = await createOrder(amount) // 返回 { orderNo }

    // 调用后端 /pay/create 获取小程序支付参数
    const payResp = await api.createPayment(order.orderNo, 2)
    if (!payResp || !payResp.success || !payResp.data || !payResp.data.paymentParams) {
      throw new Error('获取支付参数失败')
    }

    try {
      await requestPayment(payResp.data.paymentParams)
    } catch (err) {
      // 用户取消或拉起失败
      if (err && err.errMsg && err.errMsg.includes('cancel')) {
        // 用户主动取消支付，但需要先确认订单状态
        // 因为支付成功后关闭组件也可能触发 cancel 回调
        try {
          wx.showLoading({ title: '确认支付结果...', mask: true })
          
          // 延迟 2 秒，等待微信回调处理完成
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // 查询订单状态，确认是否已经支付成功
          const statusRes = await api.getRechargeStatus(order.orderNo)
          wx.hideLoading()
          
          if (statusRes && statusRes.success && statusRes.data) {
            const status = statusRes.data.status
            
            if (status === 2) {
              // 订单已支付成功，不调用取消接口，直接返回成功
              wx.showToast({ title: '支付成功', icon: 'success', duration: 2000 })
              return { success: true, orderNo: order.orderNo }
            } else if (status === 3 || status === 4) {
              // 订单已失败或已取消，不需要再调用取消接口
              if (status === 3) {
                wx.showToast({ title: '支付失败', icon: 'none', duration: 2000 })
              } else {
                wx.showToast({ title: '订单已取消', icon: 'none', duration: 2000 })
              }
              return { success: false, cancelled: status === 4, orderNo: order.orderNo }
            } else {
              // 订单还在待支付状态（status === 1），调用取消接口
              try {
                wx.showLoading({ title: '取消支付中...', mask: true })
                const cancelRes = await api.cancelThirdPartyPayment(order.orderNo)
                wx.hideLoading()
                
                if (cancelRes && cancelRes.success) {
                  wx.showToast({ title: '已取消支付', icon: 'success', duration: 2000 })
                } else {
                  wx.showToast({ title: cancelRes?.message || '取消支付失败', icon: 'none', duration: 2000 })
                }
              } catch (cancelErr) {
                wx.hideLoading()
                console.error('取消支付接口调用失败:', cancelErr)
                wx.showToast({ title: '取消支付失败，请稍后查看', icon: 'none', duration: 2000 })
              }
              
              return { success: false, cancelled: true, orderNo: order.orderNo }
            }
          } else {
            // 查询订单状态失败，保守处理：不调用取消接口，继续轮询确认
            wx.showToast({ title: '支付结果确认中...', icon: 'none', duration: 2000 })
            // 继续轮询确认订单状态
            const result = await pollStatus(order.orderNo, order.expireTime)
            if (result.status === 2) {
              api.showSuccess('充值成功')
              return { success: true, orderNo: order.orderNo }
            }
            return { success: false, cancelled: true, orderNo: order.orderNo }
          }
        } catch (checkErr) {
          wx.hideLoading()
          console.error('查询订单状态失败:', checkErr)
          // 查询失败，保守处理：不调用取消接口，继续轮询确认
          wx.showToast({ title: '支付结果确认中...', icon: 'none', duration: 2000 })
          // 继续轮询确认订单状态
          const result = await pollStatus(order.orderNo, order.expireTime)
          if (result.status === 2) {
            api.showSuccess('充值成功')
            return { success: true, orderNo: order.orderNo }
          }
          return { success: false, cancelled: true, orderNo: order.orderNo }
        }
      } else {
        wx.showToast({ title: '支付未完成，请重试', icon: 'none', duration: 2000 })
        return { success: false, cancelled: false, orderNo: order.orderNo, error: err }
      }
    }

    const result = await pollStatus(order.orderNo, order.expireTime)
    
    if (result.status === 2) { // 2=PAID
      api.showSuccess('充值成功')
      return { success: true, orderNo: order.orderNo }
    } else if (result.status === 3) { // 3=FAILED
      wx.showToast({ title: '支付失败', icon: 'none' })
      return { success: false, orderNo: order.orderNo }
    } else if (result.status === 4) { // 4=CANCELLED
      wx.showToast({ title: '订单已取消', icon: 'none' })
      return { success: false, orderNo: order.orderNo }
    }
    wx.showToast({ title: '支付结果未确认，请稍后查看', icon: 'none' })
    return { success: false, orderNo: order.orderNo }
  } catch (e) {
    console.error('支付流程异常:', e)
    wx.showToast({ title: e?.message || '支付发起失败', icon: 'none' })
    return { success: false, message: e?.message }
  } finally {
    api.hideLoadingToast()
    setPaying(false)
  }
}

module.exports = {
  pay,
  createOrder,
  pollStatus,
  requestPayment,
  isPaying,
  setPaying,
  isValidAmount
}


