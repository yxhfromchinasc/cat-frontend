const { api } = require('../../utils/util.js')

Page({
  data: {
    orderNo: '',
    detail: {},
    paymentStatus: 'pending',
    paymentStatusDesc: ''
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
    const { orderNo } = this.data
    wx.navigateTo({ url: `/pages/payment/index?orderNo=${orderNo}` })
  },

  async handleContinuePay() {
    const { orderNo } = this.data
    wx.navigateTo({ url: `/pages/payment/index?orderNo=${orderNo}` })
  }
})

