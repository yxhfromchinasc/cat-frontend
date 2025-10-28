// pages/orders/index.js
Page({
  data: {
    list: [],
    loading: true
  },
  onShow() {
    this.loadOrders()
  },
  async loadOrders() {
    this.setData({ loading: false, list: [] })
  }
})
