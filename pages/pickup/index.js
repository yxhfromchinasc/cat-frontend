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
    
    // 收货地址列表（根据驿站筛选）
    deliveryAddressList: [],
    selectedAddressId: null,
    
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
      endTimeStr: '' // 结束时间显示字符串
    },
    
    // 快捷选项
    quickOptions: ['轻拿轻放', '大件', '放门口别敲门', '易碎品', '需要当面验收'],
    
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
    
    // 加载用户地址列表
    await this.loadUserAddresses(addressId)
    
    // 如果有预选地址，加载其可服务的驿站
    if (this.data.selectedAddressId) {
      this.loadStationsByAddress(this.data.selectedAddressId)
    }
    
    // 初始化时间选择器
    this.initTimeSlots()
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
    // 如果从地址选择页返回，可在此根据全局或上一页状态刷新（如需要）
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
      }
    } catch (e) {
      console.error('加载用户地址失败:', e)
      this.setData({ deliveryAddressList: [] })
    } finally {
      wx.hideLoading()
    }
  },

    // 初始化时间选择器（日期选项和时间段选项）
  initTimeSlots() {
    const now = new Date()
    
    // 初始化日期选项（今天、明天）
    const dateOptions = [
      { label: '今天', isToday: true },
      { label: '明天', isToday: false }
    ]
    
    // 初始化时间段选项
    // 今天：从当前时间的下一个半小时开始
    // 明天：从00:00开始
    const timeSlotOptions = []
    
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
        // 如果已经超过今天，今天没有可选时间段
        todayHasSlots = false
        startHour = 0
        startMinute = 0
      } else {
        startMinute = 0
      }
    } else {
      // 如果是整点（0分），从下一个时间段开始（30分）
      startMinute = 30
    }
    
    // 生成时间段选项（30分钟一个时间段）
    // 今天的时间段
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
            // 如果结束时间超过24点，跳过这个时间段
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
    
    // 明天的时间段（00:00 - 23:30）
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
    
    // 默认选择第一个时间段
    if (defaultTimeSlotOptions.length > 0) {
      const firstTimeSlot = defaultTimeSlotOptions[0]
      const isToday = defaultDateIndex === 0
      
      // 计算开始时间和结束时间
      const startTime = this.formatDateTime(firstTimeSlot.startTime, !isToday)
      const endTime = this.formatDateTime(firstTimeSlot.endTime, !isToday)
      
      // 显示文本：今天 14:30 - 15:00
      const dateLabel = defaultDateIndex === 0 ? '今天' : '明天'
      const displayText = `${dateLabel} ${firstTimeSlot.label}`
      
      this.setData({
        selectedTimeSlotIndex: 0,
        'form.startTime': startTime,
        'form.endTime': endTime,
        'form.startTimeStr': displayText
      })
    }
  },

  // 根据地址ID加载驿站列表
  async loadStationsByAddress(addressId) {
    if (!addressId) {
      console.error('loadStationsByAddress: addressId is null or undefined')
      this.setData({ stationNames: [] })
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

  // 选择收货地址
  selectDeliveryAddress(e) {
    const addressId = parseInt(e.currentTarget.dataset.id)
    this.setData({ 
      selectedAddressId: addressId,
      selectedStationId: null,
      selectedStationIndex: -1,
      stationList: [],
      stationNames: []
    })
    // 根据选中的地址加载可服务驿站
    this.loadStationsByAddress(addressId)
  },

  // 选择送件地址（从地址列表选择）
  chooseAddress() {
    wx.navigateTo({
      url: '/pages/address/select'
    })
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

  // 选择日期
  onDateChange(e) {
    const index = parseInt(e.detail.value)
    const dateOption = this.data.dateOptions[index]
    
    if (dateOption) {
      // 根据选择的日期更新时间段选项
      const timeSlotOptions = dateOption.isToday 
        ? this.data.todayTimeSlots 
        : this.data.tomorrowTimeSlots
      
      // 如果之前选择了时间段，重置选择
      this.setData({
        selectedDateIndex: index,
        timeSlotOptions: timeSlotOptions,
        selectedTimeSlotIndex: -1,
        'form.startTime': null,
        'form.endTime': null,
        'form.startTimeStr': ''
      })
    }
  },

  // 选择时间段
  onTimeSlotChange(e) {
    const index = parseInt(e.detail.value)
    const timeSlot = this.data.timeSlotOptions[index]
    
    if (!timeSlot) return
    
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
    
    if (!this.data.form.itemDescription || this.data.form.itemDescription.trim() === '') {
      wx.showToast({ title: '请输入物品描述', icon: 'none' })
      return false
    }
    
    if (this.data.selectedDateIndex === -1 || this.data.selectedTimeSlotIndex === -1) {
      wx.showToast({ title: '请选择送达时间范围', icon: 'none' })
      return false
    }
    
    if (!this.data.form.startTime || !this.data.form.endTime) {
      wx.showToast({ title: '请选择送达时间范围', icon: 'none' })
      return false
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
        startTime: this.data.form.startTime,
        endTime: this.data.form.endTime
      }
      
      console.log('提交订单数据:', orderData)
      
      const res = await api.createExpressOrder(orderData)
      
      if (res.success) {
        wx.showToast({ title: '提交成功', icon: 'success' })
        // TODO: 跳转到订单详情页或订单列表页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (e) {
      console.error('提交订单失败:', e)
      wx.showToast({ title: e.message || e.error || '提交失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
