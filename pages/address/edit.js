// pages/address/edit.js
const {api} = require('../../utils/util.js')

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
        resolvedRegion: null,
        locationIcon: '' // 位置图标 SVG data URI
    },

    onLoad(options) {
        // 将 SVG 转换为 data URI
        const locationSvg = encodeURIComponent(`
          <svg t="1763877216948" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200">
            <path d="M514.972 90.125c-170.438 0-314.793 147.326-314.793 321.801 0 182.691 167.319 369.563 279.833 500.894 0.441 0.55 18.636 21.057 41.05 21.057 0.037 0 1.907 0 1.981 0 22.415 0 40.5-20.507 40.903-21.021 105.653-123.225 259.875-326.347 259.875-500.93 0-174.471-112.585-321.801-308.849-321.801zM525.427 877.491c-0.917 0.917-2.238 1.981-3.412 2.789-1.174-0.807-2.495-1.871-3.449-2.789l-13.611-15.884c-106.716-124.178-252.832-294.249-252.832-449.682 0-145.895 120.363-269.083 262.847-269.083 177.445 0 256.903 135.147 256.903 269.083 0 117.978-82.945 274.622-246.448 465.566zM512.917 249.813c-86.099 0-155.91 70.838-155.91 158.222s69.812 158.222 155.91 158.222c86.099 0 155.91-70.838 155.91-158.222s-69.812-158.222-155.91-158.222zM512.917 513.468c-57.338 0-105.138-48.46-105.138-106.606 0-58.182 46.626-105.469 103.929-105.469 57.302 0 103.929 47.287 103.929 105.469 0.037 58.146-45.379 106.606-102.718 106.606z" fill="#272636"></path>
          </svg>
        `)
        this.setData({ 
            locationIcon: `data:image/svg+xml;charset=UTF-8,${locationSvg}` 
        })
        
        if (options.id) {
            this.setData({id: options.id, isEdit: true})
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
                    resolvedRegion: {province: d.province, city: d.city, district: d.district, street: d.street}
                })
            }
        } catch (e) {
            wx.showToast({title: '加载失败', icon: 'none'})
        }
    },

    onNameInput(e) {
        this.setData({name: e.detail.value})
    },

    onPhoneInput(e) {
        // 限制只能输入数字，最多11位
        let value = e.detail.value.replace(/\D/g, '')
        if (value.length > 11) {
            value = value.substring(0, 11)
        }
        this.setData({phone: value})
    },

    onDetailInput(e) {
        this.setData({detail: e.detail.value})
    },

    onDefaultChange(e) {
        this.setData({isDefault: e.detail.value})
    },

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
                    this.setData({resolvedRegion: geo.data})
                } else {
                    this.setData({resolvedRegion: null})
                }
            }
        } catch (e) {
            if (!(e && e.errMsg && e.errMsg.includes('cancel'))) {
                wx.showToast({title: '选点失败', icon: 'none'})
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

    // 验证手机号格式
    validatePhone(phone) {
        if (!phone || !phone.trim()) {
            return {valid: false, message: '请输入手机号'}
        }
        const phoneStr = phone.trim()
        // 验证手机号格式：11位数字，以1开头，第二位是3-9
        if (!/^1[3-9]\d{9}$/.test(phoneStr)) {
            return {valid: false, message: '请输入正确的手机号（11位数字）'}
        }
        return {valid: true}
    },

    async saveAddress() {
        const {
            id,
            isEdit,
            name,
            phone,
            detail,
            isDefault,
            latitude,
            longitude,
            locationName,
            resolvedRegion
        } = this.data

        // 校验姓名
        if (!name.trim()) {
            wx.showToast({title: '请输入姓名', icon: 'none'})
            return
        }

        // 校验手机号
        const phoneValidation = this.validatePhone(phone)
        if (!phoneValidation.valid) {
            wx.showToast({title: phoneValidation.message, icon: 'none'})
            return
        }

        // 校验地图选点
        if (!latitude || !longitude) {
            wx.showToast({title: '请在地图中选点', icon: 'none'})
            return
        }

        // 校验详细地址
        if (!detail.trim()) {
            wx.showToast({title: '请输入详细地址', icon: 'none'})
            return
        }

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
            wx.showLoading({title: '保存中...'})
            if (isEdit) {
                await api.updateAddress(id, payload)
            } else {
                await api.createAddress(payload)
            }
            wx.showToast({title: '保存成功', icon: 'success'})
            setTimeout(() => wx.navigateBack(), 800)
        } catch (e) {
            wx.showToast({title: '保存失败', icon: 'none'})
        } finally {
            wx.hideLoading()
        }
    },

    // 删除地址
    async deleteAddress() {
        const { id } = this.data
        
        if (!id) {
            wx.showToast({ title: '地址ID不存在', icon: 'none' })
            return
        }

        wx.showModal({
            title: '确认删除',
            content: '确定要删除这个地址吗？删除后无法恢复。',
            confirmText: '删除',
            confirmColor: '#ff4757',
            success: async (res) => {
                if (res.confirm) {
                    try {
                        wx.showLoading({ title: '删除中...' })
                        await api.deleteAddress(id)
                        wx.hideLoading()
                        wx.showToast({ title: '删除成功', icon: 'success' })
                        setTimeout(() => wx.navigateBack(), 800)
                    } catch (error) {
                        wx.hideLoading()
                        const errorMsg = error?.message || error?.data?.message || '删除失败，请重试'
                        wx.showToast({ title: errorMsg, icon: 'none', duration: 2000 })
                    }
                }
            }
        })
    }
})
