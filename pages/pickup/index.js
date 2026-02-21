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
    selectedStationName: '',
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
      pickCodes: '', // 取件码（多个用顿号分隔）
      itemDescription: '', // 物品备注
      startTime: null, // 开始时间（LocalDateTime格式）
      endTime: null, // 结束时间（LocalDateTime格式）
      startTimeStr: '', // 开始时间显示字符串
      endTimeStr: '', // 结束时间显示字符串
      isUrgent: false // 是否加急
    },
    
    // 快捷选项（从后端获取）
    quickOptions: [],
    
    // 时间选择相关
    dateOptions: [], // 日期选项（今天、明天）
    timeSlotOptions: [], // 时间段选项（14:30-15:00等）
    todayTimeSlots: [], // 今天的时间段列表
    tomorrowTimeSlots: [], // 明天的时间段列表
    selectedDateIndex: -1, // 选中的日期索引
    selectedTimeSlotIndex: -1, // 选中的时间段索引
    checkingAvailability: false, // 是否正在检查可用性
    showTimePickerModal: false, // 是否显示时间选择器弹窗
    urgentTipText: '', // 立即上门提示文案
    isUrgentDisabled: false, // 立即上门开关是否禁用（不在营业时间内时禁用）

    // 快递单价相关（从系统设置获取）
    
    // 提交状态标记，防止重复提交
    isSubmitting: false,
    expressPricePerItem: null,
    expressPriceText: '',
    expressPriceDesc: '',
    
    // 是否可以提交（用于按钮禁用状态）
    canSubmitData: false,
    
    // 提交按钮提示信息
    submitTip: ''
  },

  async onLoad(options) {
    // 检查是否有未支付的快递订单
    const hasPendingOrder = await this.checkUnpaidExpressOrder()
    if (hasPendingOrder) {
      return
    }
    
    // 加载备注快捷选项
    await this.loadRemarkOptions()
    
    // 加载立即上门提示文案
    await this.loadUrgentTip()

    // 加载快递单价配置
    await this.loadExpressPrice()
    
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
    
    // 如果有选中的驿站，检查当前时间是否在营业时间内
    if (this.data.selectedStationId) {
      this.checkIfInBusinessHours()
    }
    
    // 初始化提交状态（显示提示信息）
    this.updateCanSubmit()
  },

  // 加载备注快捷选项
  async loadRemarkOptions() {
    try {
      const res = await api.getExpressRemarkOptions()
      if (res.success && res.data) {
        const options = JSON.parse(res.data)
        this.setData({ quickOptions: options || [] })
      } else {
        // 如果获取失败，使用默认值
        this.setData({ quickOptions: ['轻拿轻放', '大件', '放门口别敲门', '易碎品', '需要当面验收'] })
      }
    } catch (e) {
      console.error('加载备注快捷选项失败')
      // 如果获取失败，使用默认值
      this.setData({ quickOptions: ['轻拿轻放', '大件', '放门口别敲门', '易碎品', '需要当面验收'] })
    }
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
      console.error('检查未支付订单失败')
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
      console.error('加载地址详情失败')
    }
  },

  onShow() {
    // 如果刚刚从地址选择页面返回，且已经有地址了
    if (this.data.fromAddressSelect && this.data.defaultAddress) {
      // 清除标记
      this.setData({ fromAddressSelect: false })
      
      // 选择地址后，清空时间数据（因为不同地址对应的驿站不同，时间段选项也会不同）
      this.setData({
        selectedDateIndex: -1,
        selectedTimeSlotIndex: -1,
        'form.startTime': null,
        'form.endTime': null,
        'form.startTimeStr': ''
      })
      
      // 确保驿站已经加载（地址选择页面可能已经调用了，但为了保险起见，再次检查）
      if (this.data.selectedAddressId && (!this.data.selectedStationId || this.data.stationList.length === 0)) {
        // 如果驿站还没有加载或没有选中，重新加载
        this.loadStationsByAddress(this.data.selectedAddressId)
      } else {
        // 如果驿站已经加载，更新提交状态
        this.updateCanSubmit()
      }
      return
    }
    
    // 如果已经有选中的地址，说明用户已经选择了地址，不要重置为默认地址
    // 只有在没有选中地址的情况下，才加载默认地址（比如首次进入页面或地址被删除的情况）
    if (!this.data.selectedAddressId) {
      // 从地址编辑页返回后，刷新默认地址
      this.loadDefaultAddress()
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
        // 更新提交状态
        this.updateCanSubmit()
      }
    } catch (e) {
      console.error('加载默认地址失败')
      this.setData({
        defaultAddress: null,
        selectedAddressId: null
      })
      // 更新提交状态
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
          this.loadStationsByAddress(preselectAddressId)
        }
      } catch (e) {
        console.error('加载预选地址失败')
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
    
    // 优先使用选中驿站的营业时间，如果没有选中驿站则使用系统配置
    let appointmentTimeRange = '08:00-20:00' // 默认值
    if (this.data.selectedStationId && this.data.stationList && this.data.stationList.length > 0) {
      // 找到选中的驿站
      const selectedStation = this.data.stationList.find(s => s.id === this.data.selectedStationId)
      if (selectedStation && selectedStation.startTime && selectedStation.endTime) {
        // 使用驿站的营业时间（格式：HH:mm:ss，需要转换为 HH:mm）
        const startTime = selectedStation.startTime.substring(0, 5) // 取前5位 HH:mm
        const endTime = selectedStation.endTime.substring(0, 5) // 取前5位 HH:mm
        appointmentTimeRange = `${startTime}-${endTime}`
      }
    }
    
    // 如果没有选中驿站或驿站没有营业时间，从系统配置获取
    if (appointmentTimeRange === '08:00-20:00') {
    try {
      const res = await api.getExpressAppointmentTime()
      if (res.success && res.data) {
        appointmentTimeRange = res.data
      }
    } catch (e) {
      console.error('获取可预约时间配置失败')
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
    
    // 检查所有时间段的可用性（需要先选择驿站）
    // 如果已选择驿站，则检查可用性；否则在驿站选择后会自动检查
    if (this.data.selectedStationId) {
      this.checkAllTimeSlotsAvailability()
      // 检查当前时间是否在营业时间内，更新立即上门开关状态
      this.checkIfInBusinessHours()
    } else {
      // 如果没有选中驿站，禁用立即上门开关
      this.setData({ isUrgentDisabled: true })
    }
    
    // 更新提交状态（不自动选择时间段）
    // 注意：initTimeSlots 不应该保留之前的时间数据，因为时间段选项可能已改变
    this.updateCanSubmit()
  },

  // 检查所有时间段的可用性（使用后端批量接口）
  async checkAllTimeSlotsAvailability() {
    if (this.data.checkingAvailability) return
    // 如果没有选择驿站，不检查可用性
    if (!this.data.selectedStationId) {
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
        api.getTimeSlotList(2, todayStr, this.data.selectedStationId, null),
        api.getTimeSlotList(2, tomorrowStr, this.data.selectedStationId, null)
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
      console.error('获取时间段列表失败')
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
        selectedStationName: '',
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
        let selectedStationName = ''
        let selectedStationIndex = -1
        if (stationList.length > 0) {
          selectedStationId = stationList[0].id
          selectedStationName = stationList[0].stationName || ''
          selectedStationIndex = 0
        }
        
        this.setData({
          stationList,
          stationNames,
          selectedStationId,
          selectedStationName,
          selectedStationIndex
        })
        
        // 自动选择第一个驿站后，重新初始化时间段并检查可用性
        if (selectedStationId) {
          this.initTimeSlots()
          this.checkAllTimeSlotsAvailability()
          // 检查当前时间是否在营业时间内，更新立即上门开关状态
          this.checkIfInBusinessHours()
        }
        // 更新提交状态
        this.updateCanSubmit()
      } else {
        // 如果没有数据，设置为空数组
        this.setData({
          stationList: [],
          stationNames: [],
          selectedStationId: null,
          selectedStationName: '',
          selectedStationIndex: -1
        })
        // 更新提交状态
        this.updateCanSubmit()
      }
    } catch (e) {
      console.error('加载驿站失败')
      wx.showToast({ title: '加载驿站失败', icon: 'none' })
      this.setData({
        stationList: [],
        stationNames: [],
        selectedStationId: null,
        selectedStationName: '',
        selectedStationIndex: -1
      })
      // 更新提交状态
      this.updateCanSubmit()
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
        selectedStationName: station.stationName || '',
        selectedStationIndex: index
      })
      // 重新初始化时间段（使用新驿站的营业时间）
      this.initTimeSlots()
      this.checkAllTimeSlotsAvailability()
      // 检查当前时间是否在营业时间内，更新立即上门开关状态
      this.checkIfInBusinessHours()
      // 如果不在营业时间内，关闭立即上门开关
      if (this.data.isUrgentDisabled && this.data.form.isUrgent) {
        this.setData({
          'form.isUrgent': false
        })
      }
      // 切换驿站后，时间段选项已改变，需要清空之前选择的时间
      // 因为不同驿站的时间段选项不同，之前选择的时间在新驿站可能不可用
      this.setData({
        selectedDateIndex: -1,
        selectedTimeSlotIndex: -1,
        'form.startTime': null,
        'form.endTime': null,
        'form.startTimeStr': ''
      })
      // 更新提交状态
      this.updateCanSubmit()
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
    // 更新提交状态
    this.updateCanSubmit()
  },

  // 输入取件码
  onInputPickCodes(e) {
    const value = e.detail.value
    // 将逗号替换为顿号，保留空格
    this.setData({
      'form.pickCodes': value.replace(/,/g, '、')
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

  // 加载立即上门提示文案
  async loadUrgentTip() {
    try {
      const res = await api.getPublicConfigs()
      if (res && res.success && res.data) {
        // 从系统设置中获取快递代取立即上门提示文案
        const tipText = res.data.urgent_tip_express || res.data.urgent_tip || ''
        this.setData({ urgentTipText: tipText })
      }
    } catch (e) {
      console.error('加载立即上门提示文案失败')
    }
  },

  // 加载快递单价配置
  async loadExpressPrice() {
    try {
      // 单价配置键：express_price_per_item，与后端计价逻辑保持一致
      const priceRes = await api.getConfigValue('express_price_per_item')
      let pricePerItem = null
      if (priceRes && priceRes.success && priceRes.data) {
        const value = String(priceRes.data).trim()
        if (value) {
          pricePerItem = value
        }
      }

      // 加急费用配置（可选），用于说明规则
      let urgentFee = null
      try {
        const urgentRes = await api.getConfigValue('express_urgent_fee')
        if (urgentRes && urgentRes.success && urgentRes.data) {
          const v = String(urgentRes.data).trim()
          if (v) {
            urgentFee = v
          }
        }
      } catch (e) {
      }

      if (pricePerItem) {
        let desc = '基础服务费 = 单价 × 件数'
        if (urgentFee) {
          desc += `，立即上门订单可能额外收取约 ${urgentFee} 元加急费用`
        }
        desc += '，实际以完成时结算金额为准'

        this.setData({
          expressPricePerItem: pricePerItem,
          expressPriceText: `快递代取服务费 ${pricePerItem} 元/件`,
          expressPriceDesc: desc
        })
      } else {
        this.setData({
          expressPricePerItem: null,
          expressPriceText: '',
          expressPriceDesc: ''
        })
      }
    } catch (e) {
      console.error('加载快递单价配置失败')
      this.setData({
        expressPricePerItem: null,
        expressPriceText: '',
        expressPriceDesc: ''
      })
    }
  },

  // 检查当前时间是否在营业时间内
  checkIfInBusinessHours() {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentMinutes = currentHour * 60 + currentMinute
    
    // 获取营业时间范围
    let startTime = '08:00'
    let endTime = '20:00'
    
    if (this.data.selectedStationId && this.data.stationList && this.data.stationList.length > 0) {
      const selectedStation = this.data.stationList.find(s => s.id === this.data.selectedStationId)
      if (selectedStation && selectedStation.startTime && selectedStation.endTime) {
        startTime = selectedStation.startTime.substring(0, 5) // HH:mm
        endTime = selectedStation.endTime.substring(0, 5) // HH:mm
      }
    }
    
    // 解析营业时间
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    // 判断当前时间是否在营业时间内
    const isInBusinessHours = currentMinutes >= startMinutes && currentMinutes < endMinutes
    
    this.setData({ isUrgentDisabled: !isInBusinessHours })
    
    return isInBusinessHours
  },

  // 显示立即上门提示
  showUrgentTip() {
    // 如果不在营业时间内，显示特殊提示
    if (this.data.isUrgentDisabled) {
      wx.showModal({
        title: '提示',
        content: '不在营业时间',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    
    // 正常显示立即上门服务说明
    const tipText = this.data.urgentTipText || '立即上门服务说明'
    wx.showModal({
      title: '提示',
      content: tipText,
      showCancel: false,
      confirmText: '知道了'
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
      
      // 重置时间段选择（不自动选择）
      this.setData({
        selectedDateIndex: index,
        timeSlotOptions: timeSlotOptions,
        selectedTimeSlotIndex: -1,
        'form.startTime': null,
        'form.endTime': null,
        'form.startTimeStr': ''
      })
      // 更新提交状态
      this.updateCanSubmit()
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
      // 更新提交状态
      this.updateCanSubmit()
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
    // 更新提交状态
    this.updateCanSubmit()
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

  // 根据时间数据生成显示文本（如果没有时间数据则清空显示）
  updateTimeDisplayFromData() {
    // 如果没有时间数据，清空显示文本
    if (!this.data.form.startTime || !this.data.form.endTime) {
      this.setData({
        'form.startTimeStr': ''
      })
      return
    }
    
    // 解析时间字符串（格式：YYYY-MM-DDTHH:mm:ss）
    const parseDateTime = (dateTimeStr) => {
      const [datePart, timePart] = dateTimeStr.split('T')
      const [year, month, day] = datePart.split('-').map(Number)
      const [hours, minutes] = timePart.split(':').map(Number)
      return new Date(year, month - 1, day, hours, minutes)
    }
    
    const startTime = parseDateTime(this.data.form.startTime)
    const endTime = parseDateTime(this.data.form.endTime)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startDate = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate())
    
    // 判断是今天还是明天
    const isToday = startDate.getTime() === today.getTime()
    const dateLabel = isToday ? '今天' : '明天'
    
    // 格式化显示时间（HH:mm）
    const formatDisplayTime = (date) => {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    
    const startTimeStr = formatDisplayTime(startTime)
    const endTimeStr = formatDisplayTime(endTime)
    
    // 判断是否是加急订单（立即上门）
    if (this.data.form.isUrgent) {
      const displayText = `立即上门（${startTimeStr} - ${endTimeStr}）`
      this.setData({
        'form.startTimeStr': displayText
      })
    } else {
      const displayText = `${dateLabel} ${startTimeStr} - ${endTimeStr}`
      this.setData({
        'form.startTimeStr': displayText
      })
    }
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
            console.error('上传图片失败')
            wx.showToast({ title: e.error || '上传失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      })
    } catch (e) {
      console.error('选择图片失败')
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
    // 如果开关被禁用，不允许操作
    if (this.data.isUrgentDisabled) {
      wx.showToast({
        title: '不在营业时间',
        icon: 'none'
      })
      // 重置开关状态
      this.setData({
        'form.isUrgent': false
      })
      return
    }
    
    const isUrgent = e.detail.value
    
    // 如果用户要开启立即上门，显示二次确认
    if (isUrgent) {
      const tipText = this.data.urgentTipText || '立即上门服务说明'
      wx.showModal({
        title: '提示',
        content: tipText,
        confirmText: '确认',
        cancelText: '取消',
        success: (modalRes) => {
          if (modalRes.confirm) {
            // 用户确认，开启加急
            this.setData({
              'form.isUrgent': true,
              // 重置时间选择器状态（加急订单不使用时间选择器）
              selectedDateIndex: -1,
              selectedTimeSlotIndex: -1
            })
            // 加急订单：自动设置当前时间到20分钟后
            this.setUrgentTime()
            // 更新提交状态
            this.updateCanSubmit()
          } else {
            // 用户取消，保持关闭状态
            this.setData({
              'form.isUrgent': false
            })
            // 更新提交状态
            this.updateCanSubmit()
          }
        }
      })
    } else {
      // 关闭加急，直接更新
      this.setData({
        'form.isUrgent': false
      })
      
      // 非加急订单：恢复时间选择器
      // 如果之前没有通过时间选择器选择时间（selectedDateIndex === -1 或 selectedTimeSlotIndex === -1），
      // 说明时间数据是加急时设置的，应该清空时间数据
      if (this.data.selectedDateIndex === -1 || this.data.selectedTimeSlotIndex === -1) {
        // 清空时间数据（因为加急时设置的时间不应该保留）
        this.setData({
          'form.startTime': null,
          'form.endTime': null,
          'form.startTimeStr': ''
        })
        // 初始化时间选择器
        this.initTimeSlots()
      } else {
        // 如果之前有通过时间选择器选择时间，根据时间数据更新显示文本
        this.updateTimeDisplayFromData()
      }
      // 更新提交状态
      this.updateCanSubmit()
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
    
    // 格式化显示时间（HH:mm）
    const formatDisplayTime = (date) => {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    
    const startTime = formatDateTime(now)
    const endTimeStr = formatDateTime(endTime)
    const displayText = `立即上门（${formatDisplayTime(now)} - ${formatDisplayTime(endTime)}）`
    
    // 重置时间选择器索引（加急订单不使用时间选择器）
    this.setData({
      'form.startTime': startTime,
      'form.endTime': endTimeStr,
      'form.startTimeStr': displayText,
      selectedDateIndex: -1,
      selectedTimeSlotIndex: -1
    })
    // 更新提交状态
    this.updateCanSubmit()
  },

  // 更新是否可以提交状态
  updateCanSubmit() {
    const hasStation = !!this.data.selectedStationId
    const hasAddress = !!this.data.selectedAddressId
    const hasPhoneTail = this.data.form.phoneTail && this.data.form.phoneTail.length === 4
    const hasTime = !!(this.data.form.startTime && this.data.form.endTime)
    
    // 如果是加急订单，不需要时间验证
    const canSubmit = hasStation && hasAddress && hasPhoneTail && (this.data.form.isUrgent || hasTime)
    
    // 生成未完成项提示
    const missingItems = []
    if (!hasStation) missingItems.push('取件驿站')
    if (!hasAddress) missingItems.push('收货地址')
    if (!hasPhoneTail) missingItems.push('手机尾号')
    if (!this.data.form.isUrgent && !hasTime) missingItems.push('预约时间')
    
    const submitTip = missingItems.length > 0 ? `请完成：${missingItems.join('、')}` : ''
    
    this.setData({ 
      canSubmitData: canSubmit,
      submitTip: submitTip
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
      
      // 检查选择的时间段是否已约满
      const selectedTimeSlot = this.data.timeSlotOptions[this.data.selectedTimeSlotIndex]
      if (selectedTimeSlot && (selectedTimeSlot.disabled || !selectedTimeSlot.available)) {
        wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
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

  // 请求订阅消息（快递订单相关模板）
  requestSubscribeMessage() {
    return new Promise((resolve) => {
      try {
        const templateIds = [
          'pXaibFtPuAC6FjFaKOvtyumdp15GAjYPKk5paT9ziPk', // 快递接单通知（服务上门提醒）
          'oeVEt-ycxcxsx1OsaDIEdRA56TXEhJim_bNZQQZIOqE', // 快递取件成功通知
          'f-S3WcL_jxE48yCcA7k4CQ2Bz50YhPDHvekCi2KLbFI'  // 快递送达通知（订单送达提醒）
        ]
        
        // 弹窗让用户订阅
        wx.requestSubscribeMessage({
          tmplIds: templateIds,
          success: (res) => {
            resolve(res)
          },
          fail: () => {
            console.error('[订阅消息] 调用失败')
            resolve(res)
          }
        })
      } catch (e) {
        console.error('[订阅消息] 异常')
        resolve(null)
      }
    })
  },

  // 提交订单
  async onSubmit() {
    // 防止重复提交
    if (this.data.isSubmitting) return

    // 如果时间选择器弹窗显示，不允许提交
    if (this.data.showTimePickerModal) return

    if (!this.validateForm()) return
    
    // 设置提交状态，禁用按钮
    this.setData({ isSubmitting: true })
    
    // 在下单前请求订阅消息
    // 注意：必须在用户点击的同步调用链中调用 wx.requestSubscribeMessage
    wx.hideLoading()
    
    // 同步调用 requestSubscribeMessage
    await this.requestSubscribeMessage()
    
    // 再次检查时间段是否已约满（防止用户通过其他方式选择了已约满的时间）
    if (!this.data.form.isUrgent) {
      // 直接使用时间数据检查时间段可用性（不依赖选择器索引，因为切换驿站后索引可能已重置）
      if (this.data.form.startTime && this.data.form.endTime) {
        try {
          // 2=快递代取，需要传递stationId
          const checkRes = await api.checkTimeSlotAvailability(2, this.data.form.startTime, this.data.form.endTime, this.data.selectedStationId, null)
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
            return
          }
        } catch (e) {
          console.error('检查时间段可用性失败')
          // 检查失败不影响提交，继续提交让后端验证
        }
      }
    }
    
    try {
      wx.showLoading({ title: '提交中...' })
      
      const orderData = {
        stationId: this.data.selectedStationId,
        addressId: this.data.selectedAddressId,
        phoneTail: this.data.form.phoneTail,
        pickPics: this.data.form.pickPics.length > 0 ? this.data.form.pickPics : null, // 如果为空传null
        pickCodes: this.data.form.pickCodes && this.data.form.pickCodes.trim() ? this.data.form.pickCodes.trim() : null, // 如果为空传null
        itemDescription: this.data.form.itemDescription,
        // 加急订单不传时间，后端自动计算
        startTime: this.data.form.isUrgent ? null : this.data.form.startTime,
        endTime: this.data.form.isUrgent ? null : this.data.form.endTime,
        isUrgent: this.data.form.isUrgent
      }
      
      const res = await api.createExpressOrder(orderData)

      if (res.success) {
        const orderNo = res.data?.orderNo || res.data?.order?.orderNo || res.orderNo
        // createExpressOrder 已经设置了 showSuccess: true，会自动显示成功提示
        // 但为了确保用户体验，我们仍然显示一次
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
        // 注意：跳转后不需要重置isSubmitting，因为页面会被销毁
      } else {
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
      console.error('提交订单异常')
      // 优先显示后端返回的错误消息
      const errorMsg = e.message || e.error || '提交失败'
      wx.showToast({ 
        title: errorMsg, 
        icon: 'none',
        duration: 2000
      })
      // 重置提交状态，允许重新提交
      this.setData({ isSubmitting: false })
    } finally {
      wx.hideLoading()
    }
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
    const dateOption = this.data.dateOptions[index]
    
    if (dateOption) {
      // 根据选择的日期更新时间段选项
      const timeSlotOptions = dateOption.isToday 
        ? this.data.todayTimeSlots 
        : this.data.tomorrowTimeSlots
      
      // 重置时间段选择（不自动选择，让用户手动选择）
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

  // 选择时间段（弹窗中，仅更新选中状态，不更新时间数据）
  selectTimeSlot(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const timeSlot = this.data.timeSlotOptions[index]
    
    if (!timeSlot) return
    
    // 检查是否已约满
    if (timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
      return
    }
    
    // 必须先选择日期
    if (this.data.selectedDateIndex === -1) {
      wx.showToast({ title: '请先选择日期', icon: 'none' })
      return
    }
    
    // 仅更新选中状态，不更新时间数据（时间数据在确认时更新）
    this.setData({
      selectedTimeSlotIndex: index
    })
  },

  // 确认时间选择
  confirmTimeSelection() {
    if (this.data.selectedDateIndex === -1 || this.data.selectedTimeSlotIndex === -1) {
      wx.showToast({ title: '请选择完整的时间', icon: 'none' })
      return
    }
    
    const timeSlot = this.data.timeSlotOptions[this.data.selectedTimeSlotIndex]
    if (!timeSlot || timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
      return
    }
    
    // 计算开始时间和结束时间
    const dateOption = this.data.dateOptions[this.data.selectedDateIndex]
    const isToday = dateOption.isToday
    
    const startTime = this.formatDateTime(timeSlot.startTime, !isToday)
    const endTime = this.formatDateTime(timeSlot.endTime, !isToday)
    
    // 显示文本：今天 14:30 - 15:00
    const displayText = `${dateOption.label} ${timeSlot.label}`
    
    // 更新时间数据和显示文本
    this.setData({
      'form.startTime': startTime,
      'form.endTime': endTime,
      'form.startTimeStr': displayText,
      showTimePickerModal: false
    })
    
    // 更新提交状态
    this.updateCanSubmit()
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    const index = e.currentTarget.dataset.index
    const urls = this.data.form.pickPics
    
    wx.previewImage({
      current: url,
      urls: urls
    })
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
