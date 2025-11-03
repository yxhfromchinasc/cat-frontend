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
 * 5秒缓冲轮询查询订单支付进度
 * 后端返回支付参数后，无论支付组件回调是什么，都使用此方法进行5秒缓冲轮询
 * 每秒查询一次后端的支付进度，如果查询到 success 或 failed 则返回
 * 如果5秒内都是 paying，则不做处理，让后端继续处理
 * 
 * @param {string} orderNo 订单号
 * @param {number} durationSeconds 轮询持续时间（秒），默认5秒
 */
function pollPaymentProgress(orderNo, durationSeconds = 5, pageInstance = null) {
  return new Promise((resolve) => {
    let pollCount = 0
    const maxPolls = durationSeconds // 每秒查询一次
    const pollInterval = 1000 // 1秒
    let pollTimer = null
    let countdownTimer = null
    let isResolved = false // 标记是否已解决（成功或失败）

    // 更新倒计时显示（如果有页面实例，使用 setData；否则使用 wx.showLoading）
    const updateCountdown = (remainingSeconds) => {
      if (isResolved) return // 如果已经解决，不再更新
      
      if (pageInstance && typeof pageInstance.setData === 'function') {
        // 使用页面 setData 更新倒计时
        pageInstance.setData({
          showPaymentLoading: true,
          paymentLoadingCountdown: remainingSeconds
        })
      } else {
        // 回退到 wx.showLoading（不支持动态更新）
        wx.showLoading({ 
          title: `确认支付结果...`, 
          mask: true 
        })
      }
    }

    // 隐藏倒计时显示
    const hideCountdown = () => {
      if (pageInstance && typeof pageInstance.setData === 'function') {
        pageInstance.setData({
          showPaymentLoading: false,
          paymentLoadingCountdown: 0
        })
      } else {
        wx.hideLoading()
      }
    }

    // 独立的倒计时定时器（每秒更新一次显示）
    let countdown = maxPolls
    const startCountdown = () => {
      // 立即显示第一次
      updateCountdown(countdown)
      
      countdownTimer = setInterval(() => {
        if (isResolved) {
          clearInterval(countdownTimer)
          return
        }
        countdown--
        if (countdown > 0) {
          updateCountdown(countdown)
        } else {
          clearInterval(countdownTimer)
          hideCountdown()
        }
      }, 1000) // 每秒更新一次倒计时
    }

    // 立即显示第一次加载提示（显示剩余秒数）
    startCountdown()

    // 执行查询的函数
    const executeQuery = async () => {
      try {
        // 已在进入倒计时前做过一次 refresh，这里仅查询本地进度即可
        const res = await api.getPaymentProgress(orderNo)
        const { success, data } = res || {}
        if (success && data) {
          const paymentStatus = data.paymentStatus
          
          if (paymentStatus === 'success') {
            // 本次支付成功 - 立即停止轮询并返回
            isResolved = true
            if (pollTimer) clearInterval(pollTimer)
            if (countdownTimer) clearInterval(countdownTimer)
            hideCountdown()
            resolve({ finished: true, paymentStatus: 'success', data })
            return
          } else if (paymentStatus === 'failed') {
            // 本次支付失败 - 立即停止轮询并返回
            isResolved = true
            if (pollTimer) clearInterval(pollTimer)
            if (countdownTimer) clearInterval(countdownTimer)
            hideCountdown()
            resolve({ finished: true, paymentStatus: 'failed', data })
            return
          }
          // paymentStatus === 'pending' 或 paymentStatus === 'paying'，继续轮询
        }

        // 增加查询次数
        pollCount++
        
        // 如果达到最大轮询次数（5秒），停止轮询
        if (pollCount >= maxPolls) {
          isResolved = true
          if (pollTimer) clearInterval(pollTimer)
          if (countdownTimer) clearInterval(countdownTimer)
          hideCountdown()
          // 5秒内查询的全是 "支付中"，不做任何处理
          // 订单状态应该是 "支付中"，等待后端通过定时任务和回调更新状态
          resolve({ finished: true, paymentStatus: 'paying', data: null })
          return
        }
      } catch (error) {
        // 查询失败，记录日志但继续轮询
        console.error(`第${pollCount + 1}次查询支付状态失败:`, error)
        
        // 增加查询次数
        pollCount++
        
        // 如果达到最大轮询次数，停止轮询
        if (pollCount >= maxPolls) {
          isResolved = true
          if (pollTimer) clearInterval(pollTimer)
          if (countdownTimer) clearInterval(countdownTimer)
          hideCountdown()
          // 查询失败也不做处理，让后端通过定时任务处理
          resolve({ finished: true, paymentStatus: 'unknown', data: null })
          return
        }
      }
    }

    // 立即执行第一次查询
    executeQuery()

    // 然后每秒执行一次
    pollTimer = setInterval(executeQuery, pollInterval)
  })
}

/**
 * 轮询查询订单支付进度（长轮询，直到最终状态或超时）
 * 最终状态：success（支付成功）, failed（支付失败）
 * 中间状态（继续轮询）：pending（待支付）, paying（支付中）
 * 
 * @deprecated 建议使用 pollPaymentProgress 进行5秒缓冲轮询
 */
function pollStatus(orderNo, expireTimeIso) {
  const deadline = new Date(expireTimeIso || Date.now() + 15*60*1000).getTime()
  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      const now = Date.now()
      
      if (now > deadline) {
        clearInterval(timer)
        resolve({ finished: true, paymentStatus: 'EXPIRED' })
        return
      }
      try {
        const res = await api.getPaymentProgress(orderNo)
        const { success, data } = res || {}
        if (success && data) {
          const paymentStatus = data.paymentStatus
          // 最终状态：success（支付成功）, failed（支付失败）
          // 中间状态（继续轮询）：pending（待支付）, paying（支付中）
          if (paymentStatus === 'success' || paymentStatus === 'failed') {
            clearInterval(timer)
            resolve({ finished: true, paymentStatus: paymentStatus, data })
          }
          // 状态为 pending 或 paying 时继续轮询
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

    // 隐藏之前的 loading，准备进入轮询流程（轮询会显示带倒计时的 loading）
    api.hideLoadingToast()

    // 调起微信支付
    let paymentResult = null
    try {
      await requestPayment(payResp.data.paymentParams)
      // 支付调起成功，进入5秒缓冲轮询
      paymentResult = 'success'
    } catch (err) {
      // 支付组件回调失败
      console.log('微信支付组件回调:', err)
      
      // 检查是否是用户取消
      const isUserCancel = err && err.errMsg && err.errMsg.includes('cancel')
      
      if (isUserCancel) {
        // 用户主动取消，立即查询一次支付状态（不延迟）
        // 因为支付成功后关闭也可能触发 cancel，需要确认
        try {
          const progressRes = await api.getPaymentProgress(order.orderNo)
          
          if (progressRes && progressRes.success && progressRes.data) {
            const paymentStatus = progressRes.data.paymentStatus
            
            if (paymentStatus === 'success') {
              // 支付成功（支付成功后关闭也可能触发 cancel）
              api.showSuccess('充值成功')
              return { success: true, orderNo: order.orderNo }
            } else if (paymentStatus === 'failed') {
              // 支付失败
              wx.showToast({ title: '支付失败', icon: 'none' })
              return { success: false, orderNo: order.orderNo }
            } else {
              // paymentStatus === 'pending' 或 'paying'
              // 等待2秒后再查询一次（确认是否支付成功）
              await new Promise(resolve => setTimeout(resolve, 2000))
              
              const secondProgressRes = await api.getPaymentProgress(order.orderNo)
              if (secondProgressRes && secondProgressRes.success && secondProgressRes.data) {
                const secondPaymentStatus = secondProgressRes.data.paymentStatus
                
                if (secondPaymentStatus === 'success') {
                  // 支付成功
                  api.showSuccess('充值成功')
                  return { success: true, orderNo: order.orderNo }
                } else if (secondPaymentStatus === 'failed') {
                  // 支付失败
                  wx.showToast({ title: '支付失败', icon: 'none' })
                  return { success: false, orderNo: order.orderNo }
                }
              }
              
              // 两次查询都是 pending 或 paying，说明用户确实取消了
              // 不等待5秒缓冲轮询，直接返回
              // 后端定时任务会处理订单状态
              wx.showToast({ title: '已取消支付', icon: 'none', duration: 2000 })
              return { success: false, cancelled: true, orderNo: order.orderNo }
            }
          }
        } catch (e) {
          // 查询失败，进入5秒缓冲轮询（兜底）
          console.error('查询支付状态失败:', e)
          paymentResult = 'error'
        }
      } else {
        // 其他错误（非用户取消），进入5秒缓冲轮询
        paymentResult = 'error'
      }
    }
    
    // 如果是支付成功或其他错误，先进行一次快速确认（refresh + progress），再决定是否进入5秒缓冲轮询
    if (paymentResult === 'success' || paymentResult === 'error') {
      try { await api.refreshPaymentStatus(order.orderNo) } catch (_) {}
      try {
        const quick = await api.getPaymentProgress(order.orderNo)
        if (quick && quick.success && quick.data) {
          const st = quick.data.paymentStatus
          if (st === 'success') {
            api.showSuccess('充值成功')
            return { success: true, orderNo: order.orderNo }
          } else if (st === 'failed') {
            wx.showToast({ title: '支付失败', icon: 'none' })
            return { success: false, orderNo: order.orderNo }
          }
        }
      } catch (_) { /* 忽略，进入缓冲轮询 */ }

      // 获取当前页面实例（如果有）
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      
      // 进入5秒缓冲轮询流程（倒计时覆盖层）
      const result = await pollPaymentProgress(order.orderNo, 5, currentPage)
      if (result.paymentStatus === 'success') {
        api.showSuccess('充值成功')
        return { success: true, orderNo: order.orderNo }
      } else if (result.paymentStatus === 'failed') {
        wx.showToast({ title: '支付失败', icon: 'none' })
        return { success: false, orderNo: order.orderNo }
      } else {
        wx.showToast({ title: '支付处理中，请稍后查看', icon: 'none', duration: 2000 })
        return { success: false, orderNo: order.orderNo }
      }
    }
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
  pollPaymentProgress,
  requestPayment,
  isPaying,
  setPaying,
  isValidAmount
}


