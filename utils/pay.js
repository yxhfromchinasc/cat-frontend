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
  const deadline = new Date(expireTimeIso).getTime()
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
 * 主流程：创建 → 支付 → 轮询
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
    const order = await createOrder(amount)
    
    try {
      await requestPayment(order.param)
    } catch (err) {
      // 用户取消或拉起失败
      if (err && err.errMsg && err.errMsg.includes('cancel')) {
        wx.showToast({ 
          title: '支付已取消', 
          icon: 'none',
          duration: 2000
        })
        return { success: false, cancelled: true, orderNo: order.orderNo }
      } else {
        wx.showToast({ 
          title: '支付未完成，请重试', 
          icon: 'none',
          duration: 2000
        })
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


