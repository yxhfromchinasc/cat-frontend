const { api } = require('../../utils/util.js')

// 允许选择的天：杂货铺仅次日达
const ALLOWED_DAYS_GROCERY = ['明天']
const DAY_OFFSET_MAP = { '今天': 0, '明天': 1, '后天': 2 }

function getDateStrByDayOffset(dayOffset) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildDateOptions(allowedDays) {
  return allowedDays.map(label => ({
    label,
    isToday: label === '今天',
    dayOffset: DAY_OFFSET_MAP[label] ?? 0
  }))
}

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
    allowedDays: ALLOWED_DAYS_GROCERY,
    dateOptions: [],
    timeSlotOptions: [],
    timeSlotsByDay: [],
    selectedDateIndex: -1,
    selectedTimeSlotIndex: -1,
    showTimePickerModal: false,
    canSubmit: false,
    isSubmitting: false,
    checkingAvailability: false,
    remark: ''
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

  // 初始化时间选择器：有杂货铺时从后端拉取（杂货铺营业时间 + 小哥排期），无杂货铺时展示空。允许选择的天由 allowedDays 控制（杂货铺仅明天）
  initTimeSlots() {
    const allowedDays = this.data.allowedDays || ALLOWED_DAYS_GROCERY
    const dateOptions = buildDateOptions(allowedDays)
    if (!this.data.groceryPoint || !this.data.groceryPoint.id) {
      this.setData({
        dateOptions,
        timeSlotsByDay: [],
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

  // 按允许选择的天拉取时间段（仅请求 allowedDays 对应的日期，杂货铺仅明天）
  async checkAllTimeSlotsAvailability() {
    if (this.data.checkingAvailability || !this.data.groceryPoint || !this.data.groceryPoint.id) return
    const allowedDays = this.data.allowedDays || ALLOWED_DAYS_GROCERY
    const dateOptions = this.data.dateOptions || buildDateOptions(allowedDays)
    this.setData({ checkingAvailability: true })
    try {
      const serviceTypeGrocery = 6
      const groceryPointId = this.data.groceryPoint.id
      const dateStrs = dateOptions.map(opt => getDateStrByDayOffset(opt.dayOffset))
      const results = await Promise.all(
        dateStrs.map(dateStr => api.getTimeSlotList(serviceTypeGrocery, dateStr, null, null, null, groceryPointId))
      )
      const mapSlots = (list) => (list || []).map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        isToday: slot.isToday,
        available: !!slot.available,
        disabled: !slot.available,
        label: slot.available ? `${slot.startTime} - ${slot.endTime}` : `${slot.startTime} - ${slot.endTime} (已约满)`
      }))
      const timeSlotsByDay = results.map((res, i) =>
        (res.success && res.data && res.data.timeSlots) ? mapSlots(res.data.timeSlots) : []
      )
      let defaultOptions = timeSlotsByDay[0] || []
      let defaultDateIndex = 0
      for (let i = 0; i < timeSlotsByDay.length; i++) {
        if (timeSlotsByDay[i] && timeSlotsByDay[i].length > 0) {
          defaultOptions = timeSlotsByDay[i]
          defaultDateIndex = i
          break
        }
      }
      this.setData({
        timeSlotsByDay,
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

  formatDateTimeByDayOffset(timeStr, dayOffset) {
    const d = new Date()
    d.setDate(d.getDate() + (dayOffset || 0))
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
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
    const timeSlotsByDay = this.data.timeSlotsByDay || []
    const timeSlotOptions = timeSlotsByDay[index] || []
    this.setData({
      selectedDateIndex: index,
      timeSlotOptions,
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
    const dateOptions = this.data.dateOptions || []
    const selectedDate = dateOptions[this.data.selectedDateIndex]
    const dayOffset = selectedDate ? selectedDate.dayOffset : 1
    const dateLabel = selectedDate ? selectedDate.label : '明天'
    const startTime = this.formatDateTimeByDayOffset(timeSlot.startTime, dayOffset)
    const endTime = this.formatDateTimeByDayOffset(timeSlot.endTime, dayOffset)
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
    const dateOptions = this.data.dateOptions || []
    const selectedDate = dateOptions[this.data.selectedDateIndex]
    const dayOffset = selectedDate ? selectedDate.dayOffset : 1
    const dateLabel = selectedDate ? selectedDate.label : '明天'
    const startTime = this.formatDateTimeByDayOffset(timeSlot.startTime, dayOffset)
    const endTime = this.formatDateTimeByDayOffset(timeSlot.endTime, dayOffset)
    this.setData({
      startTime,
      endTime,
      startTimeStr: `${dateLabel} ${timeSlot.label}`,
      showTimePickerModal: false
    })
    this.updateCanSubmit()
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value || '' })
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
        remark: (this.data.remark || '').trim() || undefined,
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
        const pages = getCurrentPages()
        const groceryIndexPage = pages.find(p => p.route === 'pages/grocery/index')
        if (groceryIndexPage && typeof groceryIndexPage.setData === 'function') {
          groceryIndexPage.setData({ cartMap: {}, cartCount: 0, cartItems: [] })
        }
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
