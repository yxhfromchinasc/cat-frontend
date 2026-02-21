const api = require('./api.js')

/**
 * 5秒缓冲轮询查询订单提现进度
 * 后端返回转账参数后，无论确认收款组件回调是什么，都使用此方法进行5秒缓冲轮询
 * 每秒查询一次后端的提现进度，如果查询到 success 或 failed 则返回
 * 如果5秒内都是 withdrawing，则不做处理，让后端继续处理
 * 
 * @param {string} orderNo 订单号
 * @param {number} durationSeconds 轮询持续时间（秒），默认5秒
 * @param {object} pageInstance 页面实例（用于更新倒计时显示）
 */
function pollWithdrawProgress(orderNo, durationSeconds = 5, pageInstance = null) {
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
          showWithdrawLoading: true,
          withdrawLoadingCountdown: remainingSeconds
        })
      } else {
        // 回退到 wx.showLoading（不支持动态更新）
        wx.showLoading({ 
          title: `确认提现结果...`, 
          mask: true 
        })
      }
    }

    // 隐藏倒计时显示
    const hideCountdown = () => {
      if (pageInstance && typeof pageInstance.setData === 'function') {
        pageInstance.setData({
          showWithdrawLoading: false,
          withdrawLoadingCountdown: 0
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
        const res = await api.getWithdrawProgress(orderNo)
        const { success, data } = res || {}
        if (success && data) {
          const withdrawStatus = data.withdrawStatus
          
          if (withdrawStatus === 'success') {
            // 本次提现成功 - 立即停止轮询并返回
            isResolved = true
            if (pollTimer) clearInterval(pollTimer)
            if (countdownTimer) clearInterval(countdownTimer)
            hideCountdown()
            resolve({ finished: true, withdrawStatus: 'success', data })
            return
          } else if (withdrawStatus === 'failed') {
            // 本次提现失败 - 立即停止轮询并返回
            isResolved = true
            if (pollTimer) clearInterval(pollTimer)
            if (countdownTimer) clearInterval(countdownTimer)
            hideCountdown()
            resolve({ finished: true, withdrawStatus: 'failed', data })
            return
          }
          // withdrawStatus === 'pending' 或 withdrawStatus === 'withdrawing'，继续轮询
        }

        // 增加查询次数
        pollCount++
        
        // 如果达到最大轮询次数（5秒），停止轮询
        if (pollCount >= maxPolls) {
          isResolved = true
          if (pollTimer) clearInterval(pollTimer)
          if (countdownTimer) clearInterval(countdownTimer)
          hideCountdown()
          // 5秒内查询的全是 "提现中"，不做任何处理
          // 订单状态应该是 "提现中"，等待后端通过定时任务和回调更新状态
          resolve({ finished: true, withdrawStatus: 'withdrawing', data: null })
          return
        }
      } catch (error) {
        // 查询失败，记录日志但继续轮询
        console.error('查询提现状态失败')
        
        // 增加查询次数
        pollCount++
        
        // 如果达到最大轮询次数，停止轮询
        if (pollCount >= maxPolls) {
          isResolved = true
          if (pollTimer) clearInterval(pollTimer)
          if (countdownTimer) clearInterval(countdownTimer)
          hideCountdown()
          // 查询失败也不做处理，让后端通过定时任务处理
          resolve({ finished: true, withdrawStatus: 'unknown', data: null })
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

module.exports = {
  pollWithdrawProgress
}

