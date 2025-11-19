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
    
    // 表单数据
    form: {
      images: [], // 上传的图片URL列表
      startTime: null, // 开始时间（用于提交）
      endTime: null, // 结束时间（用于提交）
      startTimeStr: '' // 开始时间显示字符串
    },
    
    // 是否可以提交（用于按钮禁用状态）
    canSubmitData: false,
    
    // 快捷选项
    quickOptions: ['易拉罐', '纸壳子', '旧家电', '金属', '塑料瓶', '旧衣服', '废旧电池'],
    
    // 时间选择相关
    timeType: 'appointment', // 'immediate' 立即上门 或 'appointment' 预约时间
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
                     this.data.recyclingPointName
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

  // 立即上门开关变化
  onImmediateSwitchChange(e) {
    const checked = e.detail.value
    const timeType = checked ? 'immediate' : 'appointment'
    
    this.setData({ timeType })
    
    if (timeType === 'immediate') {
      // 立即上门：当前时间到半小时后
      this.setImmediateTime()
    } else {
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

  // 验证表单
  validateForm() {
    if (!this.data.selectedAddressId) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
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
      
      const isUrgent = this.data.timeType === 'immediate'
      const payload = {
        addressId: this.data.selectedAddressId,
        // 加急订单不传时间，后端自动计算
        startTime: isUrgent ? null : this.data.form.startTime,
        endTime: isUrgent ? null : this.data.form.endTime,
        // 后端需要这些字段，但前端已隐藏，传默认值
        estWeight: null,
        itemDescription: '废品回收',
        // 是否加急（立即上门）
        isUrgent: isUrgent
      }
      
      // 如果有图片，添加到请求中
      if (this.data.form.images && this.data.form.images.length > 0) {
        payload.images = this.data.form.images
      }
      
      const res = await api.createRecyclingOrder(payload)
      
      if (res.success) {
        const orderNo = res.data?.orderNo || res.data?.order?.orderNo || res.orderNo
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

