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
    todayRecyclePrice: null, // 最低价格（从后端获取）
    todayRecyclePriceMax: '5', // 最高价格（固定值）
    todayRecyclePriceText: '',
    
    // 提交状态标记，防止重复提交
    isSubmitting: false
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
        
        // 自动选择第一个回收点后，重新初始化时间段并检查可用性
        if (selectedRecyclingPointId) {
          this.initTimeSlots()
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
            todayRecyclePriceText: '今日回收价格'
          })
          return
        }
      }
      // 未配置价格时，使用默认值0.65
      this.setData({
        todayRecyclePrice: '0.65',
        todayRecyclePriceText: '今日回收价格'
      })
    } catch (e) {
      console.error('加载今日回收价格失败:', e)
      // 获取失败时使用默认值
      this.setData({
        todayRecyclePrice: '0.65',
        todayRecyclePriceText: '今日回收价格'
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
    
    // 优先使用选中回收点的营业时间，如果没有选中回收点则使用系统配置
    let appointmentTimeRange = '09:00-18:00' // 默认值
    if (this.data.selectedRecyclingPointId && this.data.recyclingPointList && this.data.recyclingPointList.length > 0) {
      // 找到选中的回收点
      const selectedRecyclingPoint = this.data.recyclingPointList.find(rp => rp.id === this.data.selectedRecyclingPointId)
      if (selectedRecyclingPoint && selectedRecyclingPoint.startTime && selectedRecyclingPoint.endTime) {
        // 使用回收点的营业时间（格式：HH:mm:ss，需要转换为 HH:mm）
        const startTime = selectedRecyclingPoint.startTime.substring(0, 5) // 取前5位 HH:mm
        const endTime = selectedRecyclingPoint.endTime.substring(0, 5) // 取前5位 HH:mm
        appointmentTimeRange = `${startTime}-${endTime}`
      }
    }
    
    // 如果没有选中回收点或回收点没有营业时间，从系统配置获取
    if (appointmentTimeRange === '09:00-18:00') {
    try {
      const res = await api.getRecyclingAppointmentTime()
      if (res.success && res.data) {
        appointmentTimeRange = res.data
      }
    } catch (e) {
      console.error('获取可预约时间配置失败:', e)
      }
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
    return new Promise((resolve) => {
      try {
        const templateIds = [
          '7IfJ7IfgtnW3E4Uk3_Qo7u0Wl1G3tbC-YSkUyI1OcIU', // 回收接单通知
          'OJjEEmIA8Xds_T7e4EIgqetyapvN3kuWFOBUZ6DuF5I', // 回收完成通知
          '_gggIVf5Waysat8jkKkMjz_BsUz6Pd9MCQlm01KWlzU'  // 回收打款通知
        ]
        
        // 弹窗让用户订阅
        wx.requestSubscribeMessage({
          tmplIds: templateIds,
          success: (res) => {
            console.log('[订阅消息] 回收订单订阅结果:', JSON.stringify(res))
            // 输出每个模板的订阅状态
            templateIds.forEach(tmplId => {
              const status = res[tmplId]
              if (status) {
                console.log(`[订阅消息] 模板 ${tmplId}: ${status}`)
              }
            })
            resolve(res)
          },
          fail: (res) => {
            console.error('[订阅消息] 调用失败:', res.errMsg)
            resolve(res)
          }
        })
      } catch (e) {
        console.error('[订阅消息] 异常:', e)
        resolve(null)
      }
    })
  },

  // 提交订单
  async submitOrder() {
    // 防止重复提交
    if (this.data.isSubmitting) {
      console.log('订单正在提交中，请勿重复点击')
      return
    }
    
    if (!this.validateForm()) {
      return
    }
    
    // 设置提交状态，禁用按钮
    this.setData({ isSubmitting: true })
    
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
    wx.hideLoading()
    
    // 同步调用 requestSubscribeMessage
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
        // 注意：跳转后不需要重置isSubmitting，因为页面会被销毁
      } else {
        console.log('订单提交失败（success=false）:', res)
        // 如果 success 为 false，但进入了这里（不应该发生，因为会 reject），显示错误
        wx.showToast({ 
          title: res.message || res.error || '提交失败', 
          icon: 'none',
          duration: 2000
        })
        // 重置提交状态，允许重新提交
        this.setData({ isSubmitting: false })
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
      // 重置提交状态，允许重新提交
      this.setData({ isSubmitting: false })
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
    const shareTitle = app.getShareTitle()
    const shareConfig = {
      title: shareTitle, // 使用配置的分享标题
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

})

