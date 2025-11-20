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
        // 构建完整地址字符串用于地理编码
        const fullAddress = [
          res.provinceName || '',
          res.cityName || '',
          res.countyName || '',
          res.streetName || '',
          res.detailInfo || ''
        ].filter(Boolean).join('')
        
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
        
        // 尝试通过地理编码获取经纬度
        if (fullAddress) {
          try {
            wx.showLoading({ title: '获取位置信息...' })
            const geoRes = await api.geocode(fullAddress)
            if (geoRes.success && geoRes.data) {
              data.latitude = geoRes.data.latitude
              data.longitude = geoRes.data.longitude
              console.log('地理编码成功，获取到经纬度:', data.latitude, data.longitude)
            } else {
              console.warn('地理编码失败，继续保存地址（无经纬度）:', geoRes.message)
            }
          } catch (geoError) {
            console.error('地理编码异常，继续保存地址（无经纬度）:', geoError)
            // 地理编码失败不影响地址保存，继续执行
          }
        }
        
        await api.createAddress(data)
        wx.showToast({ title: '导入成功', icon: 'success' })
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

})
