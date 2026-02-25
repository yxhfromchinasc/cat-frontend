const { api } = require('../../utils/util.js')

Page({
  data: {
    defaultAddress: null,
    selectedAddressId: null,
    fromAddressSelect: false,
    removalPointList: [],
    removalPointName: null,
    selectedRemovalPointId: null,
    serviceCategoryNames: ['报废清除', '屋内搬运'],
    selectedCategoryIndex: -1,
    form: {
      startTime: null,
      endTime: null,
      startTimeStr: '',
      serviceCategory: null, // 1-报废清除，2-屋内搬运；默认不选中
      images: [],
      remark: '',
      // 加急统一由后端按配置计算，前端不再提供开关
      isUrgent: false
    },
    canSubmitData: false,
    submitTip: '',
    isSubmitting: false,
    showTimePickerModal: false,
    checkingAvailability: false,
    dateOptions: [],
    timeSlotOptions: [],
    todayTimeSlots: [],
    tomorrowTimeSlots: [],
    selectedDateIndex: -1,
    selectedTimeSlotIndex: -1
  },

  onShow() {
    // 与回收页一致：从地址选择页返回时仅清空时间、更新提交状态（清运点由地址选择页调用 loadRemovalPointsByAddress 刷新）
    if (this.data.fromAddressSelect && this.data.defaultAddress) {
      this.setData({ fromAddressSelect: false })
      // 选择地址后，清空时间数据（因为不同地址对应的清运点不同，时间段选项也会不同）
      this.setData({
        selectedDateIndex: -1,
        selectedTimeSlotIndex: -1,
        'form.startTime': null,
        'form.endTime': null,
        'form.startTimeStr': ''
      })
      this.updateCanSubmit()
      return
    }
    // 与回收页一致：只有在没有选中地址时才加载默认地址
    if (!this.data.selectedAddressId) {
      this.loadDefaultAddress()
    }
  },

  async onLoad(options) {
    // 先检查是否有未支付的需要支付订单（快递代取 + 大件清运）
    const hasPendingOrder = await this.checkUnpaidPayableOrder()
    if (hasPendingOrder) {
      return
    }
    const addressId = options.addressId ? parseInt(options.addressId) : null
    await this.loadDefaultAddress(addressId)
    this.initTimeSlots()
    this.updateCanSubmit()
  },

  // 检查是否有未支付的需要支付订单（快递代取 + 大件清运）
  async checkUnpaidPayableOrder() {
    try {
      const res = await api.getPendingExpressOrder()
      if (res.success && res.data && res.data.orderNo) {
        const { orderNo, serviceType } = res.data
        wx.showModal({
          title: '提示',
          content: '当前有订单未支付，请前往详情页支付',
          confirmText: '前往支付',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              let url = ''
              if (serviceType === 2) {
                url = `/pages/express-detail/index?orderNo=${orderNo}`
              } else if (serviceType === 5) {
                url = `/pages/removal-detail/index?orderNo=${orderNo}`
              }
              if (url) {
                wx.redirectTo({ url })
              }
            } else {
              wx.navigateBack()
            }
          }
        })
        return true
      }
      return false
    } catch (e) {
      console.error('检查未支付订单失败', e)
      return false
    }
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

  // 根据地址ID加载清运点列表（与回收页 loadRecyclingPointsByAddress 结构一致）
  async loadRemovalPointsByAddress(addressId) {
    if (!addressId) {
      this.setData({
        removalPointList: [],
        removalPointName: null,
        selectedRemovalPointId: null
      })
      return
    }
    // 请求前先清空，避免切换地址后仍短暂显示上一地址的清运点
    this.setData({
      removalPointList: [],
      removalPointName: null,
      selectedRemovalPointId: null
    })
    try {
      wx.showLoading({ title: '查询清运点...' })
      const res = await api.getRemovalPointsByAddress(addressId)
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
        // 有清运点时清空时间并重新初始化时间段（与回收页一致）
        if (selectedRemovalPointId) {
          this.setData({
            selectedDateIndex: -1,
            selectedTimeSlotIndex: -1,
            'form.startTime': null,
            'form.endTime': null,
            'form.startTimeStr': ''
          })
          this.initTimeSlots()
          this.checkAllTimeSlotsAvailability()
        }
        this.updateCanSubmit()
      } else {
        this.setData({
          removalPointList: [],
          removalPointName: null,
          selectedRemovalPointId: null
        })
        this.updateCanSubmit()
      }
    } catch (e) {
      console.error('加载清运点失败', e)
      this.setData({
        removalPointList: [],
        removalPointName: null,
        selectedRemovalPointId: null
      })
      this.updateCanSubmit()
    } finally {
      wx.hideLoading()
    }
  },

  // 选择地址（与回收页一致：无地址去地址管理，有地址去地址选择页）
  selectAddress() {
    if (!this.data.defaultAddress) {
      wx.navigateTo({ url: '/pages/address/index' })
    } else {
      wx.navigateTo({
        url: `/pages/address/select?currentAddressId=${this.data.selectedAddressId}`
      })
    }
  },

  // 清运类型：按钮点击选择（1-报废清除，2-屋内搬运）
  onServiceCategoryTap(e) {
    const value = parseInt(e.currentTarget.dataset.value, 10)
    if (value !== 1 && value !== 2) return
    this.setData({
      'form.serviceCategory': value,
      selectedCategoryIndex: value - 1
    })
    this.updateCanSubmit()
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({
      'form.remark': e.detail.value
    })
  },

  // 初始化时间选择器：有清运点时从后端拉取（清运点营业时间 + 小哥排期），无清运点时展示空
  initTimeSlots() {
    const dateOptions = [
      { label: '今天', isToday: true },
      { label: '明天', isToday: false }
    ]
    if (!this.data.selectedRemovalPointId) {
      this.setData({
        dateOptions,
        todayTimeSlots: [],
        tomorrowTimeSlots: [],
        timeSlotOptions: [],
        selectedDateIndex: 0,
        selectedTimeSlotIndex: -1
      })
      this.updateCanSubmit()
      return
    }
    this.setData({ dateOptions })
    this.checkAllTimeSlotsAvailability()
  },

  // 按清运点营业时间与小哥排期拉取今天/明天时间段（与回收/快递代取一致）
  async checkAllTimeSlotsAvailability() {
    if (this.data.checkingAvailability || !this.data.selectedRemovalPointId) return
    this.setData({ checkingAvailability: true })
    try {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const todayStr = formatDate(today)
      const tomorrowStr = formatDate(tomorrow)
      const serviceTypeRemoval = 5
      const [todayRes, tomorrowRes] = await Promise.all([
        api.getTimeSlotList(serviceTypeRemoval, todayStr, null, null, this.data.selectedRemovalPointId),
        api.getTimeSlotList(serviceTypeRemoval, tomorrowStr, null, null, this.data.selectedRemovalPointId)
      ])
      const mapSlots = (list) => (list || []).map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        isToday: slot.isToday,
        available: !!slot.available,
        disabled: !slot.available,
        label: slot.available ? `${slot.startTime} - ${slot.endTime}` : `${slot.startTime} - ${slot.endTime} (已约满)`
      }))
      const todaySlots = todayRes.success && todayRes.data && todayRes.data.timeSlots ? mapSlots(todayRes.data.timeSlots) : []
      const tomorrowSlots = tomorrowRes.success && tomorrowRes.data && tomorrowRes.data.timeSlots ? mapSlots(tomorrowRes.data.timeSlots) : []
      const defaultOptions = todaySlots.length > 0 ? todaySlots : tomorrowSlots
      const defaultDateIndex = todaySlots.length > 0 ? 0 : 1
      this.setData({
        todayTimeSlots: todaySlots,
        tomorrowTimeSlots: tomorrowSlots,
        timeSlotOptions: defaultOptions,
        selectedDateIndex: defaultDateIndex,
        selectedTimeSlotIndex: -1
      })
      this.updateCanSubmit()
    } catch (e) {
      console.error('获取大件清运时间段失败', e)
    } finally {
      this.setData({ checkingAvailability: false })
    }
  },

  showTimePicker() {
    this.setData({ showTimePickerModal: true })
  },

  hideTimePicker() {
    this.setData({ showTimePickerModal: false })
  },

  selectDate(e) {
    const index = parseInt(e.detail.index, 10)
    const isToday = index === 0
    const timeSlotOptions = isToday ? this.data.todayTimeSlots : this.data.tomorrowTimeSlots
    this.setData({
      selectedDateIndex: index,
      timeSlotOptions: timeSlotOptions || [],
      selectedTimeSlotIndex: -1,
      'form.startTime': null,
      'form.endTime': null,
      'form.startTimeStr': ''
    })
    this.updateCanSubmit()
  },

  selectTimeSlot(e) {
    const index = parseInt(e.detail.index, 10)
    const timeSlot = this.data.timeSlotOptions[index]
    if (!timeSlot) return
    if (timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
      return
    }
    const isToday = this.data.selectedDateIndex === 0
    const startTime = this.formatDateTime(timeSlot.startTime, !isToday)
    const endTime = this.formatDateTime(timeSlot.endTime, !isToday)
    const dateLabel = isToday ? '今天' : '明天'
    this.setData({
      selectedTimeSlotIndex: index,
      'form.startTime': startTime,
      'form.endTime': endTime,
      'form.startTimeStr': `${dateLabel} ${timeSlot.label}`
    })
    this.updateCanSubmit()
  },

  confirmTimeSelection() {
    if (this.data.selectedDateIndex < 0 || this.data.selectedTimeSlotIndex < 0) {
      wx.showToast({ title: '请选择日期和时间段', icon: 'none' })
      return
    }
    const timeSlot = this.data.timeSlotOptions[this.data.selectedTimeSlotIndex]
    if (!timeSlot) return
    if (timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
      return
    }
    const isToday = this.data.selectedDateIndex === 0
    const startTime = this.formatDateTime(timeSlot.startTime, !isToday)
    const endTime = this.formatDateTime(timeSlot.endTime, !isToday)
    const dateLabel = isToday ? '今天' : '明天'
    this.setData({
      'form.startTime': startTime,
      'form.endTime': endTime,
      'form.startTimeStr': `${dateLabel} ${timeSlot.label}`,
      showTimePickerModal: false
    })
    this.updateCanSubmit()
  },

  formatDateTime(timeStr, isTomorrow) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate() + (isTomorrow ? 1 : 0)).padStart(2, '0')
    return `${year}-${month}-${day} ${timeStr}:00`
  },

  // 是否加急（大件清运前端不再提供加急开关，保留空实现以兼容旧wxml）
  onUrgentChange() {
    // 前端纯屏蔽，加急逻辑由后端统一处理
  },

  async chooseImages() {
    const remaining = 9 - this.data.form.images.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传9张', icon: 'none' })
      return
    }
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: remaining,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      const tempFilePaths = res.tempFilePaths || []
      if (tempFilePaths.length === 0) return
      wx.showLoading({ title: '上传图片中...', mask: true })
      const uploadPromises = tempFilePaths.map(filePath => api.uploadImage(filePath, 'removal'))
      const uploadResults = await Promise.all(uploadPromises)
      // 与回收页一致：后端返回 data.url，只取 URL 字符串存入 form.images
      const uploadedUrls = uploadResults
        .filter(result => result && result.success && result.data)
        .map(result => typeof result.data === 'string' ? result.data : (result.data && result.data.url))
        .filter(Boolean)
      if (uploadedUrls.length > 0) {
        const newImages = [...this.data.form.images, ...uploadedUrls]
        this.setData({ 'form.images': newImages })
        wx.showToast({ title: `成功上传${uploadedUrls.length}张图片`, icon: 'success' })
      } else {
        wx.showToast({ title: '图片上传失败', icon: 'none' })
      }
      this.updateCanSubmit()
    } catch (e) {
      console.error('选择/上传图片失败', e)
      wx.showToast({ title: e && e.error ? e.error : '上传失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  deleteImage(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const images = this.data.form.images.filter((_, i) => i !== index)
    this.setData({ 'form.images': images })
    this.updateCanSubmit()
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.form.images
    wx.previewImage({ current: url, urls })
  },

  updateCanSubmit() {
    const hasAddress = !!this.data.selectedAddressId
    const hasPoint = !!this.data.selectedRemovalPointId
    const hasCategory = this.data.form.serviceCategory === 1 || this.data.form.serviceCategory === 2
    const hasImages = !!(this.data.form.images && this.data.form.images.length > 0)
    const hasTime = !!(this.data.form.startTime && this.data.form.endTime)
    const canSubmit = hasAddress && hasPoint && hasCategory && hasImages && hasTime && !this.data.isSubmitting
    const missing = []
    if (!hasAddress) missing.push('地址')
    if (!hasPoint) missing.push('清运点')
    if (!hasCategory) missing.push('清运类型')
    if (!hasImages) missing.push('现场照片')
    if (!hasTime) missing.push('预约时间')
    const submitTip = canSubmit ? '' : (missing.length ? `请完成：${missing.join('、')}` : '')
    this.setData({
      canSubmitData: canSubmit,
      submitTip
    })
  },

  async submitOrder() {
    if (!this.data.canSubmitData || this.data.isSubmitting) return
    if (!this.data.form.isUrgent && this.data.form.startTime && this.data.form.endTime) {
      try {
        const checkRes = await api.checkTimeSlotAvailability(
          5,
          this.data.form.startTime,
          this.data.form.endTime,
          null,
          null,
          this.data.selectedRemovalPointId
        )
        if (!checkRes.success || !checkRes.data?.available) {
          wx.showToast({ title: checkRes.data?.message || '该时间段已约满，请重新选择', icon: 'none' })
          this.setData({
            selectedTimeSlotIndex: -1,
            'form.startTime': null,
            'form.endTime': null,
            'form.startTimeStr': ''
          })
          this.updateCanSubmit()
          return
        }
      } catch (e) {
        console.error('检查时间段可用性失败', e)
      }
    }
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
        // 加急标记由后端根据配置和场景决定，这里固定为false
        isUrgent: false
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
