// pages/address/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    addressList: [],
    loading: true,
    editIcon: '' // 编辑图标 SVG data URI
  },

  onLoad() {
    // 将 SVG 转换为 data URI（参考 placeholder 页面的做法）
    const editSvg = encodeURIComponent(`
      <svg t="1763876511611" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <path d="M848 421.2c-16.6 0-30 13.4-30 30V770c0 38.6-31.4 70-70 70H272.1c-38.6 0-70-31.4-70-70V294.8c0-38.6 31.4-70 70-70h317.7c16.6 0 30-13.4 30-30s-13.4-30-30-30H272.1c-71.7 0-130.1 58.3-130.1 129.9v475.2c0 71.6 58.4 129.9 130.1 129.9h475.8c71.7 0 130.1-58.3 130.1-129.9V451.2c0-16.6-13.4-30-30-30z" fill="#666"></path>
        <path d="M443.7 572.5c11.7 11.7 30.8 11.7 42.4 0l383.4-383.4c11.7-11.7 11.7-30.8 0-42.4-11.7-11.7-30.8-11.7-42.4 0L443.7 530.1c-11.7 11.7-11.7 30.8 0 42.4z" fill="#666"></path>
      </svg>
    `)
    this.setData({ 
      editIcon: `data:image/svg+xml;charset=UTF-8,${editSvg}` 
    })
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
