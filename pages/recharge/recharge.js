const { api } = require('../../utils/util.js')

Page({
  data: {
    amount: '',
    canSubmit: false,
    submitting: false
  },

  onShow() {},

  onAmountInput(e) {
    const val = e.detail.value.trim()
    // 只允许数字与小数点，且两位小数
    const normalized = val.replace(/[^\d.]/g, '')
    const parts = normalized.split('.')
    let fixed = parts[0]
    if (parts.length > 1) {
      fixed += '.' + parts[1].slice(0, 2)
    }
    const num = Number(fixed)
    const valid = fixed !== '' && !isNaN(num) && num > 0
    this.setData({ amount: fixed, canSubmit: valid })
  },

  async onPay() {
    if (!this.data.canSubmit) return
    if (this.data.submitting) return
    const amountNum = Number(this.data.amount)
    this.setData({ submitting: true })
    
    try {
      // 1) 创建充值订单
      const res = await api.createRecharge(amountNum)
      if (!res || !res.success || !res.data || !res.data.orderNo) {
        wx.showToast({ title: res?.message || '创建订单失败', icon: 'none' })
        return
      }
      const orderNo = res.data.orderNo
      // 2) 跳转统一支付页
      wx.navigateTo({ url: `/pages/payment/index?orderNo=${orderNo}` })
    } catch (error) {
      console.error('充值异常:', error)
    } finally {
      this.setData({ submitting: false })
    }
  }
  ,

  onQuickPick(e) {
    const val = Number(e.currentTarget.dataset.val)
    const value = val.toFixed(2)
    // 基础校验：>0 且两位小数
    const valid = val > 0 && Math.round(val * 100) === val * 100
    this.setData({ amount: value, canSubmit: valid })
  }
})


