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
    loading: true
  },

  onLoad() {
    this.loadBalance()
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
      console.error('加载余额失败:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 金额输入
  onAmountInput(e) {
    const val = e.detail.value.trim()
    const normalized = val.replace(/[^\d.]/g, '')
    const parts = normalized.split('.')
    let fixed = parts[0]
    if (parts.length > 1) {
      fixed += '.' + parts[1].slice(0, 2)
    }
    const num = Number(fixed)
    const valid = fixed !== '' && !isNaN(num) && num > 0
    const amountStr = valid ? amount.formatAmount(num) : '0.00'
    this.setData({ amount: fixed, amountStr, canSubmit: valid })
  },

  // 快捷选择金额
  onQuickPick(e) {
    const val = Number(e.currentTarget.dataset.val)
    const value = val.toFixed(2)
    const amountStr = amount.formatAmount(val)
    this.setData({ amount: value, amountStr, canSubmit: true })
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
      if (!res || !res.success || !res.data || !res.data.orderNo) {
        wx.showToast({ title: res?.message || '创建订单失败', icon: 'none' })
        return
      }
      const orderNo = res.data.orderNo
      
      // 跳转到提现订单详情页
      wx.navigateTo({ url: `/pages/withdraw-detail/index?orderNo=${orderNo}` })
    } catch (error) {
      console.error('创建提现订单失败:', error)
      wx.showToast({ title: '创建订单失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
