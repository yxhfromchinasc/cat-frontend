// pages/address/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    addressList: [],
    loading: true
  },

  onShow() {
    this.loadAddressList()
  },

  async loadAddressList() {
    this.setData({ loading: true })
    try {
      const res = await api.getAddressList(1, 100)
      const list = res.success ? (res.data.list || []) : []
      this.setData({ addressList: list, loading: false })
    } catch (e) {
      this.setData({ addressList: [], loading: false })
    }
  },

  // 新增地址
  addAddress() {
    wx.navigateTo({ url: '/pages/address/edit' })
  },

  // 编辑地址
  editAddress(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/address/edit?id=${id}` })
  },

  // 导入微信地址
  async importWechatAddress() {
    try {
      wx.showLoading({ title: '获取地址中...' })
      const res = await wx.chooseAddress()
      if (res.errMsg === 'chooseAddress:ok') {
        // 映射微信字段到后端
        const data = {
          addressName: '微信地址',
          contactName: res.userName || '',
          contactPhone: res.telNumber || '',
          province: res.provinceName || '',
          city: res.cityName || '',
          district: res.countyName || '',
          street: res.streetName || '',
          detailAddress: res.detailInfo || '',
          postalCode: res.postalCode || '',
          isDefault: false,
          addressType: 1 // 家庭
        }
        await api.createAddress(data)
        this.loadAddressList()
      }
    } catch (e) {
      if (!(e && e.errMsg && e.errMsg.includes('cancel'))) {
        wx.showToast({ title: '导入失败', icon: 'none' })
      }
    } finally {
      wx.hideLoading()
    }
  },

  // 删除地址（预留）
  async deleteAddress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      success: async (res) => {
        if (res.confirm) {
          await api.deleteAddress(id)
          this.loadAddressList()
        }
      }
    })
  }
})
