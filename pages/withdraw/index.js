// pages/withdraw/index.js - 提现金额选择页（类似充值金额选择页）
const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')

Page({
  data: {
    amount: '',
    amountStr: '0.00',
    canSubmit: false,
    submitting: false,
    balance: null,
    balanceStr: '0.00',
    loading: true,
    withdrawAmounts: [], // 允许的提现金额列表
    allowFullWithdraw: false, // 是否允许全部提现
    isFullWithdraw: false // 是否选择了全部提现
  },

  onLoad() {
    this.loadBalance()
    this.loadWithdrawAmounts()
    this.loadAllowFullWithdraw()
  },

  onShow() {},

  // 加载余额
  async loadBalance() {
    try {
      const res = await api.get('/wallet/info', {}, { showSuccess: false })
      if (res.success && res.data) {
        const balanceNum = amount.parseBigDecimalLike(res.data.balance, 0)
        this.setData({ 
          balance: balanceNum,
          balanceStr: amount.formatAmount(balanceNum)
        })
      }
    } catch (e) {
      console.error('加载余额失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载提现金额配置
  async loadWithdrawAmounts() {
      const res = await api.getWithdrawAmounts()
      const amounts = JSON.parse(res.data)
      // 将金额转换为对象格式，方便在 wxml 中比较和显示
      const formattedAmounts = (amounts || []).map(amt => ({
        value: amt,
        display: amt.toFixed(2),
        key: amt.toFixed(2)
      }))
      this.setData({ withdrawAmounts: formattedAmounts })
  },

  // 加载是否允许全部提现配置
  async loadAllowFullWithdraw() {
    try {
      const res = await api.getAllowFullWithdraw()
      if (res && res.success && res.data) {
        const allowFullWithdraw = res.data === 'true' || res.data === true
        this.setData({ allowFullWithdraw })
      }
    } catch (e) {
      console.error('加载全部提现配置失败')
    }
  },

  // 已移除 onAmountInput 方法，用户只能从预设金额中选择

  // 快捷选择金额
  onQuickPick(e) {
    const val = Number(e.currentTarget.dataset.val)
    const value = val.toFixed(2)
    const amountStr = amount.formatAmount(val)
    // 从预设金额中选择，直接设置为有效
    // 检查是否是全部提现（金额等于余额）
    const balanceValue = this.data.balance ? Number(this.data.balance.toFixed(2)) : 0
    const selectedValue = Number(value)
    const isFullWithdraw = this.data.balance && balanceValue > 0 && selectedValue === balanceValue
    this.setData({ amount: value, amountStr, canSubmit: true, isFullWithdraw: !!isFullWithdraw })
  },

  // 全部提现
  onFullWithdraw() {
    const balanceNum = this.data.balance
    if (!balanceNum || balanceNum <= 0) {
      wx.showToast({ title: '余额不足', icon: 'none' })
      return
    }
    // 确保balanceNum是数字类型
    const balance = Number(balanceNum)
    const balanceValue = balance.toFixed(2)
    const balanceStr = amount.formatAmount(balance)
    this.setData({ 
      amount: balanceValue, 
      amountStr: balanceStr, 
      canSubmit: true,
      isFullWithdraw: true
    })
  },

  // 确认提现：创建订单并跳转到订单详情页
  async onWithdraw() {
    if (!this.data.canSubmit) return
    if (this.data.submitting) return
    
    const amountNum = Number(this.data.amount)
    
    // 检查余额
    if (this.data.balance && amountNum > this.data.balance) {
      wx.showToast({ title: '余额不足', icon: 'none' })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      // 创建提现订单（扣除余额，但不调用第三方）
      const res = await api.createWithdraw(amountNum)
      if (!res || !res.success) {
        // 检查是否是存在进行中订单的错误
        if (res && res.code === 2004 && res.data && res.data.orderNo) {
          const existingOrderNo = res.data.orderNo
          wx.showModal({
            title: '提示',
            content: '您已存在进行中的提现订单，是否跳转到该订单？',
            confirmText: '跳转',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 跳转到提现订单详情页
                wx.navigateTo({ url: `/pages/withdraw-detail/index?orderNo=${existingOrderNo}` })
              }
            }
          })
          return
        }
        // 优先显示后端返回的错误信息（message 或 error）
        const errorMsg = res?.message || res?.error || '创建订单失败'
        wx.showToast({ title: errorMsg, icon: 'none' })
        return
      }
      if (!res.data || !res.data.orderNo) {
        wx.showToast({ title: '创建订单失败', icon: 'none' })
        return
      }
      const orderNo = res.data.orderNo
      
      // 跳转到提现订单详情页
      wx.navigateTo({ url: `/pages/withdraw-detail/index?orderNo=${orderNo}` })
    } catch (error) {
      console.error('创建提现订单失败')
      // 检查是否是存在进行中订单的错误
      if (error && error.code === 2004 && error.data && error.data.orderNo) {
        const existingOrderNo = error.data.orderNo
        wx.showModal({
          title: '提示',
          content: '您已存在进行中的提现订单，是否跳转到该订单？',
          confirmText: '跳转',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 跳转到提现订单详情页
              wx.navigateTo({ url: `/pages/withdraw-detail/index?orderNo=${existingOrderNo}` })
            }
          }
        })
        return
      }
      // 优先显示后端返回的错误信息（message 或 error）
      const errorMsg = error?.message || error?.error || '创建订单失败，请重试'
      wx.showToast({ title: errorMsg, icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 分享给好友
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    const sharePath = app.getSharePath()
    const shareTitle = app.getShareTitle()
    const shareConfig = {
      title: shareTitle, // 使用配置的分享标题
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

})
