const { api } = require('../../utils/util.js')
const { requestPayment, pollPaymentProgress } = require('../../utils/pay.js')

Page({
  data: {
    orderNo: '',
    detail: {},
    paymentStatus: 'pending',
    paymentStatusDesc: '',
    showPaymentLoading: false,
    paymentLoadingCountdown: 0
  },

  onLoad(options) {
    const orderNo = options?.orderNo || ''
    this.setData({ orderNo })
    this.loadAll()
  },

  onShow() {
    if (this.data.orderNo) {
      this.refreshProgress()
    }
  },

  async loadAll() {
    await Promise.all([this.loadDetail(), this.refreshProgress()])
  },

  async loadDetail() {
    const { orderNo } = this.data
    try {
      const res = await api.getPaymentDetail(orderNo)
      if (res && res.success) {
        this.setData({ detail: res.data || {} })
      }
    } catch (e) {
      console.error('获取充值订单详情失败', e)
    }
  },

  async refreshProgress() {
    const { orderNo } = this.data
    try {
      const res = await api.getPaymentProgress(orderNo)
      if (res && res.success && res.data) {
        this.setData({
          paymentStatus: res.data.paymentStatus,
          paymentStatusDesc: res.data.paymentStatusDesc
        })
      }
    } catch (e) {
      console.error('获取支付进度失败', e)
    }
  },

  async handlePay() {
    const { orderNo, detail } = this.data
    try {
      wx.showLoading({ title: '拉起支付...' })
      // 直接跳转到通用支付页复用逻辑，或在此创建支付
      wx.hideLoading()
      wx.navigateTo({ url: `/pages/payment/index?orderNo=${orderNo}` })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '发起支付失败', icon: 'none' })
    }
  },

  async handleContinuePay() {
    const { orderNo } = this.data
    try {
      wx.showLoading({ title: '获取支付参数...' })
      const res = await api.continuePayment(orderNo)
      wx.hideLoading()

      if (res.success && res.data && res.data.paymentParams) {
        const paymentParams = res.data.paymentParams
        try {
          await requestPayment(paymentParams)
          const result = await pollPaymentProgress(orderNo, 5, this)
          // 根据结果刷新
          this.refreshProgress()
          this.loadDetail()
          if (result.finished) {
            if (result.paymentStatus === 'success') {
              wx.showToast({ title: '支付成功', icon: 'success' })
            } else if (result.paymentStatus === 'failed') {
              wx.showToast({ title: '支付失败', icon: 'none' })
            }
          }
        } catch (err) {
          console.error('调起支付失败', err)
          // 用户取消等，快速检查两次由 pay.js 逻辑处理，这里复用轮询
          const result = await pollPaymentProgress(orderNo, 5, this)
          this.refreshProgress()
          this.loadDetail()
        }
      } else {
        wx.showToast({ title: res.message || '获取支付参数失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '继续支付失败', icon: 'none' })
    }
  },

  async handleCancelPayment() {
    const { orderNo } = this.data
    wx.showModal({
      title: '确认取消支付',
      content: '取消后本次支付将终止，您可稍后重新支付。',
      success: async (r) => {
        if (!r.confirm) return
        try {
          wx.showLoading({ title: '取消中...' })
          const res = await api.cancelThirdPartyPayment(orderNo)
          wx.hideLoading()
          if (res && res.success) {
            wx.showToast({ title: '已取消本次支付', icon: 'success' })
            this.refreshProgress()
            this.loadDetail()
          } else {
            wx.showToast({ title: res?.message || '取消失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    })
  }
})

