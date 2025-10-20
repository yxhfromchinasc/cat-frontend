const pay = require('../../utils/pay.js')

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
    if (this.data.submitting || pay.isPaying()) return
    const amountNum = Number(this.data.amount)
    this.setData({ submitting: true })
    
    try {
      const result = await pay.pay(amountNum)
      console.log('充值结果:', result)
      
      if (result.success) {
        // 支付成功，可以刷新余额或返回
        console.log('充值成功，订单号:', result.orderNo)
        // TODO: 刷新余额或返回首页
      } else if (result.cancelled) {
        // 用户取消支付，不需要特殊处理
        console.log('用户取消支付')
      } else {
        // 支付失败，显示错误信息
        console.log('支付失败:', result.message)
      }
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
    this.setData({ amount: value, canSubmit: pay.isValidAmount(val) })
  }
})


