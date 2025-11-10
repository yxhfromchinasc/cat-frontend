// pages/recycle/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    // 地址相关
    deliveryAddressList: [],
    selectedAddressId: null,
    
    // 回收点相关
    recyclingPointList: [],
    recyclingPointName: null,
    
    // 表单数据
    form: {
      estWeight: '', // 预估重量
      itemDescription: '', // 物品描述
      startTime: null, // 开始时间（用于提交）
      endTime: null, // 结束时间（用于提交）
      startTimeStr: '' // 开始时间显示字符串
    },
    
    // 是否可以提交（用于按钮禁用状态）
    canSubmitData: false,
    
    // 快捷选项
    quickOptions: ['易拉罐', '纸壳子', '旧家电', '金属', '塑料瓶', '旧衣服', '废旧电池'],
    
    // 时间选择相关
    dateOptions: [], // 日期选项（今天、明天）
    timeSlotOptions: [], // 时间段选项（14:30-15:00等）
    todayTimeSlots: [], // 今天的时间段列表
    tomorrowTimeSlots: [], // 明天的时间段列表
    selectedDateIndex: -1, // 选中的日期索引
    selectedTimeSlotIndex: -1 // 选中的时间段索引
  },

  async onLoad(options) {
    // 优先从URL参数获取预选地址ID
    let addressId = options.addressId ? parseInt(options.addressId) : null
    
    // 加载用户地址列表（内部会加载回收点）
    await this.loadUserAddresses(addressId)
    
    // 初始化时间选择器
    this.initTimeSlots()
  },

  // 加载用户地址列表
  async loadUserAddresses(preselectAddressId) {
    try {
      wx.showLoading({ title: '加载地址...' })
      const res = await api.getAddressList(1, 100)
      const list = res.success ? (res.data.list || []).filter(addr => addr.status === 1) : []
      this.setData({ deliveryAddressList: list })
      
      // 确定默认选中的地址
      let selectedId = null
      if (preselectAddressId) {
        const exists = list.some(a => a.id === preselectAddressId)
        if (exists) selectedId = preselectAddressId
      }
      if (!selectedId) {
        // 先选默认地址
        const def = list.find(a => a.isDefault)
        if (def) selectedId = def.id
      }
      if (!selectedId && list.length > 0) {
        selectedId = list[0].id
      }
      if (selectedId) {
        this.setData({ selectedAddressId: selectedId })
        
        // 加载该地址的回收点
        this.loadRecyclingPointsByAddress(selectedId)
      }
      
      // 更新提交状态
      this.updateCanSubmit()
    } catch (e) {
      console.error('加载用户地址失败:', e)
      this.setData({ deliveryAddressList: [] })
    } finally {
      wx.hideLoading()
    }
  },

  // 更新是否可以提交状态
  updateCanSubmit() {
    const canSubmit = this.data.selectedAddressId && 
                     this.data.form.itemDescription && 
                     this.data.form.itemDescription.trim() &&
                     this.data.form.startTime && 
                     this.data.form.endTime &&
                     this.data.recyclingPointName
    this.setData({ canSubmitData: canSubmit })
  },

  // 选择地址
  selectDeliveryAddress(e) {
    const addressId = parseInt(e.currentTarget.dataset.id)
    if (addressId === this.data.selectedAddressId) return
    
    this.setData({ selectedAddressId: addressId })
    
    // 加载该地址的回收点
    this.loadRecyclingPointsByAddress(addressId)
    
    // 更新提交状态
    this.updateCanSubmit()
  },

  // 根据地址ID加载回收点列表
  async loadRecyclingPointsByAddress(addressId) {
    if (!addressId) {
      this.setData({ 
        recyclingPointList: [],
        recyclingPointName: null
      })
      return
    }
    
    try {
      wx.showLoading({ title: '查询回收点...' })
      const res = await api.getRecyclingPointsByAddress(addressId)
      if (res.success && res.data) {
        const recyclingPointList = res.data || []
        
        // 显示第一个回收点的名称
        let recyclingPointName = null
        if (recyclingPointList.length > 0) {
          recyclingPointName = recyclingPointList[0].pointName
        }
        
        this.setData({
          recyclingPointList,
          recyclingPointName
        })
        
        // 更新提交状态
        this.updateCanSubmit()
      } else {
        // 如果没有数据，设置为空
        this.setData({
          recyclingPointList: [],
          recyclingPointName: null
        })
        
        // 更新提交状态
        this.updateCanSubmit()
      }
    } catch (e) {
      console.error('加载回收点失败:', e)
      this.setData({
        recyclingPointList: [],
        recyclingPointName: null
      })
      
      // 更新提交状态
      this.updateCanSubmit()
    } finally {
      wx.hideLoading()
    }
  },

  // 初始化时间选择器
  initTimeSlots() {
    const now = new Date()
    
    // 初始化日期选项（今天、明天）
    const dateOptions = [
      { label: '今天', isToday: true },
      { label: '明天', isToday: false }
    ]
    
    // 计算今天的起始时间
    let startHour = now.getHours()
    let startMinute = now.getMinutes()
    
    // 计算今天的起始时间：从下一个半小时开始
    let todayHasSlots = true
    if (startMinute > 0 && startMinute < 30) {
      startMinute = 30
    } else if (startMinute >= 30) {
      startHour += 1
      if (startHour >= 24) {
        todayHasSlots = false
        startHour = 0
        startMinute = 0
      } else {
        startMinute = 0
      }
    } else {
      startMinute = 30
    }
    
    // 生成今天的时间段
    const todaySlots = []
    if (todayHasSlots) {
      for (let hour = startHour; hour < 24; hour++) {
        for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += 30) {
          const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
          let endHour = hour
          let endMinute = minute + 30
          if (endMinute >= 60) {
            endHour += 1
            endMinute = 0
          }
          if (endHour >= 24) {
            break
          }
          const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
          todaySlots.push({
            label: `${startTime} - ${endTime}`,
            startTime: startTime,
            endTime: endTime,
            isToday: true
          })
        }
      }
    }
    
    // 明天的时间段
    const tomorrowSlots = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        let endHour = hour
        let endMinute = minute + 30
        if (endMinute >= 60) {
          endHour += 1
          endMinute = 0
        }
        if (endHour >= 24) {
          break
        }
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
        tomorrowSlots.push({
          label: `${startTime} - ${endTime}`,
          startTime: startTime,
          endTime: endTime,
          isToday: false
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
    
    // 默认选择第一个时间段
    if (defaultTimeSlotOptions.length > 0) {
      const firstTimeSlot = defaultTimeSlotOptions[0]
      const isToday = defaultDateIndex === 0
      
      const startTime = this.formatDateTime(firstTimeSlot.startTime, !isToday)
      const endTime = this.formatDateTime(firstTimeSlot.endTime, !isToday)
      
      const dateLabel = defaultDateIndex === 0 ? '今天' : '明天'
      const displayText = `${dateLabel} ${firstTimeSlot.label}`
      
      this.setData({
        selectedTimeSlotIndex: 0,
        'form.startTime': startTime,
        'form.endTime': endTime,
        'form.startTimeStr': displayText
      })
      
      // 更新提交状态
      this.updateCanSubmit()
    }
  },

  // 日期选择变化
  onDateChange(e) {
    const index = parseInt(e.detail.value)
    const isToday = index === 0
    
    // 根据选择的日期更新时间段选项
    const timeSlotOptions = isToday ? this.data.todayTimeSlots : this.data.tomorrowTimeSlots
    
    this.setData({
      selectedDateIndex: index,
      timeSlotOptions,
      selectedTimeSlotIndex: -1 // 重置时间段选择
    })
    
    // 如果新的时间段列表有数据，自动选择第一个
    if (timeSlotOptions.length > 0) {
      const firstTimeSlot = timeSlotOptions[0]
      const startTime = this.formatDateTime(firstTimeSlot.startTime, !isToday)
      const endTime = this.formatDateTime(firstTimeSlot.endTime, !isToday)
      
      const dateLabel = index === 0 ? '今天' : '明天'
      const displayText = `${dateLabel} ${firstTimeSlot.label}`
      
      this.setData({
        selectedTimeSlotIndex: 0,
        'form.startTime': startTime,
        'form.endTime': endTime,
        'form.startTimeStr': displayText
      })
      
      // 更新提交状态
      this.updateCanSubmit()
    } else {
      // 如果没有可选时间段，清空时间
      this.setData({
        'form.startTime': null,
        'form.endTime': null,
        'form.startTimeStr': ''
      })
      
      // 更新提交状态
      this.updateCanSubmit()
    }
  },

  // 时间段选择变化
  onTimeSlotChange(e) {
    const index = parseInt(e.detail.value)
    const timeSlot = this.data.timeSlotOptions[index]
    if (!timeSlot) return
    
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

  // 格式化日期时间（用于提交）
  formatDateTime(timeStr, isTomorrow) {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate() + (isTomorrow ? 1 : 0)).padStart(2, '0')
    return `${year}-${month}-${day}T${timeStr}:00`
  },

  // 输入预估重量
  onInputEstWeight(e) {
    this.setData({
      'form.estWeight': e.detail.value
    })
  },

  // 输入物品描述
  onInputItemDescription(e) {
    this.setData({
      'form.itemDescription': e.detail.value
    })
    
    // 更新提交状态
    this.updateCanSubmit()
  },

    // 添加快捷选项
    addQuickOption(e) {
      const text = e.currentTarget.dataset.text
      if (!text) return
      
      const currentDesc = this.data.form.itemDescription || ''
      
      // 检查是否已经包含该选项
      if (currentDesc.includes(text)) {
        return
      }
      
      // 追加到物品描述
      const newDesc = currentDesc ? `${currentDesc}、${text}` : text
      this.setData({
        'form.itemDescription': newDesc
      })
      
      // 更新提交状态
      this.updateCanSubmit()
    },

  // 验证表单
  validateForm() {
    if (!this.data.selectedAddressId) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return false
    }
    
    if (!this.data.form.itemDescription || !this.data.form.itemDescription.trim()) {
      wx.showToast({ title: '请填写物品描述', icon: 'none' })
      return false
    }
    
    if (!this.data.form.startTime || !this.data.form.endTime) {
      wx.showToast({ title: '请选择上门时间范围', icon: 'none' })
      return false
    }
    
    return true
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
    
    try {
      wx.showLoading({ title: '提交中...' })
      
      const payload = {
        addressId: this.data.selectedAddressId,
        itemDescription: this.data.form.itemDescription.trim(),
        startTime: this.data.form.startTime,
        endTime: this.data.form.endTime
      }
      
      // 如果有预估重量，添加到请求中
      if (this.data.form.estWeight && this.data.form.estWeight.trim()) {
        const weight = parseFloat(this.data.form.estWeight)
        if (!isNaN(weight) && weight > 0) {
          payload.estWeight = weight
        }
      }
      
      const res = await api.createRecyclingOrder(payload)
      
      if (res.success) {
        wx.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    } catch (e) {
      console.error('提交订单失败:', e)
      wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
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
      title: '喵呜管家 - 便捷的生活服务小程序',
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

})

