// pages/withdraw-operate/index.js - 提现操作页（类似支付页，支持发起提现和继续提现）
const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')

Page({
  data: {
    orderNo: '',
    withdrawDetail: null, // 提现详情（从后端获取）
    continueMode: false, // 是否继续提现模式
    
    // 金额信息
    amount: 0,
    amountStr: '0.00',
    actualAmount: 0,
    actualAmountStr: '0.00',
    feeStr: '0.00',
    
    // 转账过期时间倒计时
    transferExpireTime: null,
    transferRemainSeconds: 0,
    transferRemainStr: '',
    
    submitting: false,
    loading: true
  },

  onLoad(options) {
    const orderNo = options?.orderNo || ''
    if (!orderNo) {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    this.setData({ orderNo })
    this.loadWithdrawDetail()
  },

  onShow() {
    // 每次显示时刷新订单详情
    if (this.data.orderNo) {
      this.loadWithdrawDetail()
    }
  },

  onUnload() {
    // 清理倒计时
    this.clearTransferRemainCountdown()
  },

  // 加载提现详情
  async loadWithdrawDetail() {
    const { orderNo } = this.data
    try {
      wx.showLoading({ title: '加载中...' })
      const res = await api.getWithdrawDetail(orderNo)
      
      if (res && res.success && res.data) {
        const detail = res.data
        const amt = amount.parseBigDecimalLike(detail.amount, 0)
        const actAmt = amount.parseBigDecimalLike(detail.actualAmount != null ? detail.actualAmount : detail.amount, 0)
        const fee = amount.parseBigDecimalLike(detail.fee, 0)
        
        // 从后端获取 continueMode 和 transferExpireTime
        const continueMode = detail.continueMode === true
        const transferExpireTime = detail.transferExpireTime || null
        
        this.setData({
          withdrawDetail: detail,
          continueMode,
          transferExpireTime,
          amount: amt,
          amountStr: amount.formatAmount(amt),
          actualAmount: actAmt,
          actualAmountStr: amount.formatAmount(actAmt),
          feeStr: amount.formatAmount(fee),
          loading: false
        })
        
        // 如果是继续提现模式，启动倒计时
        if (continueMode && transferExpireTime) {
          this.startTransferRemainCountdown(transferExpireTime)
        }
      } else {
        wx.showToast({ title: res?.message || '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('获取提现订单详情失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    } finally {
      wx.hideLoading()
    }
  },

  // 启动转账剩余时间倒计时
  startTransferRemainCountdown(expireTimeStr) {
    this.clearTransferRemainCountdown()
    
    const updateCountdown = () => {
      try {
        const expireTime = new Date(expireTimeStr.replace(/-/g, '/'))
        const now = new Date()
        const diff = Math.floor((expireTime - now) / 1000)
        
        if (diff <= 0) {
          this.setData({ transferRemainSeconds: 0, transferRemainStr: '已过期' })
          this.clearTransferRemainCountdown()
          return
        }
        
        const minutes = Math.floor(diff / 60)
        const seconds = diff % 60
        const remainStr = `${minutes}分${seconds}秒`
        
        this.setData({ transferRemainSeconds: diff, transferRemainStr: remainStr })
      } catch (e) {
        console.error('计算剩余时间失败', e)
        this.clearTransferRemainCountdown()
      }
    }
    
    updateCountdown()
    this._transferRemainTimer = setInterval(updateCountdown, 1000)
  },

  // 清理转账剩余时间倒计时
  clearTransferRemainCountdown() {
    if (this._transferRemainTimer) {
      clearInterval(this._transferRemainTimer)
      this._transferRemainTimer = null
    }
  },

  // 调起确认收款页面（商家转账升级版）
  async requestUserConfirmReceipt(packageInfoStr) {
    return new Promise((resolve, reject) => {
      try {
        if (!packageInfoStr || typeof packageInfoStr !== 'string') {
          reject(new Error('确认收款参数无效'))
          return
        }

        wx.openBusinessView({
          businessType: 'transferConfirm',
          queryString: 'package=' + encodeURIComponent(packageInfoStr),
          success: (res) => {
            console.log('调起确认收款成功:', res)
            resolve(res)
          },
          fail: (err) => {
            console.error('调起确认收款失败:', err)
            if (err && err.errMsg && (err.errMsg.includes('cancel') || err.errMsg.includes('取消'))) {
              reject({ cancelled: true, errMsg: err.errMsg })
            } else {
              reject(new Error(err.errMsg || '调起确认收款失败'))
            }
          }
        })
      } catch (e) {
        console.error('调起确认收款异常:', e)
        reject(e)
      }
    })
  },

  // 发起提现：调起确认收款页面
  async onWithdraw() {
    if (this.data.continueMode) {
      // 继续提现模式：调起确认收款页面
      await this.handleContinueWithdraw()
    } else {
      // 发起提现模式：发起转账申请
      await this.handleInitiateWithdraw()
    }
  },

  // 发起提现：发起转账申请
  async handleInitiateWithdraw() {
    if (this.data.submitting) return
    
    const { orderNo } = this.data
    
    if (!orderNo) {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      api.showLoadingToast('发起转账...')
      
      // 发起转账申请（调用第三方API获取packageInfo）
      const initiateRes = await api.initiateWithdraw(orderNo)
      
      if (!initiateRes.success || !initiateRes.data) {
        throw new Error(initiateRes.message || initiateRes.error || '发起转账申请失败')
      }
      
      const { packageInfo } = initiateRes.data
      
      if (!packageInfo) {
        throw new Error('未获取到确认收款参数')
      }
      
      api.hideLoadingToast()
      
      // 调起确认收款页面
      try {
        await this.requestUserConfirmReceipt(packageInfo)
        
        // 确认收款成功，显示成功提示
        wx.showToast({ title: '提现申请已提交', icon: 'success' })
        
        // 延迟返回详情页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        
      } catch (receiptError) {
        // 用户取消确认收款
        if (receiptError.cancelled) {
          wx.showToast({ title: '已取消确认收款', icon: 'none' })
        } else {
          wx.showToast({ 
            title: receiptError.message || '确认收款失败', 
            icon: 'none',
            duration: 3000
          })
        }
      }
    } catch (error) {
      api.hideLoadingToast()
      console.error('发起提现失败:', error)
      const errorMessage = error.message || error.error || '发起提现失败，请稍后重试'
      wx.showToast({ 
        title: errorMessage, 
        icon: 'none',
        duration: 3000
      })
      this.setData({ submitting: false })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 继续提现：调起确认收款页面
  async handleContinueWithdraw() {
    if (this.data.submitting) return
    
    const { orderNo } = this.data
    
    if (!orderNo) {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      api.showLoadingToast('发起转账...')
      
      // 发起转账申请（如果有保存的参数且未过期，会直接返回；否则重新创建）
      const initiateRes = await api.initiateWithdraw(orderNo)
      
      if (!initiateRes.success || !initiateRes.data) {
        throw new Error(initiateRes.message || initiateRes.error || '发起转账申请失败')
      }
      
      const { packageInfo } = initiateRes.data
      
      if (!packageInfo) {
        throw new Error('未获取到确认收款参数')
      }
      
      api.hideLoadingToast()
      
      // 调起确认收款页面
      try {
        await this.requestUserConfirmReceipt(packageInfo)
        
        // 确认收款成功，显示成功提示
        wx.showToast({ title: '提现申请已提交', icon: 'success' })
        
        // 延迟返回详情页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        
      } catch (receiptError) {
        // 用户取消确认收款
        if (receiptError.cancelled) {
          wx.showToast({ title: '已取消确认收款', icon: 'none' })
        } else {
          wx.showToast({ 
            title: receiptError.message || '确认收款失败', 
            icon: 'none',
            duration: 3000
          })
        }
      }
    } catch (error) {
      api.hideLoadingToast()
      console.error('继续提现失败:', error)
      const errorMessage = error.message || error.error || '继续提现失败，请稍后重试'
      wx.showToast({ 
        title: errorMessage, 
        icon: 'none',
        duration: 3000
      })
      this.setData({ submitting: false })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 取消当次提现
  async onCancel() {
    const { orderNo } = this.data
    if (!orderNo) {
      wx.navigateBack()
      return
    }
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消本次提现吗？取消后可稍后重新提现。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '取消中...' })
          const cancelRes = await api.cancelTransfer(orderNo)
          wx.hideLoading()
          if (cancelRes && cancelRes.success) {
            wx.showToast({ title: '已取消本次提现', icon: 'success' })
            // 刷新订单详情
            this.loadWithdrawDetail()
          } else {
            wx.showToast({ title: cancelRes?.message || '取消失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          console.error('取消当次提现失败', e)
          wx.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    })
  }
})

