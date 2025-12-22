const { api } = require('../../utils/util.js')

Page({
  data: {
    amount: '',
    canSubmit: false,
    submitting: false,
    rechargeAmounts: [] // 允许的充值金额列表
  },

  onLoad() {
    this.loadRechargeAmounts()
  },

  onShow() {},

  // 已移除 onAmountInput 方法，用户只能从预设金额中选择

  async onPay() {
    if (!this.data.canSubmit) return
    if (this.data.submitting) return
    const amountNum = Number(this.data.amount)
    this.setData({ submitting: true })
    
    try {
      // 1) 创建充值订单
      const res = await api.createRecharge(amountNum)
      if (!res || !res.success) {
        // 检查是否是存在进行中订单的错误
        if (res && res.code === 2003 && res.data && res.data.orderNo) {
          const existingOrderNo = res.data.orderNo
          wx.showModal({
            title: '提示',
            content: '您已存在进行中的充值订单，是否跳转到该订单？',
            confirmText: '跳转',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 跳转到充值订单详情页
                wx.navigateTo({ url: `/pages/recharge-detail/index?orderNo=${existingOrderNo}` })
              }
            }
          })
          return
        }
        wx.showToast({ title: res?.message || '创建订单失败', icon: 'none' })
        return
      }
      if (!res.data || !res.data.orderNo) {
        wx.showToast({ title: '创建订单失败', icon: 'none' })
        return
      }
      const orderNo = res.data.orderNo
      // 2) 跳转统一支付页
      wx.navigateTo({ url: `/pages/payment/index?orderNo=${orderNo}` })
    } catch (error) {
      console.error('充值异常:', error)
      // 检查是否是存在进行中订单的错误
      if (error && error.code === 2003 && error.data && error.data.orderNo) {
        const existingOrderNo = error.data.orderNo
        wx.showModal({
          title: '提示',
          content: '您已存在进行中的充值订单，是否跳转到该订单？',
          confirmText: '跳转',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 跳转到充值订单详情页
              wx.navigateTo({ url: `/pages/recharge-detail/index?orderNo=${existingOrderNo}` })
            }
          }
        })
        return
      }
    } finally {
      this.setData({ submitting: false })
    }
  }
  ,

  onQuickPick(e) {
    const val = Number(e.currentTarget.dataset.val)
    const value = val.toFixed(2)
    // 从预设金额中选择，直接设置为有效
    const valid = val > 0
    this.setData({ amount: value, canSubmit: valid })
  },

  // 加载充值金额配置
  async loadRechargeAmounts() {
      const res = await api.getRechargeAmounts()
      if (res.success && res.data) {
          const amounts = JSON.parse(res.data)
          // 将金额转换为对象格式，方便在 wxml 中比较和显示
          const formattedAmounts = (amounts || []).map(amt => ({
            value: amt,
            display: amt.toFixed(2),
            key: amt.toFixed(2)
          }))
          this.setData({ rechargeAmounts: formattedAmounts })
      } else {
          // 如果获取失败，使用默认值
          const defaultAmounts = [1, 10, 50, 100]
          const formattedAmounts = defaultAmounts.map(amt => ({
            value: amt,
            display: amt.toFixed(2),
            key: amt.toFixed(2)
          }))
          this.setData({ rechargeAmounts: formattedAmounts })
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


