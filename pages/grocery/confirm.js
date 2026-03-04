const { api } = require('../../utils/util.js')

Page({
  data: {
    address: null,
    groceryPoint: null,
    items: [],
    amount: 0,
    priceDetail: '',
    startTime: null,
    endTime: null,
    startTimeStr: '',
    dateOptions: [],
    timeSlotOptions: [],
    todayTimeSlots: [],
    tomorrowTimeSlots: [],
    selectedDateIndex: -1,
    selectedTimeSlotIndex: -1,
    showTimePickerModal: false,
    canSubmit: false,
    isSubmitting: false,
    checkingAvailability: false
  },

  onLoad() {
    const app = getApp()
    const data = app.globalData.groceryConfirmData
    if (!data) {
      wx.showToast({ title: '请从选货页进入', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    this.setData({
      address: data.address,
      groceryPoint: data.groceryPoint,
      items: data.items,
      amount: data.amount,
      priceDetail: data.priceDetail
    })
    this.initTimeSlots()
    this.updateCanSubmit()
  },

  // 初始化时间选择器：有杂货铺时从后端拉取（杂货铺营业时间 + 小哥排期），无杂货铺时展示空
  initTimeSlots() {
    const dateOptions = [
      { label: '今天', isToday: true },
      { label: '明天', isToday: false }
    ]
    if (!this.data.groceryPoint || !this.data.groceryPoint.id) {
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

  // 按杂货铺营业时间与小哥排期拉取今天/明天时间段（与回收/大件清运一致）
  async checkAllTimeSlotsAvailability() {
    if (this.data.checkingAvailability || !this.data.groceryPoint || !this.data.groceryPoint.id) return
    this.setData({ checkingAvailability: true })
    try {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const todayStr = formatDate(today)
      const tomorrowStr = formatDate(tomorrow)
      const serviceTypeGrocery = 6
      const groceryPointId = this.data.groceryPoint.id
      const [todayRes, tomorrowRes] = await Promise.all([
        api.getTimeSlotList(serviceTypeGrocery, todayStr, null, null, null, groceryPointId),
        api.getTimeSlotList(serviceTypeGrocery, tomorrowStr, null, null, null, groceryPointId)
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
        selectedTimeSlotIndex: -1,
        startTime: null,
        endTime: null,
        startTimeStr: ''
      })
      this.updateCanSubmit()
    } catch (e) {
      console.error('获取杂货铺时间段失败', e)
    } finally {
      this.setData({ checkingAvailability: false })
    }
  },

  formatDateTime(timeStr, isTomorrow) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate() + (isTomorrow ? 1 : 0)).padStart(2, '0')
    return `${year}-${month}-${day} ${timeStr}:00`
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
      startTime: null,
      endTime: null,
      startTimeStr: ''
    })
    this.updateCanSubmit()
  },

  selectTimeSlot(e) {
    const index = parseInt(e.detail.index, 10)
    const timeSlot = this.data.timeSlotOptions[index]
    if (!timeSlot) return
    if (timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满', icon: 'none' })
      return
    }
    const isToday = this.data.selectedDateIndex === 0
    const startTime = this.formatDateTime(timeSlot.startTime, !isToday)
    const endTime = this.formatDateTime(timeSlot.endTime, !isToday)
    const dateLabel = isToday ? '今天' : '明天'
    this.setData({
      selectedTimeSlotIndex: index,
      startTime,
      endTime,
      startTimeStr: `${dateLabel} ${timeSlot.label}`
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
      wx.showToast({ title: '请选择可用的时间段', icon: 'none' })
      return
    }
    const isToday = this.data.selectedDateIndex === 0
    const startTime = this.formatDateTime(timeSlot.startTime, !isToday)
    const endTime = this.formatDateTime(timeSlot.endTime, !isToday)
    const dateLabel = isToday ? '今天' : '明天'
    this.setData({
      startTime,
      endTime,
      startTimeStr: `${dateLabel} ${timeSlot.label}`,
      showTimePickerModal: false
    })
    this.updateCanSubmit()
  },

  updateCanSubmit() {
    const canSubmit = !!(this.data.address && this.data.groceryPoint && this.data.items.length > 0 &&
      this.data.startTime && this.data.endTime && !this.data.isSubmitting)
    this.setData({ canSubmit })
  },

  async submitOrder() {
    if (!this.data.canSubmit || this.data.isSubmitting) return
    if (!this.data.startTime || !this.data.endTime) {
      wx.showToast({ title: '请先选择预约时间', icon: 'none' })
      return
    }
    this.setData({ isSubmitting: true })
    try {
      const payload = {
        groceryPointId: this.data.groceryPoint.id,
        addressId: this.data.address.id,
        startTime: this.data.startTime,
        endTime: this.data.endTime,
        isUrgent: false,
        priceDetail: this.data.priceDetail,
        amount: this.data.amount,
        items: this.data.items.map(i => ({
          productCode: i.productCode,
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotalAmount: i.subtotalAmount
        }))
      }
      const res = await api.createGroceryOrder(payload)
      if (res && res.success && res.data) {
        const orderNo = res.data
        delete getApp().globalData.groceryConfirmData
        wx.redirectTo({
          url: `/pages/grocery-detail/index?orderNo=${orderNo}`
        })
      }
    } catch (e) {
      console.error('创建杂货订单失败', e)
    } finally {
      this.setData({ isSubmitting: false })
    }
  }
})
