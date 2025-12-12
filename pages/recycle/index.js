// pages/recycle/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    // 地址相关（只显示默认地址）
    defaultAddress: null,
    selectedAddressId: null,
    
    // 标记：是否刚刚从地址选择页面返回（避免重新加载默认地址）
    fromAddressSelect: false,
    
    // 回收点相关
    recyclingPointList: [],
    recyclingPointName: null,
    selectedRecyclingPointId: null, // 选中的回收点ID
    
    // 表单数据
    form: {
      images: [], // 上传的图片URL列表
      startTime: null, // 开始时间（用于提交）
      endTime: null, // 结束时间（用于提交）
      startTimeStr: '', // 开始时间显示字符串
      itemDescription: '' // 物品备注
    },
    
    // 是否可以提交（用于按钮禁用状态）
    canSubmitData: false,
    
    // 快捷选项（从后端获取）
    quickOptions: [],
    
    // 时间选择相关
    timeType: 'appointment', // 'immediate' 立即上门 或 'appointment' 预约时间
    dateOptions: [], // 日期选项（今天、明天）
    timeSlotOptions: [], // 时间段选项（14:30-15:00等）
    todayTimeSlots: [], // 今天的时间段列表
    tomorrowTimeSlots: [], // 明天的时间段列表
    selectedDateIndex: -1, // 选中的日期索引
    selectedTimeSlotIndex: -1, // 选中的时间段索引
    checkingAvailability: false, // 是否正在检查可用性
    showTimePickerModal: false, // 是否显示时间选择器弹窗
    urgentTipText: '', // 立即上门提示文案

    // 今日回收价格（从系统设置获取）
    todayRecyclePrice: null,
    todayRecyclePriceText: ''
  },

  async onLoad(options) {
    // 加载备注快捷选项
    await this.loadRemarkOptions()
    
    // 加载立即上门提示文案
    await this.loadUrgentTip()

    // 加载今日回收价格
    await this.loadTodayRecyclePrice()
    
    // 优先从URL参数获取预选地址ID
    let addressId = options.addressId ? parseInt(options.addressId) : null
    
    // 加载默认地址（内部会加载回收点）
    await this.loadUserAddresses(addressId)
    
    // 默认选择预约时间，初始化时间选择器
    this.initTimeSlots()
  },

  onShow() {
    // 如果刚刚从地址选择页面返回，且已经有地址了，就不重新加载
    if (this.data.fromAddressSelect && this.data.defaultAddress) {
      // 清除标记
      this.setData({ fromAddressSelect: false })
      // 从地址选择页面返回，且已经有地址，说明地址选择页面已经更新了数据，不需要重新加载
      return
    }
    
    // 如果已经有选中的地址，说明用户已经选择了地址，不要重置为默认地址
    // 只有在没有选中地址的情况下，才加载默认地址（比如首次进入页面或地址被删除的情况）
    if (!this.data.selectedAddressId) {
      // 从地址编辑页返回后，刷新默认地址
      this.loadDefaultAddress()
    }
  },

  // 加载备注快捷选项
  async loadRemarkOptions() {
    try {
      const res = await api.getRecyclingRemarkOptions()
      if (res.success && res.data) {
        const options = JSON.parse(res.data)
        this.setData({ quickOptions: options || [] })
      } else {
        // 如果获取失败，使用默认值
        this.setData({ quickOptions: ['易拉罐', '纸壳子', '旧家电', '金属', '塑料瓶', '旧衣服', '废旧电池'] })
      }
    } catch (e) {
      console.error('加载备注快捷选项失败:', e)
      // 如果获取失败，使用默认值
      this.setData({ quickOptions: ['易拉罐', '纸壳子', '旧家电', '金属', '塑料瓶', '旧衣服', '废旧电池'] })
    }
  },

  // 加载默认地址
  async loadDefaultAddress() {
    try {
      const res = await api.getDefaultAddress()
      if (res.success && res.data) {
        const defaultAddress = res.data
        this.setData({
          defaultAddress: defaultAddress,
          selectedAddressId: defaultAddress.id
        })
        // 如果有默认地址，加载其回收点
        this.loadRecyclingPointsByAddress(defaultAddress.id)
        // 更新提交状态
        this.updateCanSubmit()
      } else {
        // 没有默认地址
        this.setData({
          defaultAddress: null,
          selectedAddressId: null,
          recyclingPointList: [],
          recyclingPointName: null
        })
        // 更新提交状态
        this.updateCanSubmit()
      }
    } catch (e) {
      console.error('加载默认地址失败:', e)
      this.setData({
        defaultAddress: null,
        selectedAddressId: null
      })
      this.updateCanSubmit()
    }
  },

  // 加载用户地址列表（兼容旧逻辑，保留用于预选地址）
  async loadUserAddresses(preselectAddressId) {
    // 优先加载默认地址
    await this.loadDefaultAddress()
    
    // 如果有预选地址且与默认地址不同，使用预选地址
    if (preselectAddressId && this.data.selectedAddressId !== preselectAddressId) {
      try {
        const addressDetail = await api.getAddressDetail(preselectAddressId)
        if (addressDetail.success && addressDetail.data) {
          this.setData({
            defaultAddress: addressDetail.data,
            selectedAddressId: preselectAddressId
          })
          this.loadRecyclingPointsByAddress(preselectAddressId)
          this.updateCanSubmit()
        }
      } catch (e) {
        console.error('加载预选地址失败:', e)
      }
    }
  },

  // 更新是否可以提交状态
  updateCanSubmit() {
    const canSubmit = this.data.selectedAddressId && 
                     this.data.form.startTime && 
                     this.data.form.endTime &&
                     this.data.selectedRecyclingPointId
    this.setData({ canSubmitData: canSubmit })
  },

  // 选择地址（跳转到地址选择页面）
  selectDeliveryAddress() {
    if (!this.data.defaultAddress) {
      // 没有地址，跳转到地址管理页面
      wx.navigateTo({
        url: '/pages/address/index'
      })
    } else {
      // 有默认地址，跳转到地址选择页面
      wx.navigateTo({
        url: `/pages/address/select?currentAddressId=${this.data.selectedAddressId}`
      })
    }
  },

  // 根据地址ID加载回收点列表
  async loadRecyclingPointsByAddress(addressId) {
    if (!addressId) {
      this.setData({ 
        recyclingPointList: [],
        recyclingPointName: null,
        selectedRecyclingPointId: null
      })
      return
    }
    
    try {
      wx.showLoading({ title: '查询回收点...' })
      const res = await api.getRecyclingPointsByAddress(addressId)
      if (res.success && res.data) {
        const recyclingPointList = res.data || []
        
        // 显示第一个回收点的名称和ID
        let recyclingPointName = null
        let selectedRecyclingPointId = null
        if (recyclingPointList.length > 0) {
          recyclingPointName = recyclingPointList[0].pointName
          selectedRecyclingPointId = recyclingPointList[0].id
        }
        
        this.setData({
          recyclingPointList,
          recyclingPointName,
          selectedRecyclingPointId
        })
        
        // 自动选择第一个回收点后，检查时间段可用性
        if (selectedRecyclingPointId) {
          this.checkAllTimeSlotsAvailability()
        }
        
        // 更新提交状态
        this.updateCanSubmit()
      } else {
        // 如果没有数据，设置为空
        this.setData({
          recyclingPointList: [],
          recyclingPointName: null,
          selectedRecyclingPointId: null
        })
        
        // 更新提交状态
        this.updateCanSubmit()
      }
    } catch (e) {
      console.error('加载回收点失败:', e)
      this.setData({
        recyclingPointList: [],
        recyclingPointName: null,
        selectedRecyclingPointId: null
      })
      
      // 更新提交状态
      this.updateCanSubmit()
    } finally {
      wx.hideLoading()
    }
  },

  // 加载立即上门提示文案
  async loadUrgentTip() {
    try {
      const res = await api.getPublicConfigs()
      if (res && res.success && res.data) {
        // 从系统设置中获取立即上门提示文案，配置key可能是 'urgent_tip' 或 'immediate_tip' 等
        const tipText = res.data.urgent_tip || res.data.immediate_tip || res.data.urgent_tip_text || ''
        this.setData({ urgentTipText: tipText })
      }
    } catch (e) {
      console.error('加载立即上门提示文案失败:', e)
    }
  },

  // 加载今日回收价格
  async loadTodayRecyclePrice() {
    try {
      // 配置键：recycling_price_per_kg（与后端系统配置保持一致）
      const res = await api.getConfigValue('recycling_price_per_kg')
      if (res && res.success && res.data) {
        const value = String(res.data).trim()
        if (value) {
          this.setData({
            todayRecyclePrice: value,
            todayRecyclePriceText: `今日综合回收价 ${value} 元/公斤`
          })
          return
        }
      }
      // 未配置价格时，保持为空，不展示卡片
      this.setData({
        todayRecyclePrice: null,
        todayRecyclePriceText: ''
      })
    } catch (e) {
      console.error('加载今日回收价格失败:', e)
      this.setData({
        todayRecyclePrice: null,
        todayRecyclePriceText: ''
      })
    }
  },

  // 显示立即上门提示
  showUrgentTip() {
    const tipText = this.data.urgentTipText || '立即上门服务说明'
    wx.showModal({
      title: '提示',
      content: tipText,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 立即上门开关变化
  onImmediateSwitchChange(e) {
    const checked = e.detail.value
    
    // 如果用户要开启立即上门，显示二次确认
    if (checked) {
      const tipText = this.data.urgentTipText || '立即上门服务说明'
      wx.showModal({
        title: '提示',
        content: tipText,
        confirmText: '确认',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户确认，开启立即上门
            this.setData({ timeType: 'immediate' })
            this.setImmediateTime()
          } else {
            // 用户取消，保持关闭状态，需要重置switch
            // 由于switch已经改变了，我们需要通过设置timeType来重置
            // 但这里有个问题，switch的状态已经改变了，我们需要手动重置
            // 可以通过延迟设置来确保switch状态正确
            setTimeout(() => {
              // 不设置timeType，因为已经是appointment了
              // 但需要确保switch显示为关闭状态
            }, 50)
          }
        }
      })
    } else {
      // 关闭立即上门，直接切换
      this.setData({ timeType: 'appointment' })
      // 预约时间：初始化时间选择器
      this.initTimeSlots()
    }
  },

  // 设置立即上门时间（当前时间到半小时后）
  setImmediateTime() {
    const now = new Date()
    const startTime = new Date(now)
    const endTime = new Date(now.getTime() + 30 * 60 * 1000) // 半小时后
    
    const formatTime = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}:00`
    }
    
    const formatDisplayTime = (date) => {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    
    const startTimeStr = formatTime(startTime)
    const endTimeStr = formatTime(endTime)
    const displayText = `立即上门（${formatDisplayTime(startTime)} - ${formatDisplayTime(endTime)}）`
    
    this.setData({
      'form.startTime': startTimeStr,
      'form.endTime': endTimeStr,
      'form.startTimeStr': displayText
    })
    
    // 更新提交状态
    this.updateCanSubmit()
  },

  // 初始化时间选择器（预约时间）
  async initTimeSlots() {
    const now = new Date()
    
    // 初始化日期选项（今天、明天）
    const dateOptions = [
      { label: '今天', isToday: true },
      { label: '明天', isToday: false }
    ]
    
    // 从后端获取可预约时间范围
    let appointmentTimeRange = '09:00-18:00' // 默认值
    try {
      const res = await api.getRecyclingAppointmentTime()
      if (res.success && res.data) {
        appointmentTimeRange = res.data
      }
    } catch (e) {
      console.error('获取可预约时间配置失败:', e)
    }
    
    // 解析时间范围（格式：HH:mm-HH:mm）
    const [startTimeStr, endTimeStr] = appointmentTimeRange.split('-')
    const [startHour, startMinute] = startTimeStr.split(':').map(Number)
    const [endHour, endMinute] = endTimeStr.split(':').map(Number)
    const configStartMinutes = startHour * 60 + startMinute
    const configEndMinutes = endHour * 60 + endMinute
    
    // 计算今天的起始时间
    let todayStartHour = now.getHours()
    let todayStartMinute = now.getMinutes()
    let todayHasSlots = true
    
    // 计算今天的起始时间：从下一个半小时开始，但不能早于配置的开始时间
    if (todayStartMinute > 0 && todayStartMinute < 30) {
      todayStartMinute = 30
    } else if (todayStartMinute >= 30) {
      todayStartHour += 1
      if (todayStartHour >= 24) {
        todayHasSlots = false
        todayStartHour = startHour
        todayStartMinute = startMinute
      } else {
        todayStartMinute = 0
      }
    } else {
      todayStartMinute = 30
    }
    
    // 确保今天的起始时间不早于配置的开始时间
    const todayStartMinutes = todayStartHour * 60 + todayStartMinute
    if (todayStartMinutes < configStartMinutes) {
      todayStartHour = startHour
      todayStartMinute = startMinute
    } else if (todayStartMinutes >= configEndMinutes) {
      // 如果当前时间已经超过配置的结束时间，今天没有可选时间段
      todayHasSlots = false
    }
    
    // 生成时间段选项（30分钟一个时间段）
    // 今天的时间段
    const todaySlots = []
    if (todayHasSlots) {
      const actualStartMinutes = Math.max(todayStartHour * 60 + todayStartMinute, configStartMinutes)
      const actualStartHour = Math.floor(actualStartMinutes / 60)
      const actualStartMin = actualStartMinutes % 60
      
      for (let hour = actualStartHour; hour <= endHour; hour++) {
        const minStart = (hour === actualStartHour ? actualStartMin : 0)
        const minEnd = (hour === endHour ? endMinute : 60)
        
        for (let minute = minStart; minute < minEnd; minute += 30) {
          const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
          let endHour = hour
          let endMinute = minute + 30
          if (endMinute >= 60) {
            endHour += 1
            endMinute = 0
          }
          // 如果结束时间超过配置的结束时间，跳过
          const endMinutes = endHour * 60 + endMinute
          if (endMinutes > configEndMinutes) {
            break
          }
          const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
          todaySlots.push({
            label: `${startTime} - ${endTime}`,
            startTime: startTime,
            endTime: endTime,
            isToday: true,
            available: true,
            disabled: false
          })
        }
      }
    }
    
    // 明天的时间段（从配置的开始时间到结束时间）
    const tomorrowSlots = []
    for (let hour = startHour; hour <= endHour; hour++) {
      const minStart = (hour === startHour ? startMinute : 0)
      const minEnd = (hour === endHour ? endMinute : 60)
      
      for (let minute = minStart; minute < minEnd; minute += 30) {
        const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        let endHour = hour
        let endMinute = minute + 30
        if (endMinute >= 60) {
          endHour += 1
          endMinute = 0
        }
        // 如果结束时间超过配置的结束时间，跳过
        const endMinutes = endHour * 60 + endMinute
        if (endMinutes > configEndMinutes) {
          break
        }
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
        tomorrowSlots.push({
          label: `${startTime} - ${endTime}`,
          startTime: startTime,
          endTime: endTime,
          isToday: false,
          available: true,
          disabled: false
        })
      }
    }
    
    // 设置默认选项
    const defaultTimeSlotOptions = todaySlots.length > 0 ? todaySlots : tomorrowSlots
    const defaultDateIndex = todaySlots.length > 0 ? 0 : 1
    
    this.setData({
      dateOptions,
      todayTimeSlots: todaySlots,
      tomorrowTimeSlots: tomorrowSlots,
      timeSlotOptions: defaultTimeSlotOptions,
      selectedDateIndex: defaultDateIndex
    })
    
    // 检查所有时间段的可用性（需要先选择回收点）
    // 如果已选择回收点，则检查可用性；否则在回收点加载后会自动检查
    if (this.data.selectedRecyclingPointId) {
      this.checkAllTimeSlotsAvailability()
    }
    
    // 默认选择第一个可用时间段
    if (defaultTimeSlotOptions.length > 0) {
      const firstAvailableSlot = defaultTimeSlotOptions.find(slot => slot.available && !slot.disabled)
      if (firstAvailableSlot) {
        const firstIndex = defaultTimeSlotOptions.indexOf(firstAvailableSlot)
        const isToday = defaultDateIndex === 0
        
        const startTime = this.formatDateTime(firstAvailableSlot.startTime, !isToday)
        const endTime = this.formatDateTime(firstAvailableSlot.endTime, !isToday)
        
        const dateLabel = defaultDateIndex === 0 ? '今天' : '明天'
        const displayText = `${dateLabel} ${firstAvailableSlot.label}`
        
        this.setData({
          selectedTimeSlotIndex: firstIndex,
          'form.startTime': startTime,
          'form.endTime': endTime,
          'form.startTimeStr': displayText
        })
        
        // 更新提交状态
        this.updateCanSubmit()
      }
    }
  },

  // 检查所有时间段的可用性（使用后端批量接口）
  async checkAllTimeSlotsAvailability() {
    if (this.data.checkingAvailability) return
    // 如果没有选择回收点，不检查可用性
    if (!this.data.selectedRecyclingPointId) {
      console.log('未选择回收点，跳过时间段可用性检查')
      return
    }
    this.setData({ checkingAvailability: true })
    
    try {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      // 格式化日期为 yyyy-MM-dd
      const formatDate = (date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      
      const todayStr = formatDate(today)
      const tomorrowStr = formatDate(tomorrow)
      
      // 并行获取今天和明天的时间段列表
      const [todayRes, tomorrowRes] = await Promise.all([
        api.getTimeSlotList(3, todayStr, null, this.data.selectedRecyclingPointId),
        api.getTimeSlotList(3, tomorrowStr, null, this.data.selectedRecyclingPointId)
      ])
      
      // 更新今天的时间段
      if (todayRes.success && todayRes.data && todayRes.data.timeSlots) {
        const updatedTodaySlots = todayRes.data.timeSlots.map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          isToday: true,
          available: slot.available,
          disabled: !slot.available,
          label: !slot.available ? `${slot.startTime} - ${slot.endTime} (已约满)` : `${slot.startTime} - ${slot.endTime}`
        }))
        this.setData({ todayTimeSlots: updatedTodaySlots })
      }
      
      // 更新明天的时间段
      if (tomorrowRes.success && tomorrowRes.data && tomorrowRes.data.timeSlots) {
        const updatedTomorrowSlots = tomorrowRes.data.timeSlots.map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          isToday: false,
          available: slot.available,
          disabled: !slot.available,
          label: !slot.available ? `${slot.startTime} - ${slot.endTime} (已约满)` : `${slot.startTime} - ${slot.endTime}`
        }))
        this.setData({ tomorrowTimeSlots: updatedTomorrowSlots })
      }
      
      // 更新当前显示的时间段选项
      const currentDateIndex = this.data.selectedDateIndex
      const currentTimeSlotOptions = currentDateIndex === 0 ? this.data.todayTimeSlots : this.data.tomorrowTimeSlots
      this.setData({ timeSlotOptions: currentTimeSlotOptions })
    } catch (e) {
      console.error('获取时间段列表失败:', e)
    } finally {
      this.setData({ checkingAvailability: false })
    }
  },

  // 日期选择变化
  onDateChange(e) {
    const index = parseInt(e.detail.value)
    const isToday = index === 0
    
    // 根据选择的日期更新时间段选项
    const timeSlotOptions = isToday ? this.data.todayTimeSlots : this.data.tomorrowTimeSlots
    
    // 自动选择第一个可用时间段
    const firstAvailableSlot = timeSlotOptions.find(slot => slot.available && !slot.disabled)
    let selectedIndex = -1
    let startTime = null
    let endTime = null
    let startTimeStr = ''
    
    if (firstAvailableSlot) {
      selectedIndex = timeSlotOptions.indexOf(firstAvailableSlot)
      startTime = this.formatDateTime(firstAvailableSlot.startTime, !isToday)
      endTime = this.formatDateTime(firstAvailableSlot.endTime, !isToday)
      const dateLabel = index === 0 ? '今天' : '明天'
      startTimeStr = `${dateLabel} ${firstAvailableSlot.label}`
    }
    
    this.setData({
      selectedDateIndex: index,
      timeSlotOptions,
      selectedTimeSlotIndex: selectedIndex,
      'form.startTime': startTime,
      'form.endTime': endTime,
      'form.startTimeStr': startTimeStr
    })
    
    // 更新提交状态
    this.updateCanSubmit()
  },

  // 时间段选择变化
  onTimeSlotChange(e) {
    const index = parseInt(e.detail.value)
    const timeSlot = this.data.timeSlotOptions[index]
    if (!timeSlot) return
    
    // 检查是否已约满
    if (timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
      // 重置选择
      this.setData({
        selectedTimeSlotIndex: -1,
        'form.startTime': null,
        'form.endTime': null,
        'form.startTimeStr': ''
      })
      this.updateCanSubmit()
      return
    }
    
    const isToday = this.data.selectedDateIndex === 0
    const startTime = this.formatDateTime(timeSlot.startTime, !isToday)
    const endTime = this.formatDateTime(timeSlot.endTime, !isToday)
    
    const dateLabel = this.data.selectedDateIndex === 0 ? '今天' : '明天'
    const displayText = `${dateLabel} ${timeSlot.label}`
    
    this.setData({
      selectedTimeSlotIndex: index,
      'form.startTime': startTime,
      'form.endTime': endTime,
      'form.startTimeStr': displayText
    })
    
    // 更新提交状态
    this.updateCanSubmit()
  },

  // 显示时间选择器弹窗
  showTimePicker() {
    this.setData({ showTimePickerModal: true })
  },

  // 隐藏时间选择器弹窗
  hideTimePicker() {
    this.setData({ showTimePickerModal: false })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 选择日期（弹窗中）
  selectDate(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const isToday = index === 0
    
    // 根据选择的日期更新时间段选项
    const timeSlotOptions = isToday ? this.data.todayTimeSlots : this.data.tomorrowTimeSlots
    
    // 重置时间段选择
    this.setData({
      selectedDateIndex: index,
      timeSlotOptions,
      selectedTimeSlotIndex: -1
    })
  },

  // 选择时间段（弹窗中）
  selectTimeSlot(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const timeSlot = this.data.timeSlotOptions[index]
    if (!timeSlot) return
    
    // 检查是否已约满
    if (timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
      return
    }
    
    this.setData({
      selectedTimeSlotIndex: index
    })
  },

  // 确认时间选择
  confirmTimeSelection() {
    if (this.data.selectedDateIndex < 0 || this.data.selectedTimeSlotIndex < 0) {
      wx.showToast({ title: '请选择日期和时间段', icon: 'none' })
      return
    }
    
    const timeSlot = this.data.timeSlotOptions[this.data.selectedTimeSlotIndex]
    if (!timeSlot || timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
      return
    }
    
    // 计算开始和结束时间
    const isToday = this.data.selectedDateIndex === 0
    const startTime = this.formatDateTime(timeSlot.startTime, !isToday)
    const endTime = this.formatDateTime(timeSlot.endTime, !isToday)
    const dateLabel = isToday ? '今天' : '明天'
    const startTimeStr = `${dateLabel} ${timeSlot.label}`
    
    this.setData({
      'form.startTime': startTime,
      'form.endTime': endTime,
      'form.startTimeStr': startTimeStr,
      showTimePickerModal: false
    })
    
    // 更新提交状态
    this.updateCanSubmit()
  },

  // 格式化日期时间（用于提交）
  formatDateTime(timeStr, isTomorrow) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate() + (isTomorrow ? 1 : 0)).padStart(2, '0')
    return `${year}-${month}-${day}T${timeStr}:00`
  },

  // 选择图片
  async chooseImages() {
    const remainingCount = 9 - this.data.form.images.length
    if (remainingCount <= 0) {
      wx.showToast({ title: '最多只能上传9张图片', icon: 'none' })
      return
    }
    
    try {
      wx.chooseImage({
        count: remainingCount,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const tempFilePaths = res.tempFilePaths
          wx.showLoading({ title: '上传图片中...', mask: true })
          
          try {
            // 上传所有图片
            const uploadPromises = tempFilePaths.map(filePath => 
              api.uploadImage(filePath, 'recycling')
            )
            
            const uploadResults = await Promise.all(uploadPromises)
            
            // 获取所有上传成功的URL
            const uploadedUrls = uploadResults
              .filter(result => result.success)
              .map(result => result.data.url)
            
            if (uploadedUrls.length > 0) {
              const images = [...this.data.form.images, ...uploadedUrls]
              this.setData({ 'form.images': images })
              wx.showToast({ title: `成功上传${uploadedUrls.length}张图片`, icon: 'success' })
            } else {
              wx.showToast({ title: '图片上传失败', icon: 'none' })
            }
          } catch (e) {
            console.error('上传图片失败:', e)
            wx.showToast({ title: e.error || '上传失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      })
    } catch (e) {
      console.error('选择图片失败:', e)
    }
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    const index = e.currentTarget.dataset.index
    const urls = this.data.form.images
    
    wx.previewImage({
      current: url,
      urls: urls
    })
  },

  // 删除图片
  deleteImage(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const images = this.data.form.images.filter((_, i) => i !== index)
    this.setData({ 'form.images': images })
  },

  // 输入物品备注
  onInputItemRemark(e) {
    this.setData({
      'form.itemDescription': e.detail.value
    })
  },

  // 添加快捷选项到物品备注
  addQuickOption(e) {
    const quickText = e.currentTarget.dataset.text
    const currentText = this.data.form.itemDescription || ''
    
    // 如果当前文本为空，直接添加
    if (!currentText.trim()) {
      this.setData({
        'form.itemDescription': quickText
      })
      return
    }
    
    // 检查是否已经包含该快捷选项
    if (currentText.includes(quickText)) {
      wx.showToast({ title: '已添加该选项', icon: 'none', duration: 1000 })
      return
    }
    
    // 追加到现有文本，用空格分隔
    const newText = currentText.trim() + ' ' + quickText
    this.setData({
      'form.itemDescription': newText
    })
  },

  // 验证表单
  validateForm() {
    if (!this.data.selectedAddressId) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return false
    }
    
    if (!this.data.selectedRecyclingPointId) {
      wx.showToast({ title: '未找到服务该地址的回收点', icon: 'none' })
      return false
    }
    
    // 加急订单不需要验证时间段
    if (this.data.timeType !== 'immediate') {
      if (!this.data.form.startTime || !this.data.form.endTime) {
        wx.showToast({ title: '请选择上门时间范围', icon: 'none' })
        return false
      }
      
      // 检查选择的时间段是否已约满
      const selectedTimeSlot = this.data.timeSlotOptions[this.data.selectedTimeSlotIndex]
      if (selectedTimeSlot && (selectedTimeSlot.disabled || !selectedTimeSlot.available)) {
        wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
        return false
      }
    }
    
    return true
  },

  // 请求订阅消息（回收订单相关模板）
  requestSubscribeMessage() {
    return new Promise((resolve, reject) => {
      try {
        // 检查本地存储的订阅状态
        const subscribeMessageEnabled = wx.getStorageSync('subscribeMessageEnabled') || false
        console.log('[订阅消息] 检查本地订阅状态:', subscribeMessageEnabled)
        
        // 回收订单需要的3个模板ID（从后端配置获取，这里先写死，后续可以从配置读取）
        const templateIds = [
          '7IfJ7IfgtnW3E4Uk3_Qo7u0Wl1G3tbC-YSkUyI1OcIU', // 回收接单通知
          'OJjEEmIA8Xds_T7e4EIgqetyapvN3kuWFOBUZ6DuF5I', // 回收完成通知
          '_gggIVf5Waysat8jkKkMjz_BsUz6Pd9MCQlm01KWlzU'  // 回收打款通知
        ]
        
        // 如果已启用，直接调用订阅接口（不会弹窗，静默通过）
        if (subscribeMessageEnabled) {
          console.log('[订阅消息] 用户已启用订阅，静默调用订阅接口（不会弹窗）')
          wx.requestSubscribeMessage({
            tmplIds: templateIds,
            success: (res) => {
              console.log('[订阅消息] 静默调用成功（已启用，不弹窗）:', JSON.stringify(res))
              // 验证静默调用的结果（应该都是accept，因为用户已勾选"总是保持以上选择"）
              if (res.errMsg === 'requestSubscribeMessage:ok') {
                const allAccepted = templateIds.every(tmplId => res[tmplId] === 'accept')
                if (allAccepted) {
                  console.log('[订阅消息] ✅ 静默调用验证通过，所有模板都已接受')
                  resolve(res)
                } else {
                  console.warn('[订阅消息] ⚠️ 静默调用结果异常，部分模板未接受:', res)
                  // 如果静默调用失败，清除本地状态，下次重新弹窗
                  wx.removeStorageSync('subscribeMessageEnabled')
                  api.updateSubscribeMessageStatusByType(3, false).catch(e => {
                    console.error('[订阅消息] 更新后端状态失败:', e)
                  })
                  resolve(res) // 仍然resolve，不阻塞下单流程
                }
              } else {
                resolve(res) // 仍然resolve，不阻塞下单流程
              }
            },
            fail: (res) => {
              console.error('[订阅消息] 静默调用失败:', JSON.stringify(res))
              // 静默调用失败，清除本地状态，下次重新弹窗
              wx.removeStorageSync('subscribeMessageEnabled')
              api.updateSubscribeMessageStatusByType(3, false).catch(e => {
                console.error('[订阅消息] 更新后端状态失败:', e)
              })
              resolve(res) // 仍然resolve，不阻塞下单流程
            }
          })
          return
        }
        
        // 如果未启用，弹窗让用户订阅
        console.log('[订阅消息] 用户未启用订阅，弹窗让用户订阅')
        console.log('[订阅消息] 准备请求的模板ID列表:', templateIds)
        console.log('[订阅消息] 模板数量:', templateIds.length)
        
        // 注意：wx.requestSubscribeMessage 必须在用户点击手势的同步调用链中执行
        // 不能在 setTimeout、Promise.then 等异步操作中调用
        console.log('[订阅消息] 开始调用 wx.requestSubscribeMessage（必须在用户点击的同步调用链中）')
        wx.requestSubscribeMessage({
          tmplIds: templateIds,
          success: (res) => {
            console.log('[订阅消息] 订阅消息弹窗结果:', JSON.stringify(res))
            console.log('[订阅消息] 弹窗已关闭，用户操作完成')
            
            // 检查res中的errMsg
            if (res.errMsg !== 'requestSubscribeMessage:ok') {
              console.log('[订阅消息] ⚠️ 订阅消息调用异常:', res.errMsg)
              resolve(res) // 仍然resolve，不阻塞下单流程
              return
            }
            
            // 检查每个模板ID的订阅结果（res中每个模板ID作为key，值为'accept'、'reject'、'ban'、'filter'）
            const templateResults = {}
            let hasAnyAccept = false
            let hasAnyReject = false
            const filteredTemplates = [] // 记录被过滤的模板
            
            for (const tmplId of templateIds) {
              const status = res[tmplId]
              templateResults[tmplId] = status || 'unknown'
              
              // 检查模板状态
              if (status === 'filter') {
                filteredTemplates.push(tmplId)
                console.warn(`[订阅消息] ⚠️ 模板被过滤（标题可能重复）: ${tmplId}`)
              } else if (status === 'accept') {
                hasAnyAccept = true
              } else if (status === 'reject') {
                hasAnyReject = true
              } else if (status === 'ban') {
                console.warn(`[订阅消息] ⚠️ 模板被封禁: ${tmplId}`)
              } else if (!status || status === 'unknown') {
                console.warn(`[订阅消息] ⚠️ 模板未返回状态（可能不存在或类型不对应）: ${tmplId}`)
              }
            }
            
            // 统计实际显示的模板数量
            const displayedCount = Object.keys(templateResults).filter(
              tmplId => templateResults[tmplId] !== 'unknown' && templateResults[tmplId] !== 'filter'
            ).length
            
            console.log('[订阅消息] 各模板订阅结果:', JSON.stringify(templateResults))
            console.log('[订阅消息] 实际显示的模板数量:', displayedCount, '/', templateIds.length)
            console.log('[订阅消息] 是否有接受:', hasAnyAccept, '是否有拒绝:', hasAnyReject)
            
            // 如果有模板被过滤，提示用户
            if (filteredTemplates.length > 0) {
              console.error('[订阅消息] ❌ 以下模板被过滤（标题重复）:', filteredTemplates)
              console.error('[订阅消息] ❌ 请检查微信公众平台中这些模板的标题是否相同')
              console.error('[订阅消息] ❌ 微信规则：一次授权调用里，每个tmplId对应的模板标题不能存在相同的')
            }
            
            // 如果实际显示的模板数量少于请求的数量，提示用户
            if (displayedCount < templateIds.length) {
              const missingCount = templateIds.length - displayedCount
              console.warn(`[订阅消息] ⚠️ 警告：请求了 ${templateIds.length} 个模板，但只显示了 ${displayedCount} 个`)
              console.warn(`[订阅消息] ⚠️ 可能原因：`)
              console.warn(`[订阅消息] ⚠️ 1. 模板标题重复（被过滤）`)
              console.warn(`[订阅消息] ⚠️ 2. 模板ID不存在或类型不对应`)
              console.warn(`[订阅消息] ⚠️ 3. 模板类型不一致（一次性模板和永久模板不能同时使用）`)
            }
            
            // 如果用户接受了至少一个模板，检查是否勾选了"总是保持以上选择"
            if (hasAnyAccept) {
              console.log('[订阅消息] 用户接受了订阅，开始检查是否勾选了"总是保持以上选择"')
              wx.getSetting({
                withSubscriptions: true,
                success: (settingRes) => {
                  const subscriptionsSetting = settingRes.subscriptionsSetting
                  
                  // 检查订阅消息总开关
                  if (subscriptionsSetting?.mainSwitch === false) {
                    console.log('[订阅消息] ⚠️ 用户关闭了订阅消息总开关')
                    resolve(res) // 仍然resolve，不阻塞下单流程
                    return
                  }
                  
                  const itemSettings = subscriptionsSetting?.itemSettings || {}
                  
                  console.log('[订阅消息] 订阅设置详情:', JSON.stringify({
                    mainSwitch: subscriptionsSetting?.mainSwitch,
                    itemSettings: itemSettings,
                    itemSettingsKeys: Object.keys(itemSettings)
                  }))
                  
                  // 检查所有模板ID是否都在 itemSettings 中，且值为 'accept'
                  // 注意：itemSettings 只返回用户勾选了"总是保持以上选择"的订阅消息
                  let allAccepted = true
                  const templateStatus = {}
                  for (const tmplId of templateIds) {
                    const status = itemSettings[tmplId]
                    templateStatus[tmplId] = status || 'not_found'
                    // 只有当模板ID在itemSettings中且值为'accept'时，才认为用户勾选了"总是保持以上选择"
                    if (status !== 'accept') {
                      allAccepted = false
                    }
                  }
                  
                  console.log('[订阅消息] 各模板在itemSettings中的状态:', JSON.stringify(templateStatus))
                  console.log('[订阅消息] 是否所有模板都勾选了"总是保持以上选择":', allAccepted)
                  
                  // 如果所有模板都在itemSettings中且值为'accept'，说明用户勾选了"总是保持以上选择"
                  if (allAccepted && templateIds.every(tmplId => itemSettings.hasOwnProperty(tmplId))) {
                    console.log('[订阅消息] ✅ 用户勾选了"总是保持以上选择"，准备更新后端状态（回收订单 serviceType=3）')
                    // 更新后端状态（回收订单 serviceType = 3）
                    api.updateSubscribeMessageStatusByType(3, true).then(() => {
                      // 保存到本地存储
                      wx.setStorageSync('subscribeMessageEnabled', true)
                      console.log('[订阅消息] ✅ 订阅消息状态已更新为启用（后端+本地存储）')
                      resolve(res) // 用户操作完成，resolve Promise
                    }).catch((e) => {
                      console.error('[订阅消息] ❌ 更新订阅消息状态失败:', e)
                      resolve(res) // 即使更新失败也resolve，不阻塞下单流程
                    })
                  } else {
                    console.log('[订阅消息] ⚠️ 用户未勾选"总是保持以上选择"')
                    console.log('[订阅消息] 原因分析:', {
                      allAccepted: allAccepted,
                      templateStatus: templateStatus,
                      itemSettings: itemSettings
                    })
                    // 用户未勾选，更新后端状态为false（回收订单 serviceType = 3）
                    api.updateSubscribeMessageStatusByType(3, false).catch(e => {
                      console.error('[订阅消息] ❌ 更新订阅消息状态失败:', e)
                    })
                    resolve(res) // 用户操作完成，resolve Promise
                  }
                },
                fail: (e) => {
                  console.error('[订阅消息] ❌ 获取订阅设置失败:', e)
                  resolve(res) // 即使获取设置失败也resolve，不阻塞下单流程
                }
              })
            } else if (hasAnyReject) {
              console.log('[订阅消息] ⚠️ 用户拒绝了订阅')
              resolve(res) // 用户操作完成，resolve Promise
            } else {
              console.log('[订阅消息] ⚠️ 订阅结果异常，无法判断用户操作')
              resolve(res) // 仍然resolve，不阻塞下单流程
            }
          },
          fail: (res) => {
            console.error('[订阅消息] ❌ 订阅消息调用失败:', JSON.stringify(res))
            // 处理错误码
            if (res.errCode) {
              const errorMessages = {
                10001: '参数传空了',
                10002: '网络问题，请求消息列表失败',
                10003: '网络问题，订阅请求发送失败',
                10004: '参数类型错误',
                10005: '无法展示UI，小程序可能退后台了',
                20001: '没有模板数据，模板ID不存在或类型不对应',
                20002: '模板消息类型既有一次性的又有永久的',
                20003: '模板消息数量超过上限',
                20004: '用户关闭了主开关，无法进行订阅',
                20005: '小程序被禁封',
                20013: '不允许通过该接口订阅设备消息'
              }
              console.error('[订阅消息] 错误码:', res.errCode, '错误说明:', errorMessages[res.errCode] || '未知错误')
            }
            resolve(res) // 即使失败也resolve，不阻塞下单流程
          }
        })
      } catch (e) {
        console.error('[订阅消息] ❌ 请求订阅消息异常:', e)
        // 订阅失败不影响下单流程，继续执行
        resolve(null) // 异常时也resolve，不阻塞下单流程
      }
    })
  },

  // 提交订单
  async submitOrder() {
    if (!this.validateForm()) {
      return
    }
    
    // 如果地址不在服务范围内，提示用户
    if (!this.data.recyclingPointName) {
      wx.showModal({
        title: '提示',
        content: '该地址不在服务范围内，无法提交订单',
        showCancel: false
      })
      return
    }
    
    // 在下单前请求订阅消息
    // 注意：必须在用户点击的同步调用链中调用 wx.requestSubscribeMessage
    // 先隐藏loading，确保订阅弹窗不被遮挡
    wx.hideLoading()
    
    // 先查询后端订阅状态（回收订单 serviceType = 3）
    let subscribeMessageEnabled = false
    try {
      const statusRes = await api.getSubscribeMessageStatus(3)
      if (statusRes.success && statusRes.data) {
        subscribeMessageEnabled = statusRes.data.enabled === true
        console.log('[订阅消息] 查询后端订阅状态:', subscribeMessageEnabled, '说明:', subscribeMessageEnabled ? '用户已勾选"总是保持以上选择"，不弹窗' : '用户未勾选"总是保持以上选择"，需要弹窗')
        // 同步更新本地存储
        wx.setStorageSync('subscribeMessageEnabled', subscribeMessageEnabled)
      } else {
        // 查询失败，使用本地存储作为fallback
        subscribeMessageEnabled = wx.getStorageSync('subscribeMessageEnabled') || false
        console.log('[订阅消息] 查询后端订阅状态失败，使用本地存储:', subscribeMessageEnabled)
      }
    } catch (e) {
      // 查询异常，使用本地存储作为fallback
      subscribeMessageEnabled = wx.getStorageSync('subscribeMessageEnabled') || false
      console.error('[订阅消息] 查询后端订阅状态异常:', e, '使用本地存储:', subscribeMessageEnabled)
    }
    
    if (!subscribeMessageEnabled) {
      console.log('[订阅消息] 准备显示订阅消息弹窗')
    } else {
      console.log('[订阅消息] 用户已勾选"总是保持以上选择"，静默调用订阅接口（不弹窗）')
    }
    
    // 同步调用 requestSubscribeMessage（内部会根据 subscribeMessageEnabled 决定是否弹窗）
    // Promise 的 resolve 会在 success/fail 回调中异步执行
    await this.requestSubscribeMessage()
    
    const isUrgent = this.data.timeType === 'immediate'
    
    // 再次检查时间段是否已约满（防止用户通过其他方式选择了已约满的时间）
    if (!isUrgent) {
      const selectedTimeSlot = this.data.timeSlotOptions[this.data.selectedTimeSlotIndex]
      if (selectedTimeSlot && (selectedTimeSlot.disabled || !selectedTimeSlot.available)) {
        wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
        // 重置选择
        this.setData({
          selectedTimeSlotIndex: -1,
          'form.startTime': null,
          'form.endTime': null,
          'form.startTimeStr': ''
        })
        this.updateCanSubmit()
        return
      }
      
      // 提交前再次检查时间段可用性（防止在用户选择后时间段被其他用户占用）
      if (this.data.form.startTime && this.data.form.endTime) {
        try {
          // 3=上门回收，需要传递recyclingPointId
          const checkRes = await api.checkTimeSlotAvailability(3, this.data.form.startTime, this.data.form.endTime, null, this.data.selectedRecyclingPointId)
          console.log('提交前检查时间段可用性结果:', checkRes)
          // 注意：checkRes.data 是 {available: true/false, message: "..."}
          if (!checkRes.success || !checkRes.data?.available) {
            wx.showToast({ 
              title: checkRes.data?.message || checkRes.message || '该时间段已约满，请选择其他时间段', 
              icon: 'none' 
            })
            // 重置选择
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
          console.error('检查时间段可用性失败:', e)
          // 检查失败不影响提交，继续提交让后端验证
        }
      }
    }
    
    try {
      wx.showLoading({ title: '提交中...' })
      
      const payload = {
        addressId: this.data.selectedAddressId,
        // 加急订单不传时间，后端自动计算
        startTime: isUrgent ? null : this.data.form.startTime,
        endTime: isUrgent ? null : this.data.form.endTime,
        // 后端需要这些字段，但前端已隐藏，传默认值
        estWeight: null,
        itemDescription: this.data.form.itemDescription && this.data.form.itemDescription.trim() ? this.data.form.itemDescription.trim() : '废品回收',
        // 回收点ID（如果前端没有选择，后端会根据地址自动选择第一个）
        recyclingPointId: this.data.selectedRecyclingPointId,
        // 是否加急（立即上门）
        isUrgent: isUrgent
      }
      
      // 如果有图片，添加到请求中
      if (this.data.form.images && this.data.form.images.length > 0) {
        payload.images = this.data.form.images
      }
      
      console.log('提交订单数据:', payload)
      
      const res = await api.createRecyclingOrder(payload)
      
      console.log('提交订单响应:', res)
      
      if (res.success) {
        console.log('订单提交成功')
        const orderNo = res.data?.orderNo || res.data?.order?.orderNo || res.orderNo
        console.log('订单号:', orderNo)
        // createRecyclingOrder 已经设置了 showSuccess: true，会自动显示成功提示
        // 但为了确保用户体验，我们仍然显示一次
        wx.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => {
          if (orderNo) {
            wx.redirectTo({
              url: `/pages/recycling-detail/index?orderNo=${orderNo}`
            })
          } else {
            wx.redirectTo({
              url: '/pages/orders/index'
            })
          }
        }, 800)
      } else {
        console.log('订单提交失败（success=false）:', res)
        // 如果 success 为 false，但进入了这里（不应该发生，因为会 reject），显示错误
        wx.showToast({ 
          title: res.message || res.error || '提交失败', 
          icon: 'none',
          duration: 2000
        })
      }
    } catch (e) {
      console.error('提交订单异常:', e)
      // 优先显示后端返回的错误消息
      const errorMsg = e.message || e.error || '提交失败，请稍后重试'
      console.log('显示错误消息:', errorMsg)
      wx.showToast({ 
        title: errorMsg, 
        icon: 'none',
        duration: 2000
      })
    } finally {
      console.log('提交流程结束，隐藏loading')
      wx.hideLoading()
    }
  },

  // 分享给好友
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    const sharePath = app.getSharePath()
    const shareConfig = {
      title: '喵上门 - 便捷的生活服务小程序',
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

})

