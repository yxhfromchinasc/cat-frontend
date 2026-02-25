const { api } = require('../../utils/util.js')

Page({
  data: {
    defaultAddress: null,
    selectedAddressId: null,
    removalPointList: [],
    removalPointName: null,
    selectedRemovalPointId: null,
    form: {
      startTime: null,
      endTime: null,
      startTimeStr: '',
      serviceCategory: 1, // 1-清理，2-搬运
      images: [],
      remark: '',
      isUrgent: false
    },
    canSubmitData: false,
    submitTip: '',
    isSubmitting: false
  },

  async onLoad(options) {
    const addressId = options.addressId ? parseInt(options.addressId) : null
    await this.loadDefaultAddress(addressId)
    this.updateCanSubmit()
  },

  async loadDefaultAddress(preselectAddressId) {
    try {
      const res = await api.getDefaultAddress()
      if (res.success && res.data) {
        const addr = res.data
        this.setData({
          defaultAddress: addr,
          selectedAddressId: addr.id
        })
        await this.loadRemovalPointsByAddress(addr.id)
      }
      if (preselectAddressId && preselectAddressId !== this.data.selectedAddressId) {
        const detailRes = await api.getAddressDetail(preselectAddressId)
        if (detailRes.success && detailRes.data) {
          const addr2 = detailRes.data
          this.setData({
            defaultAddress: addr2,
            selectedAddressId: addr2.id
          })
          await this.loadRemovalPointsByAddress(addr2.id)
        }
      }
    } catch (e) {
      console.error('加载默认地址失败', e)
    }
  },

  async loadRemovalPointsByAddress(addressId) {
    if (!addressId) {
      this.setData({
        removalPointList: [],
        removalPointName: null,
        selectedRemovalPointId: null
      })
      return
    }
    try {
      wx.showLoading({ title: '查询清运点...' })
      const res = await api.getRemovalPointsByAddress(addressId)
      wx.hideLoading()
      if (res.success && res.data) {
        const list = res.data || []
        let removalPointName = null
        let selectedRemovalPointId = null
        if (list.length > 0) {
          removalPointName = list[0].pointName
          selectedRemovalPointId = list[0].id
        }
        this.setData({
          removalPointList: list,
          removalPointName,
          selectedRemovalPointId
        })
      } else {
        this.setData({
          removalPointList: [],
          removalPointName: null,
          selectedRemovalPointId: null
        })
      }
      this.updateCanSubmit()
    } catch (e) {
      wx.hideLoading()
      console.error('加载清运点失败', e)
    }
  },

  // 选择地址
  selectAddress() {
    wx.navigateTo({
      url: '/pages/address/index'
    })
  },

  // 选择清运类型
  onServiceCategoryChange(e) {
    const val = Number(e.detail.value)
    this.setData({
      'form.serviceCategory': val
    })
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({
      'form.remark': e.detail.value
    })
  },

  // 预约时间选择，这里简化：直接用当前时间+2小时
  pickTime() {
    const now = new Date()
    const start = new Date(now.getTime() + 30 * 60 * 1000)
    const end = new Date(start.getTime() + 90 * 60 * 1000)
    const pad = n => (n < 10 ? '0' + n : '' + n)
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
    const startStr = fmt(start)
    const endStr = fmt(end)
    this.setData({
      'form.startTime': startStr,
      'form.endTime': endStr,
      'form.startTimeStr': `${startStr} 至 ${endStr}`
    })
    this.updateCanSubmit()
  },

  // 是否加急
  onUrgentChange(e) {
    const isUrgent = !!e.detail.value
    this.setData({
      'form.isUrgent': isUrgent
    })
    this.updateCanSubmit()
  },

  updateCanSubmit() {
    const hasAddress = !!this.data.selectedAddressId
    const hasPoint = !!this.data.selectedRemovalPointId
    const hasTime = !!(this.data.form.startTime && this.data.form.endTime)
    const canSubmit = hasAddress && hasPoint && hasTime && !this.data.isSubmitting
    const missing = []
    if (!hasAddress) missing.push('地址')
    if (!hasPoint) missing.push('清运点')
    if (!hasTime) missing.push('预约时间')
    const submitTip = canSubmit ? '' : (missing.length ? `请完成：${missing.join('、')}` : '')
    this.setData({
      canSubmitData: canSubmit,
      submitTip
    })
  },

  async submitOrder() {
    if (!this.data.canSubmitData || this.data.isSubmitting) return
    this.setData({ isSubmitting: true })
    try {
      const payload = {
        addressId: this.data.selectedAddressId,
        removalPointId: this.data.selectedRemovalPointId,
        startTime: this.data.form.startTime,
        endTime: this.data.form.endTime,
        serviceCategory: this.data.form.serviceCategory,
        images: this.data.form.images,
        remark: this.data.form.remark,
        isUrgent: this.data.form.isUrgent
      }
      const res = await api.request({
        url: '/removal/create',
        method: 'POST',
        data: payload,
        showSuccess: true,
        successMessage: '提交成功'
      })
      if (res && res.success && res.data) {
        const orderNo = res.data
        wx.redirectTo({
          url: `/pages/removal-detail/index?orderNo=${orderNo}`
        })
      }
    } catch (e) {
      console.error('创建大件清运订单失败', e)
    } finally {
      this.setData({ isSubmitting: false })
      this.updateCanSubmit()
    }
  }
});
