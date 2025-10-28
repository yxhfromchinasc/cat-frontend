// pages/address/edit.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    id: null,
    name: '',
    phone: '',
    locationName: '',
    latitude: null,
    longitude: null,
    detail: '',
    isDefault: false,
    isEdit: false,
    resolvedRegion: null
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id, isEdit: true })
      this.loadAddressDetail(options.id)
    }
  },

  async loadAddressDetail(id) {
    try {
      const res = await api.getAddressDetail(id)
      if (res && res.success && res.data) {
        const d = res.data
        this.setData({
          name: d.contactName || '',
          phone: d.contactPhone || '',
          locationName: [d.province, d.city, d.district, d.street].filter(Boolean).join(' '),
          detail: d.detailAddress || '',
          latitude: d.latitude || null,
          longitude: d.longitude || null,
          isDefault: !!d.isDefault,
          resolvedRegion: { province: d.province, city: d.city, district: d.district, street: d.street }
        })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }) },
  onDetailInput(e) { this.setData({ detail: e.detail.value }) },
  onDefaultChange(e) { this.setData({ isDefault: e.detail.value }) },

  // 地图选点
  async onChooseLocation() {
    try {
      const res = await wx.chooseLocation()
      if (res && res.latitude && res.longitude) {
        this.setData({
          locationName: res.name || res.address || '',
          latitude: res.latitude,
          longitude: res.longitude
        })
        // 逆地理编码
        const geo = await api.reverseGeocode(res.latitude, res.longitude)
        if (geo && geo.success) {
          this.setData({ resolvedRegion: geo.data })
        } else {
          this.setData({ resolvedRegion: null })
        }
      }
    } catch (e) {
      if (!(e && e.errMsg && e.errMsg.includes('cancel'))) {
        wx.showToast({ title: '选点失败', icon: 'none' })
      }
    }
  },

  // 文本兜底解析（若无Key或失败）
  extractRegionFromText(text = '') {
    const provinceMatch = text.match(/(.*?省|北京市|上海市|天津市|重庆市)/)
    const cityMatch = text.match(/(.*?市|.*?地区|.*?盟)/)
    const districtMatch = text.match(/(.*?(区|县))/)
    return {
      province: provinceMatch ? provinceMatch[0] : '',
      city: cityMatch ? cityMatch[0] : '',
      district: districtMatch ? districtMatch[0] : '',
      street: ''
    }
  },

  async saveAddress() {
    const { id, isEdit, name, phone, detail, isDefault, latitude, longitude, locationName, resolvedRegion } = this.data

    if (!name.trim()) return wx.showToast({ title: '请输入姓名', icon: 'none' })
    if (!phone.trim()) return wx.showToast({ title: '请输入手机号', icon: 'none' })
    if (!latitude || !longitude) return wx.showToast({ title: '请在地图中选点', icon: 'none' })

    // 优先使用逆地理结果，失败再文本兜底
    const region = resolvedRegion || this.extractRegionFromText(locationName)

    const payload = {
      addressName: '收货地址',
      contactName: name.trim(),
      contactPhone: phone.trim(),
      province: region.province || '',
      city: region.city || '',
      district: region.district || '',
      street: region.street || '',
      detailAddress: detail.trim(),
      postalCode: '',
      isDefault: !!isDefault,
      addressType: 1,
      latitude,
      longitude
    }

    try {
      wx.showLoading({ title: '保存中...' })
      if (isEdit) {
        await api.updateAddress(id, payload)
      } else {
        await api.createAddress(payload)
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
