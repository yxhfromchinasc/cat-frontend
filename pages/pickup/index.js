// pages/pickup/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    // 当前选择的地址（从首页传入）
    currentAddress: null,
    
    // 驿站相关
    stationList: [],
    stationNames: [],
    selectedStationId: null,
    selectedStationIndex: -1,
    
    // 收货地址（只显示默认地址）
    defaultAddress: null,
    selectedAddressId: null,
    
    // 标记：是否刚刚从地址选择页面返回（避免重新加载默认地址）
    fromAddressSelect: false,
    
    // 表单数据
    form: {
      phoneTail: '', // 取件手机尾号
      pickPics: [], // 取件照片列表
      pickCodes: [], // 取件码列表
      pickCodesStr: '', // 取件码输入字符串
      itemDescription: '', // 物品备注
      startTime: null, // 开始时间（LocalDateTime格式）
      endTime: null, // 结束时间（LocalDateTime格式）
      startTimeStr: '', // 开始时间显示字符串
      endTimeStr: '', // 结束时间显示字符串
      isUrgent: false // 是否加急
    },
    
    // 快捷选项
    quickOptions: ['轻拿轻放', '大件', '放门口别敲门', '易碎品', '需要当面验收'],
    
    // 时间选择相关
    dateOptions: [], // 日期选项（今天、明天）
    timeSlotOptions: [], // 时间段选项（14:30-15:00等）
    todayTimeSlots: [], // 今天的时间段列表
    tomorrowTimeSlots: [], // 明天的时间段列表
    selectedDateIndex: -1, // 选中的日期索引
    selectedTimeSlotIndex: -1, // 选中的时间段索引
    checkingAvailability: false // 是否正在检查可用性
  },

  async onLoad(options) {
    // 检查是否有未支付的快递订单
    const hasPendingOrder = await this.checkUnpaidExpressOrder()
    if (hasPendingOrder) {
      return
    }
    
    // 优先从URL参数获取预选地址ID
    let addressId = options.addressId ? parseInt(options.addressId) : null
    
    // 加载用户地址列表
    await this.loadUserAddresses(addressId)
    
    // 如果有预选地址，加载其可服务的驿站
    if (this.data.selectedAddressId) {
      this.loadStationsByAddress(this.data.selectedAddressId)
    }
    
    // 初始化时间选择器
    this.initTimeSlots()
  },

  // 检查是否有未支付的快递订单
  async checkUnpaidExpressOrder() {
    try {
      const res = await api.getPendingExpressOrder()
      if (res.success && res.data && res.data.orderNo) {
        const orderNo = res.data.orderNo
        wx.showModal({
          title: '提示',
          content: '当前有订单未支付，请前往详情页支付',
          confirmText: '前往支付',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 跳转到快递订单详情页
              wx.redirectTo({
                url: `/pages/express-detail/index?orderNo=${orderNo}`
              })
            } else {
              // 用户取消，返回上一页
              wx.navigateBack()
            }
          }
        })
        return true
      }
      return false
    } catch (e) {
      console.error('检查未支付订单失败:', e)
      // 检查失败不影响正常流程，继续加载页面
      return false
    }
  },

  // 加载地址详情
  async loadAddressDetail(addressId) {
    try {
      const res = await api.getAddressDetail(addressId)
      if (res.success && res.data) {
        this.setData({ currentAddress: res.data })
      }
    } catch (e) {
      console.error('加载地址详情失败:', e)
    }
  },

  onShow() {
    // 如果刚刚从地址选择页面返回，且已经有地址了
    if (this.data.fromAddressSelect && this.data.defaultAddress) {
      // 清除标记
      this.setData({ fromAddressSelect: false })
      // 确保驿站已经加载（地址选择页面可能已经调用了，但为了保险起见，再次检查）
      if (this.data.selectedAddressId && (!this.data.selectedStationId || this.data.stationList.length === 0)) {
        // 如果驿站还没有加载或没有选中，重新加载
        this.loadStationsByAddress(this.data.selectedAddressId)
      }
      return
    }
    
    // 从地址编辑页返回后，刷新默认地址
    this.loadDefaultAddress()
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
        // 如果有默认地址，加载其可服务的驿站
        this.loadStationsByAddress(defaultAddress.id)
      } else {
        // 没有默认地址
        this.setData({
          defaultAddress: null,
          selectedAddressId: null,
          stationList: [],
          stationNames: [],
          selectedStationId: null,
          selectedStationIndex: -1
        })
      }
    } catch (e) {
      console.error('加载默认地址失败:', e)
      this.setData({
        defaultAddress: null,
        selectedAddressId: null
      })
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
          this.loadStationsByAddress(preselectAddressId)
        }
      } catch (e) {
        console.error('加载预选地址失败:', e)
      }
    }
  },

    // 初始化时间选择器（日期选项和时间段选项）
  async initTimeSlots() {
    const now = new Date()
    
    // 初始化日期选项（今天、明天）
    const dateOptions = [
      { label: '今天', isToday: true },
      { label: '明天', isToday: false }
    ]
    
    // 从后端获取可预约时间范围
    let appointmentTimeRange = '08:00-20:00' // 默认值
    try {
      const res = await api.getExpressAppointmentTime()
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
    
    // 将今天和明天的时间段合并（根据选择的日期来过滤）
    // 这里先存储所有选项，选择日期时会过滤
    const defaultTimeSlotOptions = todaySlots.length > 0 ? todaySlots : tomorrowSlots
    const defaultDateIndex = todaySlots.length > 0 ? 0 : 1 // 如果今天有时间段选今天，否则选明天
    
    this.setData({
      dateOptions,
      todayTimeSlots: todaySlots,
      tomorrowTimeSlots: tomorrowSlots,
      timeSlotOptions: defaultTimeSlotOptions,
      selectedDateIndex: defaultDateIndex
    })
    
    // 检查所有时间段的可用性
    this.checkAllTimeSlotsAvailability()
    
    // 默认选择第一个可用时间段
    if (defaultTimeSlotOptions.length > 0) {
      const firstAvailableSlot = defaultTimeSlotOptions.find(slot => slot.available && !slot.disabled)
      if (firstAvailableSlot) {
        const firstIndex = defaultTimeSlotOptions.indexOf(firstAvailableSlot)
        const isToday = defaultDateIndex === 0
        
        // 计算开始时间和结束时间
        const startTime = this.formatDateTime(firstAvailableSlot.startTime, !isToday)
        const endTime = this.formatDateTime(firstAvailableSlot.endTime, !isToday)
        
        // 显示文本：今天 14:30 - 15:00
        const dateLabel = defaultDateIndex === 0 ? '今天' : '明天'
        const displayText = `${dateLabel} ${firstAvailableSlot.label}`
        
        this.setData({
          selectedTimeSlotIndex: firstIndex,
          'form.startTime': startTime,
          'form.endTime': endTime,
          'form.startTimeStr': displayText
        })
      }
    }
  },

  // 检查所有时间段的可用性（优化：分批检查，避免一次性请求太多）
  async checkAllTimeSlotsAvailability() {
    if (this.data.checkingAvailability) return
    this.setData({ checkingAvailability: true })
    
    try {
      // 分批检查，每批10个时间段
      const batchSize = 10
      
      // 检查今天的时间段
      const todaySlots = [...this.data.todayTimeSlots]
      for (let i = 0; i < todaySlots.length; i += batchSize) {
        const batch = todaySlots.slice(i, i + batchSize)
        const promises = batch.map(async (slot) => {
          const startTime = this.formatDateTime(slot.startTime, false)
          const endTime = this.formatDateTime(slot.endTime, false)
          try {
            const res = await api.checkTimeSlotAvailability(2, startTime, endTime) // 2=快递代取
            return {
              slot,
              available: res.success && res.data && res.data.available
            }
          } catch (e) {
            console.error('检查时间段可用性失败:', e)
            return { slot, available: true } // 检查失败时默认可用
          }
        })
        const results = await Promise.all(promises)
        
        // 更新当前批次的时间段
        const updatedSlots = this.data.todayTimeSlots.map(slot => {
          const result = results.find(r => r.slot.startTime === slot.startTime && r.slot.endTime === slot.endTime)
          if (result) {
            return {
              ...slot,
              available: result.available,
              disabled: !result.available,
              label: !result.available ? `${slot.startTime} - ${slot.endTime} (已约满)` : slot.label
            }
          }
          return slot
        })
        this.setData({ todayTimeSlots: updatedSlots })
      }
      
      // 检查明天的时间段
      const tomorrowSlots = [...this.data.tomorrowTimeSlots]
      for (let i = 0; i < tomorrowSlots.length; i += batchSize) {
        const batch = tomorrowSlots.slice(i, i + batchSize)
        const promises = batch.map(async (slot) => {
          const startTime = this.formatDateTime(slot.startTime, true)
          const endTime = this.formatDateTime(slot.endTime, true)
          try {
            const res = await api.checkTimeSlotAvailability(2, startTime, endTime) // 2=快递代取
            return {
              slot,
              available: res.success && res.data && res.data.available
            }
          } catch (e) {
            console.error('检查时间段可用性失败:', e)
            return { slot, available: true } // 检查失败时默认可用
          }
        })
        const results = await Promise.all(promises)
        
        // 更新当前批次的时间段
        const updatedSlots = this.data.tomorrowTimeSlots.map(slot => {
          const result = results.find(r => r.slot.startTime === slot.startTime && r.slot.endTime === slot.endTime)
          if (result) {
            return {
              ...slot,
              available: result.available,
              disabled: !result.available,
              label: !result.available ? `${slot.startTime} - ${slot.endTime} (已约满)` : slot.label
            }
          }
          return slot
        })
        this.setData({ tomorrowTimeSlots: updatedSlots })
      }
      
      // 更新当前显示的时间段选项
      const currentDateIndex = this.data.selectedDateIndex
      const currentTimeSlotOptions = currentDateIndex === 0 ? this.data.todayTimeSlots : this.data.tomorrowTimeSlots
      this.setData({ timeSlotOptions: currentTimeSlotOptions })
    } catch (e) {
      console.error('批量检查时间段可用性失败:', e)
    } finally {
      this.setData({ checkingAvailability: false })
    }
  },

  // 根据地址ID加载驿站列表
  async loadStationsByAddress(addressId) {
    if (!addressId) {
      console.error('loadStationsByAddress: addressId is null or undefined')
      this.setData({ 
        stationList: [],
        stationNames: [],
        selectedStationId: null,
        selectedStationIndex: -1
      })
      return
    }
    
    try {
      wx.showLoading({ title: '加载驿站...' })
      const res = await api.getStationsByAddress(addressId)
      if (res.success && res.data) {
        const stationList = res.data
        const stationNames = stationList.map(s => s.stationName)
        
        // 自动选择第一个驿站
        let selectedStationId = null
        let selectedStationIndex = -1
        if (stationList.length > 0) {
          selectedStationId = stationList[0].id
          selectedStationIndex = 0
        }
        
        this.setData({
          stationList,
          stationNames,
          selectedStationId,
          selectedStationIndex
        })
      } else {
        // 如果没有数据，设置为空数组
        this.setData({
          stationList: [],
          stationNames: [],
          selectedStationId: null,
          selectedStationIndex: -1
        })
      }
    } catch (e) {
      console.error('加载驿站失败:', e)
      wx.showToast({ title: '加载驿站失败', icon: 'none' })
      this.setData({
        stationList: [],
        stationNames: [],
        selectedStationId: null,
        selectedStationIndex: -1
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 驿站选择变化
  onStationChange(e) {
    // 如果还没有选择地址，不允许选择驿站
    if (!this.data.selectedAddressId) {
      wx.showToast({ title: '请先选择收货地址', icon: 'none' })
      return
    }
    
    const index = parseInt(e.detail.value)
    const station = this.data.stationList[index]
    if (station) {
      this.setData({
        selectedStationId: station.id,
        selectedStationIndex: index
      })
    }
  },

  // 不再按驿站加载地址（逻辑已调整为先选地址）

  // 选择收货地址（跳转到地址选择页面）
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

  // 输入手机尾号
  onInputPhoneTail(e) {
    this.setData({
      'form.phoneTail': e.detail.value.replace(/\D/g, '') // 只保留数字
    })
  },

  // 输入取件码
  onInputPickCodes(e) {
    const value = e.detail.value
    this.setData({
      'form.pickCodesStr': value,
      'form.pickCodes': value.split(',').map(code => code.trim()).filter(code => code)
    })
  },

  // 输入物品备注
  onInputItemRemark(e) {
    this.setData({
      'form.itemDescription': e.detail.value
    })
  },

  // 添加快捷选项到物品备注
  addQuickOption(e) {
    console.log('addQuickOption called', e)
    const quickText = e.currentTarget.dataset.text
    console.log('quickText:', quickText)
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

  // 加急服务开关
  onUrgentSwitchChange(e) {
    this.setData({
      'form.isUrgent': e.detail.value
    })
  },

  // 选择日期
  onDateChange(e) {
    const index = parseInt(e.detail.value)
    const dateOption = this.data.dateOptions[index]
    
    if (dateOption) {
      // 根据选择的日期更新时间段选项
      const timeSlotOptions = dateOption.isToday 
        ? this.data.todayTimeSlots 
        : this.data.tomorrowTimeSlots
      
      // 自动选择第一个可用时间段
      const firstAvailableSlot = timeSlotOptions.find(slot => slot.available && !slot.disabled)
      let selectedIndex = -1
      let startTime = null
      let endTime = null
      let startTimeStr = ''
      
      if (firstAvailableSlot) {
        selectedIndex = timeSlotOptions.indexOf(firstAvailableSlot)
        const isToday = dateOption.isToday
        startTime = this.formatDateTime(firstAvailableSlot.startTime, !isToday)
        endTime = this.formatDateTime(firstAvailableSlot.endTime, !isToday)
        startTimeStr = `${dateOption.label} ${firstAvailableSlot.label}`
      }
      
      this.setData({
        selectedDateIndex: index,
        timeSlotOptions: timeSlotOptions,
        selectedTimeSlotIndex: selectedIndex,
        'form.startTime': startTime,
        'form.endTime': endTime,
        'form.startTimeStr': startTimeStr
      })
    }
  },

  // 选择时间段
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
      return
    }
    
    // 必须先选择日期
    if (this.data.selectedDateIndex === -1) {
      wx.showToast({ title: '请先选择日期', icon: 'none' })
      return
    }
    
    const dateOption = this.data.dateOptions[this.data.selectedDateIndex]
    const isToday = dateOption.isToday
    
    // 计算开始时间和结束时间
    const startTime = this.formatDateTime(timeSlot.startTime, !isToday)
    const endTime = this.formatDateTime(timeSlot.endTime, !isToday)
    
    // 显示文本：今天 14:30 - 15:00
    const displayText = `${dateOption.label} ${timeSlot.label}`
    
    this.setData({
      selectedTimeSlotIndex: index,
      'form.startTime': startTime,
      'form.endTime': endTime,
      'form.startTimeStr': displayText
    })
  },

  // 格式化时间为LocalDateTime格式（YYYY-MM-DDTHH:mm:ss）
  formatDateTime(timeStr, isNextDay) {
    const now = new Date()
    const [hour, minute] = timeStr.split(':').map(Number)
    
    let date = new Date(now)
    if (isNextDay) {
      date.setDate(date.getDate() + 1)
    }
    
    date.setHours(hour, minute, 0, 0)
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  },

  // 上传取件照片
  async choosePickPics() {
    const remainingCount = 9 - this.data.form.pickPics.length
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
              api.uploadImage(filePath, 'express')
            )
            
            const uploadResults = await Promise.all(uploadPromises)
            
            // 获取所有上传成功的URL
            const uploadedUrls = uploadResults
              .filter(result => result.success)
              .map(result => result.data.url)
            
            if (uploadedUrls.length > 0) {
              const pickPics = [...this.data.form.pickPics, ...uploadedUrls]
              this.setData({ 'form.pickPics': pickPics })
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

  // 删除取件照片
  deletePickPic(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const pickPics = [...this.data.form.pickPics]
    pickPics.splice(index, 1)
    this.setData({ 'form.pickPics': pickPics })
  },

  // 加急开关变化处理
  onUrgentSwitchChange(e) {
    const isUrgent = e.detail.value
    this.setData({
      'form.isUrgent': isUrgent
    })
    
    if (isUrgent) {
      // 加急订单：自动设置当前时间到20分钟后
      this.setUrgentTime()
    } else {
      // 非加急订单：恢复时间选择器
      // 如果之前没有选择时间，初始化时间选择器
      if (this.data.selectedDateIndex === -1 || this.data.selectedTimeSlotIndex === -1) {
        this.initTimeSlots()
      }
    }
  },
  
  // 设置加急订单时间（当前时间到20分钟后）
  setUrgentTime() {
    const now = new Date()
    const endTime = new Date(now.getTime() + 20 * 60 * 1000) // 20分钟后
    
    // 格式化为 LocalDateTime 格式（YYYY-MM-DDTHH:mm:ss）
    const formatDateTime = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
    }
    
    const startTime = formatDateTime(now)
    const endTimeStr = formatDateTime(endTime)
    
    this.setData({
      'form.startTime': startTime,
      'form.endTime': endTimeStr,
      'form.startTimeStr': '20分钟内送达'
    })
  },

  // 表单校验
  validateForm() {
    if (!this.data.selectedStationId) {
      wx.showToast({ title: '请选择取件驿站', icon: 'none' })
      return false
    }
    
    if (!this.data.selectedAddressId) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return false
    }
    
    if (!this.data.form.phoneTail || this.data.form.phoneTail.length !== 4) {
      wx.showToast({ title: '请输入正确的手机尾号（4位）', icon: 'none' })
      return false
    }
    
    // 如果是加急订单，不需要验证时间选择器的选择
    if (!this.data.form.isUrgent) {
      if (this.data.selectedDateIndex === -1 || this.data.selectedTimeSlotIndex === -1) {
        wx.showToast({ title: '请选择送达时间范围', icon: 'none' })
        return false
      }
      
      if (!this.data.form.startTime || !this.data.form.endTime) {
        wx.showToast({ title: '请选择送达时间范围', icon: 'none' })
        return false
      }
    } else {
      // 加急订单必须有时间
      if (!this.data.form.startTime || !this.data.form.endTime) {
        wx.showToast({ title: '时间设置异常，请重试', icon: 'none' })
        return false
      }
    }
    
    return true
  },

  // 提交订单
  async onSubmit() {
    if (!this.validateForm()) {
      return
    }
    
    try {
      wx.showLoading({ title: '提交中...' })
      
      const orderData = {
        stationId: this.data.selectedStationId,
        addressId: this.data.selectedAddressId,
        phoneTail: this.data.form.phoneTail,
        pickPics: this.data.form.pickPics.length > 0 ? this.data.form.pickPics : null, // 如果为空传null
        pickCodes: this.data.form.pickCodes.length > 0 ? this.data.form.pickCodes : null, // 如果为空传null
        itemDescription: this.data.form.itemDescription,
        // 加急订单不传时间，后端自动计算
        startTime: this.data.form.isUrgent ? null : this.data.form.startTime,
        endTime: this.data.form.isUrgent ? null : this.data.form.endTime,
        isUrgent: this.data.form.isUrgent
      }
      
      console.log('提交订单数据:', orderData)
      
      const res = await api.createExpressOrder(orderData)
      
      if (res.success) {
        const orderNo = res.data?.orderNo || res.data?.order?.orderNo || res.orderNo
        wx.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => {
          if (orderNo) {
            wx.redirectTo({
              url: `/pages/express-detail/index?orderNo=${orderNo}`
            })
          } else {
            wx.redirectTo({
              url: '/pages/orders/index'
            })
          }
        }, 800)
      }
    } catch (e) {
      console.error('提交订单失败:', e)
      wx.showToast({ title: e.message || e.error || '提交失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 分享给好友
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    const sharePath = app.getSharePath()
    const shareConfig = {
      title: '喵屋管家 - 便捷的生活服务小程序',
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

})
