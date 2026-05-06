// pages/recycle/index.js
const { api } = require('../../utils/util.js')

// 允许选择的天：上门回收从明天开始，连续6天
const ALLOWED_DAYS_RECYCLE = [1, 2, 3, 4, 5, 6]
const WEEKDAY_TEXT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function getDateStrByDayOffset(dayOffset) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildDateLabelByDayOffset(dayOffset) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const weekday = WEEKDAY_TEXT[d.getDay()]
  return `${month}-${day} ${weekday}`
}

function buildDateOptions(dayOffsets) {
  return dayOffsets.map(dayOffset => ({
    label: buildDateLabelByDayOffset(dayOffset),
    isToday: dayOffset === 0,
    dayOffset
  }))
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** 预约日期字符串 YYYY-MM-DD 相对本地「今天 0 点」的天数差：当天=0，明天=1 */
function dayOffsetFromTodayForDatePart(datePart) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart || '')
  if (!m) return NaN
  const y = Number(m[1])
  const mo = Number(m[2])
  const day = Number(m[3])
  const chosen = new Date(y, mo - 1, day)
  const today = startOfLocalDay(new Date())
  return Math.round((chosen.getTime() - today.getTime()) / MS_PER_DAY)
}

function getAppointmentDayOffsetFromFormStart(formStartTime) {
  if (!formStartTime || typeof formStartTime !== 'string') return NaN
  const s = formStartTime.trim()
  let datePart = ''
  const tIdx = s.indexOf('T')
  if (tIdx !== -1) datePart = s.slice(0, tIdx)
  else {
    const q = /^(\d{4}-\d{2}-\d{2})/.exec(s)
    datePart = q ? q[1] : ''
  }
  return dayOffsetFromTodayForDatePart(datePart)
}

/** 表单里的开始/结束时间可能是 `T` 拼接或空格分隔，取日历日期部分 YYYY-MM-DD */
function calendarDatePartFromFormDatetime(formTime) {
  if (!formTime || typeof formTime !== 'string') return ''
  const s = formTime.trim()
  const tIdx = s.indexOf('T')
  if (tIdx !== -1) return s.slice(0, tIdx)
  const q = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return q ? q[1] : ''
}

/** 是否与当前页配置的上门回收预约日列表一致（默认可选明天起连续6天） */
function isRecycleDayOffsetConfigured(dayOffset, allowedDays) {
  const list = Array.isArray(allowedDays) && allowedDays.length ? allowedDays : ALLOWED_DAYS_RECYCLE
  return Number.isFinite(dayOffset) && list.includes(dayOffset)
}

function getValidRecycleImageUrls(images) {
  if (!Array.isArray(images)) return []
  return images.filter(u => typeof u === 'string' && u.trim().length > 0)
}

/** 预约上门：日期须在允许偏移内，且起止同一天 */
function isRecycleAppointmentWindowValid(form, allowedDays) {
  if (!form || !form.startTime || !form.endTime) return false
  const off = getAppointmentDayOffsetFromFormStart(form.startTime)
  if (!isRecycleDayOffsetConfigured(off, allowedDays)) return false
  const sd = calendarDatePartFromFormDatetime(form.startTime)
  const ed = calendarDatePartFromFormDatetime(form.endTime)
  return !!(sd && ed && sd === ed)
}

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
    
    // 提交按钮提示信息
    submitTip: '',
    
    // 快捷选项（从后端获取）
    quickOptions: [],
    
    // 时间选择相关
    timeType: 'appointment', // 'immediate' 立即上门 或 'appointment' 预约时间
    allowedDays: ALLOWED_DAYS_RECYCLE,
    dateOptions: [], // 日期选项（由 allowedDays 生成）
    timeSlotOptions: [], // 时间段选项（14:30-15:00等）
    timeSlotsByDay: [], // 按允许的天分别存储时间段
    selectedDateIndex: -1, // 选中的日期索引
    selectedTimeSlotIndex: -1, // 选中的时间段索引
    checkingAvailability: false, // 是否正在检查可用性
    showTimePickerModal: false, // 是否显示时间选择器弹窗
    urgentTipText: '', // 立即上门提示文案

    // 今日衣服回收价格：最低价 recycling_price_per_kg（后端），最高价与说明为固定文案
    todayRecyclePrice: '0.6',
    todayRecyclePriceMax: '1',
    todayRecyclePriceText: '',
    todayRecyclePriceNotice: '手机，电脑，空调，电视，洗衣机，冰箱按个现场结算',
    
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
    
    // 初始化提交状态（显示提示信息）
    this.updateCanSubmit()
  },

  onShow() {
    // 如果刚刚从地址选择页面返回，且已经有地址了
    if (this.data.fromAddressSelect && this.data.defaultAddress) {
      // 清除标记
      this.setData({ fromAddressSelect: false })
      
      // 选择地址后，清空时间数据（因为不同地址对应的回收点不同，时间段选项也会不同）
      this.setData({
        selectedDateIndex: -1,
        selectedTimeSlotIndex: -1,
        'form.startTime': null,
        'form.endTime': null,
        'form.startTimeStr': ''
      })
      
      // 从地址选择页面返回，且已经有地址，说明地址选择页面已经更新了数据
      // 更新提交状态
      this.updateCanSubmit()
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
        this.setData({ quickOptions: ['易拉罐', '旧家电', '金属', '塑料瓶', '旧衣服', '废旧电池'] })
      }
    } catch (e) {
      console.error('加载备注快捷选项失败')
      // 如果获取失败，使用默认值
      this.setData({ quickOptions: ['易拉罐', '旧家电', '金属', '塑料瓶', '旧衣服', '废旧电池'] })
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
      console.error('加载默认地址失败')
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
        console.error('加载预选地址失败')
      }
    }
  },

  // 更新是否可以提交状态
  updateCanSubmit() {
    const hasAddress = !!this.data.selectedAddressId
    const hasRecyclingPoint = !!this.data.selectedRecyclingPointId
    const hasTime = !!(this.data.form.startTime && this.data.form.endTime)
    const validImageUrls = getValidRecycleImageUrls(this.data.form.images)
    const hasImages = validImageUrls.length > 0
    const hasRemark = !!(this.data.form.itemDescription && this.data.form.itemDescription.trim())
    const isImmediate = this.data.timeType === 'immediate'
    const allowedDays = this.data.allowedDays || ALLOWED_DAYS_RECYCLE

    let appointmentWindowOk = true
    if (!isImmediate) {
      appointmentWindowOk = hasTime && isRecycleAppointmentWindowValid(this.data.form, allowedDays)
    }

    const canSubmit =
      hasAddress &&
      hasRecyclingPoint &&
      hasImages &&
      hasRemark &&
      (isImmediate || appointmentWindowOk)
    
    // 生成未完成项提示
    const missingItems = []
    if (!hasAddress) missingItems.push('收货地址')
    if (!hasRecyclingPoint) missingItems.push('回收点')
    if (!hasImages) missingItems.push('拍照留念')
    if (!hasRemark) missingItems.push('备注')
    if (!isImmediate && !hasTime) missingItems.push('预约时间')
    if (!isImmediate && hasTime && !appointmentWindowOk) missingItems.push('预约须选明天起的可选时段')
    
    const submitTip = missingItems.length > 0 ? `请完成：${missingItems.join('、')}` : ''
    
    this.setData({ 
      canSubmitData: canSubmit,
      submitTip: submitTip
    })
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
          // 切换回收点后，时间段选项已改变，需要清空之前选择的时间
          // 因为不同回收点的时间段选项不同，之前选择的时间在新回收点可能不可用
          this.setData({
            selectedDateIndex: -1,
            selectedTimeSlotIndex: -1,
            'form.startTime': null,
            'form.endTime': null,
            'form.startTimeStr': ''
          })
          this.initTimeSlots()
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
      console.error('加载回收点失败')
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
      console.error('加载立即上门提示文案失败')
    }
  },

  // 今日衣服回收价格：最低价读配置 recycling_price_per_kg；其余文案固定
  async loadTodayRecyclePrice() {
    const fixedTitle = '今日衣服回收价格'
    const fixedMax = '1'
    const fixedNotice = '手机，电脑，空调，电视，洗衣机，冰箱按个现场结算'
    const fallbackMin = '0.6'

    let minPrice = fallbackMin
    try {
      const res = await api.getConfigValue('recycling_price_per_kg')
      if (res && res.success && res.data != null && res.data !== '') {
        const value = String(res.data).trim()
        if (value) minPrice = value
      }
    } catch (e) {
      console.error('加载衣服回收底价失败')
    }

    this.setData({
      todayRecyclePrice: minPrice,
      todayRecyclePriceMax: fixedMax,
      todayRecyclePriceText: fixedTitle,
      todayRecyclePriceNotice: fixedNotice
    })
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
            // setImmediateTime 内部已经调用了 updateCanSubmit
          } else {
            // 用户取消，保持关闭状态，需要重置switch
            // 由于switch已经改变了，我们需要通过设置timeType来重置
            // 但这里有个问题，switch的状态已经改变了，我们需要手动重置
            // 可以通过延迟设置来确保switch状态正确
            setTimeout(() => {
              // 不设置timeType，因为已经是appointment了
              // 但需要确保switch显示为关闭状态
            }, 50)
            // 更新提交状态
            this.updateCanSubmit()
          }
        }
      })
    } else {
      // 关闭立即上门，直接切换
      this.setData({ timeType: 'appointment' })
      
      // 非预约时间：恢复时间选择器
      // 如果之前没有通过时间选择器选择时间（selectedDateIndex === -1 或 selectedTimeSlotIndex === -1），
      // 说明时间数据是立即上门时设置的，应该清空时间数据
      if (this.data.selectedDateIndex === -1 || this.data.selectedTimeSlotIndex === -1) {
        // 清空时间数据（因为立即上门时设置的时间不应该保留）
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
    
    // 重置时间选择器索引（立即上门不使用时间选择器）
    this.setData({
      'form.startTime': startTimeStr,
      'form.endTime': endTimeStr,
      'form.startTimeStr': displayText,
      selectedDateIndex: -1,
      selectedTimeSlotIndex: -1
    })
    
    // 更新提交状态
    this.updateCanSubmit()
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
    
    // 展示日期 + 星期（例如：04-29 周三）
    const dayOffset = Math.max(0, Math.round((startDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)))
    const dateLabel = buildDateLabelByDayOffset(dayOffset)
    
    // 格式化显示时间（HH:mm）
    const formatDisplayTime = (date) => {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    
    const startTimeStr = formatDisplayTime(startTime)
    const endTimeStr = formatDisplayTime(endTime)
    
    // 判断是否是立即上门
    if (this.data.timeType === 'immediate') {
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

  // 初始化时间选择器（预约时间）。允许选择的天由 allowedDays 控制
  async initTimeSlots() {
    const now = new Date()
    const allowedDays = this.data.allowedDays || ALLOWED_DAYS_RECYCLE
    const dateOptions = buildDateOptions(allowedDays)

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
      console.error('获取可预约时间配置失败')
      }
    }
    
    // 解析时间范围（格式：HH:mm-HH:mm）
    const [startTimeStr, endTimeStr] = appointmentTimeRange.split('-')
    const [startHour, startMinute] = startTimeStr.split(':').map(Number)
    const [endHour, endMinute] = endTimeStr.split(':').map(Number)
    const configStartMinutes = startHour * 60 + startMinute
    const configEndMinutes = endHour * 60 + endMinute
    
    // 生成时间段选项（30分钟一个时间段）
    const buildSlotsByOffset = (dayOffset) => {
      const daySlots = []
      let dayStartMinutes = configStartMinutes

      // 若某天改为包含今天，今天起始时间需要从下一半小时开始
      if (dayOffset === 0) {
        let currentMinutes = now.getHours() * 60 + now.getMinutes()
        if (now.getMinutes() > 0 && now.getMinutes() < 30) {
          currentMinutes = now.getHours() * 60 + 30
        } else if (now.getMinutes() >= 30) {
          currentMinutes = (now.getHours() + 1) * 60
        } else {
          currentMinutes = now.getHours() * 60 + 30
        }
        dayStartMinutes = Math.max(configStartMinutes, currentMinutes)
      }

      if (dayStartMinutes >= configEndMinutes) return daySlots

      for (let startMinutes = dayStartMinutes; startMinutes < configEndMinutes; startMinutes += 30) {
        const endMinutes = startMinutes + 30
        if (endMinutes > configEndMinutes) break

        const sHour = Math.floor(startMinutes / 60)
        const sMin = startMinutes % 60
        const eHour = Math.floor(endMinutes / 60)
        const eMin = endMinutes % 60
        const startTime = `${String(sHour).padStart(2, '0')}:${String(sMin).padStart(2, '0')}`
        const endTime = `${String(eHour).padStart(2, '0')}:${String(eMin).padStart(2, '0')}`
        daySlots.push({
          label: `${startTime} - ${endTime}`,
          startTime,
          endTime,
          isToday: dayOffset === 0,
          available: true,
          disabled: false
        })
      }
      return daySlots
    }

    // 按 dayOffset 顺序组装 timeSlotsByDay（明天起连续6天）
    const timeSlotsByDay = dateOptions.map(opt => buildSlotsByOffset(opt.dayOffset))
    let defaultTimeSlotOptions = timeSlotsByDay[0] || []
    let defaultDateIndex = 0
    for (let i = 0; i < timeSlotsByDay.length; i++) {
      if (timeSlotsByDay[i] && timeSlotsByDay[i].length > 0) {
        defaultTimeSlotOptions = timeSlotsByDay[i]
        defaultDateIndex = i
        break
      }
    }

    this.setData({
      dateOptions,
      timeSlotsByDay,
      timeSlotOptions: defaultTimeSlotOptions,
      selectedDateIndex: defaultDateIndex
    })
    
    // 检查所有时间段的可用性（需要先选择回收点）
    // 如果已选择回收点，则检查可用性；否则在回收点加载后会自动检查
    if (this.data.selectedRecyclingPointId) {
      this.checkAllTimeSlotsAvailability()
    }
    
    // 更新提交状态（不自动选择时间段）
    // 注意：initTimeSlots 不应该保留之前的时间数据，因为时间段选项可能已改变
    this.updateCanSubmit()
  },

  // 检查所有时间段的可用性（仅请求 allowedDays 对应的日期）
  async checkAllTimeSlotsAvailability() {
    if (this.data.checkingAvailability) return
    if (!this.data.selectedRecyclingPointId) return
    const dayOffsets = this.data.allowedDays || ALLOWED_DAYS_RECYCLE
    const dateOptions = this.data.dateOptions.length ? this.data.dateOptions : buildDateOptions(dayOffsets)
    this.setData({ checkingAvailability: true })

    try {
      const dateStrs = dateOptions.map(opt => getDateStrByDayOffset(opt.dayOffset))
      const results = await Promise.all(
        dateStrs.map(dateStr => api.getTimeSlotList(3, dateStr, null, this.data.selectedRecyclingPointId, null))
      )
      const mapSlots = (list, isToday) => (list || []).map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        isToday: !!isToday,
        available: !!slot.available,
        disabled: !slot.available,
        label: !slot.available ? `${slot.startTime} - ${slot.endTime} (已约满)` : `${slot.startTime} - ${slot.endTime}`
      }))
      const timeSlotsByDay = results.map((res, i) =>
        (res.success && res.data && res.data.timeSlots)
          ? mapSlots(res.data.timeSlots, dateOptions[i].dayOffset === 0)
          : []
      )
      let defaultTimeSlotOptions = timeSlotsByDay[0] || []
      let defaultDateIndex = 0
      for (let i = 0; i < timeSlotsByDay.length; i++) {
        if (timeSlotsByDay[i] && timeSlotsByDay[i].length > 0) {
          defaultTimeSlotOptions = timeSlotsByDay[i]
          defaultDateIndex = i
          break
        }
      }
      this.setData({
        timeSlotsByDay,
        timeSlotOptions: defaultTimeSlotOptions,
        selectedDateIndex: defaultDateIndex,
        selectedTimeSlotIndex: -1
      })
      this.updateCanSubmit()
    } catch (e) {
      console.error('获取时间段列表失败')
    } finally {
      this.setData({ checkingAvailability: false })
    }
  },

  // 日期选择变化
  onDateChange(e) {
    const index = parseInt(e.detail.value)
    const timeSlotsByDay = this.data.timeSlotsByDay || []
    const timeSlotOptions = timeSlotsByDay[index] || []
    this.setData({
      selectedDateIndex: index,
      timeSlotOptions,
      selectedTimeSlotIndex: -1,
      'form.startTime': null,
      'form.endTime': null,
      'form.startTimeStr': ''
    })
    this.updateCanSubmit()
  },

  // 时间段选择变化
  onTimeSlotChange(e) {
    const index = parseInt(e.detail.value, 10)
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
    
    const dateIdx = this.data.selectedDateIndex
    const dateOptions = this.data.dateOptions || []
    if (
      !Number.isInteger(dateIdx) ||
      dateIdx < 0 ||
      dateIdx >= dateOptions.length ||
      !dateOptions[dateIdx]
    ) {
      wx.showToast({ title: '请先选择预约日期', icon: 'none' })
      return
    }
    const selectedDate = dateOptions[dateIdx]
    const dayOffset = selectedDate.dayOffset
    const allowedDays = this.data.allowedDays || ALLOWED_DAYS_RECYCLE
    if (!Number.isFinite(dayOffset) || !allowedDays.includes(dayOffset)) {
      wx.showToast({ title: '该日期不可预约，请重新选择', icon: 'none' })
      return
    }
    const dateLabel = selectedDate.label
    const startTime = this.formatDateTimeByDayOffset(timeSlot.startTime, dayOffset)
    const endTime = this.formatDateTimeByDayOffset(timeSlot.endTime, dayOffset)
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
    const { canOpenTimePicker } = require('../../utils/timePickerGuard.js')
    const ok = canOpenTimePicker({
      hasAddress: !!this.data.selectedAddressId,
      hasPoint: !!this.data.selectedRecyclingPointId,
      hasSlots: !!(this.data.dateOptions.length && this.data.timeSlotsByDay.length),
      messages: {
        noAddress: '请先选择收货地址',
        noPoint: '该地址不在服务范围内或未匹配回收点',
        noSlots: '当前暂无可预约时间，请稍后再试'
      }
    })
    if (!ok) return
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

  // 选择日期（弹窗中，来自时间选择组件）
  selectDate(e) {
    const index = parseInt(e.detail.index, 10)
    const timeSlotsByDay = this.data.timeSlotsByDay || []
    if (!Number.isInteger(index) || index < 0 || index >= timeSlotsByDay.length) return
    const timeSlotOptions = timeSlotsByDay[index] || []
    this.setData({
      selectedDateIndex: index,
      timeSlotOptions,
      selectedTimeSlotIndex: -1,
      'form.startTime': null,
      'form.endTime': null,
      'form.startTimeStr': ''
    })
    this.updateCanSubmit()
  },

  // 选择时间段（弹窗中，仅更新选中状态，不更新时间数据，来自时间选择组件）
  selectTimeSlot(e) {
    const index = parseInt(e.detail.index, 10)
    const options = this.data.timeSlotOptions || []
    if (!Number.isInteger(index) || index < 0 || index >= options.length) return
    const timeSlot = options[index]
    if (!timeSlot) return
    
    // 检查是否已约满
    if (timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
      return
    }
    
    // 仅更新选中状态，不更新时间数据（时间数据在确认时更新）
    this.setData({
      selectedTimeSlotIndex: index
    })
  },

  // 确认时间选择
  confirmTimeSelection() {
    const dsi = this.data.selectedDateIndex
    const tsi = this.data.selectedTimeSlotIndex
    if (!Number.isInteger(dsi) || dsi < 0 || !Number.isInteger(tsi) || tsi < 0) {
      wx.showToast({ title: '请选择日期和时间段', icon: 'none' })
      return
    }
    const timeSlot = this.data.timeSlotOptions[this.data.selectedTimeSlotIndex]
    if (!timeSlot || timeSlot.disabled || !timeSlot.available) {
      wx.showToast({ title: '该时间段已约满，请选择其他时间段', icon: 'none' })
      return
    }
    const idx = this.data.selectedDateIndex
    const dateOptions = this.data.dateOptions || []
    if (
      !Number.isInteger(idx) ||
      idx < 0 ||
      idx >= dateOptions.length ||
      !dateOptions[idx]
    ) {
      wx.showToast({ title: '请选择预约日期', icon: 'none' })
      return
    }
    const selectedDate = dateOptions[idx]
    const dayOffset = selectedDate.dayOffset
    const allowedDays = this.data.allowedDays || ALLOWED_DAYS_RECYCLE
    if (!Number.isFinite(dayOffset) || !allowedDays.includes(dayOffset)) {
      wx.showToast({ title: '该日期不可预约', icon: 'none' })
      return
    }
    const dateLabel = selectedDate.label
    const startTime = this.formatDateTimeByDayOffset(timeSlot.startTime, dayOffset)
    const endTime = this.formatDateTimeByDayOffset(timeSlot.endTime, dayOffset)
    this.setData({
      'form.startTime': startTime,
      'form.endTime': endTime,
      'form.startTimeStr': `${dateLabel} ${timeSlot.label}`,
      showTimePickerModal: false
    })
    this.updateCanSubmit()
  },

  formatDateTimeByDayOffset(timeStr, dayOffset) {
    const d = new Date()
    const delta = Number.isFinite(dayOffset) ? dayOffset : 0
    d.setDate(d.getDate() + delta)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${timeStr}:00`
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
              this.updateCanSubmit()
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
    this.updateCanSubmit()
  },

  // 输入物品备注
  onInputItemRemark(e) {
    this.setData({
      'form.itemDescription': e.detail.value
    })
    this.updateCanSubmit()
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
      this.updateCanSubmit()
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
    this.updateCanSubmit()
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

    if (getValidRecycleImageUrls(this.data.form.images).length === 0) {
      wx.showToast({ title: '请先上传回收物图片', icon: 'none' })
      return false
    }

    if (!this.data.form.itemDescription || !this.data.form.itemDescription.trim()) {
      wx.showToast({ title: '请填写备注信息', icon: 'none' })
      return false
    }
    
    // 加急订单不需要验证时间段
    if (this.data.timeType !== 'immediate') {
      if (!this.data.form.startTime || !this.data.form.endTime) {
        wx.showToast({ title: '请选择上门时间范围', icon: 'none' })
        return false
      }

      const allowedDays = this.data.allowedDays || ALLOWED_DAYS_RECYCLE
      if (!isRecycleAppointmentWindowValid(this.data.form, allowedDays)) {
        const apptDayOffset = getAppointmentDayOffsetFromFormStart(this.data.form.startTime)
        if (!isRecycleDayOffsetConfigured(apptDayOffset, allowedDays)) {
          wx.showToast({
            title: '回收仅支持预约明天起的时段，请重新选择时间',
            icon: 'none'
          })
        } else {
          wx.showToast({ title: '预约开始与结束须为同一天，请重新选择', icon: 'none' })
        }
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
            resolve(res)
          },
          fail: (res) => {
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

  // 同步解锁提交（setData 异步，仅靠 isSubmitting 无法拦住极快双击）
  _releaseRecycleSubmit() {
    this._recycleSubmitSyncLock = false
    if (this.data.isSubmitting) {
      this.setData({ isSubmitting: false })
    }
  },

  // 提交订单
  async submitOrder() {
    // 如果时间选择器弹窗显示，不允许提交
    if (this.data.showTimePickerModal) return

    // 同步互斥：防止用户在 setData 生效前双击触发两次下单
    if (this._recycleSubmitSyncLock) return
    
    if (!this.validateForm()) {
      return
    }

    this._recycleSubmitSyncLock = true
    this.setData({ isSubmitting: true })
    
    // 如果地址不在服务范围内，提示用户
    if (!this.data.recyclingPointName) {
      wx.showModal({
        title: '提示',
        content: '该地址不在服务范围内，无法提交订单',
        showCancel: false
      })
      this._releaseRecycleSubmit()
      return
    }
    
    // 在下单前请求订阅消息
    // 注意：必须在用户点击的同步调用链中调用 wx.requestSubscribeMessage
    wx.hideLoading()
    
    // 同步调用 requestSubscribeMessage
    await this.requestSubscribeMessage()

    // 订阅弹窗关闭后状态可能变化，提交前再校验一遍（图片、预约日等）
    if (!this.validateForm()) {
      this._releaseRecycleSubmit()
      return
    }
    
    const isUrgent = this.data.timeType === 'immediate'
    
    // 再次检查时间段是否已约满（防止用户通过其他方式选择了已约满的时间）
    if (!isUrgent) {
      // 直接使用时间数据检查时间段可用性（不依赖选择器索引，因为切换回收点后索引可能已重置）
      if (this.data.form.startTime && this.data.form.endTime) {
        try {
          // 3=上门回收，需要传递recyclingPointId
          const checkRes = await api.checkTimeSlotAvailability(3, this.data.form.startTime, this.data.form.endTime, null, this.data.selectedRecyclingPointId, null)
          // 注意：checkRes.data 是 {available: true/false, message: "..."}
          if (!checkRes.success || !(checkRes.data && checkRes.data.available)) {
            wx.showToast({ 
              title: (checkRes.data && checkRes.data.message) || checkRes.message || '该时间段已约满，请选择其他时间段', 
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
            this._releaseRecycleSubmit()
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
      
      const imageUrls = getValidRecycleImageUrls(this.data.form.images)
      if (imageUrls.length === 0) {
        wx.showToast({ title: '请先上传回收物图片', icon: 'none' })
        this._releaseRecycleSubmit()
        return
      }

      const payload = {
        addressId: this.data.selectedAddressId,
        // 加急订单不传时间，后端自动计算
        startTime: isUrgent ? null : this.data.form.startTime,
        endTime: isUrgent ? null : this.data.form.endTime,
        // 后端需要这些字段，但前端已隐藏，传默认值
        estWeight: null,
        itemDescription: this.data.form.itemDescription.trim(),
        // 回收点ID（如果前端没有选择，后端会根据地址自动选择第一个）
        recyclingPointId: this.data.selectedRecyclingPointId,
        // 是否加急（立即上门）
        isUrgent: isUrgent,
        images: imageUrls
      }
      
      const res = await api.createRecyclingOrder(payload)

      if (res.success) {
        const orderNo = (res.data && res.data.orderNo) || (res.data && res.data.order && res.data.order.orderNo) || res.orderNo
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
        // 如果 success 为 false，但进入了这里（不应该发生，因为会 reject），显示错误
        wx.showToast({ 
          title: res.message || res.error || '提交失败', 
          icon: 'none',
          duration: 2000
        })
        this._releaseRecycleSubmit()
      }
    } catch (e) {
      console.error('提交订单异常')
      // 优先显示后端返回的错误消息
      const errorMsg = e.message || e.error || '提交失败，请稍后重试'
      wx.showToast({ 
        title: errorMsg, 
        icon: 'none',
        duration: 2000
      })
      this._releaseRecycleSubmit()
    } finally {
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

