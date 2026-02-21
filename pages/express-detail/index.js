// pages/express-detail/index.js
const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')

Page({
  data: {
    orderNo: '',
    orderDetail: null,
    loading: true,
    isFirstLoad: true, // 标记是否是首次加载
    amountStr: '0.00',
    // 金额明细展示用
    originalAmountStr: '0.00',
    finalAmountStr: '0.00',
    discountAmountStr: '0.00',
    hasDiscount: false,
    couponName: ''
  },

  onLoad(options) {
    if (options.orderNo) {
      this.setData({ 
        orderNo: options.orderNo
      })
      this.loadOrderDetail()
    } else {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 页面显示时刷新订单详情（从支付页面返回时会触发）
  onShow() {
    // 如果不是首次加载（说明是从其他页面返回的），则刷新订单详情
    // 这样可以确保从支付页面返回后能看到最新的订单状态
    if (this.data.orderNo && !this.data.isFirstLoad) {
      this.loadOrderDetail()
    }
  },

  // 加载订单详情
  async loadOrderDetail() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await api.getExpressOrderDetail(this.data.orderNo)
      
      if (res.success && res.data) {
        const detail = res.data

        // 处理图片列表，确保是数组
        if (detail.pickPics && !Array.isArray(detail.pickPics)) {
          detail.pickPics = []
        }
        // pickCodes 现在是字符串格式，不需要数组检查
        if (detail.expressPics && !Array.isArray(detail.expressPics)) {
          detail.expressPics = []
        }
        if (detail.sendSucPics && !Array.isArray(detail.sendSucPics)) {
          detail.sendSucPics = []
        }
        
        // 评分默认5分并生成星数组
        detail.courierRating = 5
        detail.courierRatingArray = [1, 2, 3, 4, 5]

        // 统一金额：实际金额优先，其次总金额
        const amountVal = detail.actualAmount != null ? detail.actualAmount : detail.expressPrice != null ? detail.expressPrice : detail.totalAmount
        const amountNum = amount.parseBigDecimalLike(amountVal, 0)
        detail.amount = amountNum
        const amountStr = amount.formatAmount(amountNum)

        // 预处理时间字段，格式化后直接存储在对象中（保留用于兼容）
        detail.createdAtFormatted = this.formatTime(detail.createdAt)
        detail.bandingTimeFormatted = this.formatTime(detail.bandingTime)
        detail.actPickTimeFormatted = this.formatTime(detail.actPickTime)
        detail.sendSucTimeFormatted = this.formatTime(detail.sendSucTime)
        detail.paidAtFormatted = this.formatTime(detail.paidAt)
        
        // 处理时间线事件记录（后端返回）
        if (detail.timeline && Array.isArray(detail.timeline)) {
          // 为每个时间线事件格式化时间，并确保数据格式正确
          detail.timeline.forEach(event => {
            if (event.time) {
              event.timeFormatted = this.formatTime(event.time)
            }
            // 确保 event.data 存在
            if (!event.data) {
              event.data = {}
            }
            // pickCodes 现在是字符串格式，确保是字符串
            if (event.data.pickCodes !== undefined && event.data.pickCodes !== null) {
              if (typeof event.data.pickCodes !== 'string') {
                // 如果不是字符串，转换为字符串
                if (Array.isArray(event.data.pickCodes)) {
                  event.data.pickCodes = event.data.pickCodes.filter(code => code && String(code).trim()).join('、')
                } else {
                  event.data.pickCodes = String(event.data.pickCodes)
                }
              }
            }
            // 确保 pickPics 是数组格式
            if (event.data.pickPics && !Array.isArray(event.data.pickPics)) {
              event.data.pickPics = []
            }
            // 格式化预约时间段（CREATED事件）
            if (event.type === 'CREATED' && event.data.startTime && event.data.endTime) {
              // 格式化开始时间和结束时间
              const formatted = this.formatTimeRange(event.data.startTime, event.data.endTime)
              event.data.timeRangeFormatted = formatted
            }
          })
        } else {
          detail.timeline = []
        }

        // 使用后端返回的进度条步骤（如果后端没有返回，则使用空数组）
        if (!detail.progressSteps || !Array.isArray(detail.progressSteps)) {
          detail.progressSteps = []
        }
        
        // 计算进度百分比（用于进度条填充）
        const progressPercent = this.calculateProgressPercent(detail.progressSteps)

        // 基于订单详情接口直接渲染金额与优惠信息（后端已返回 actualAmount/couponId/couponName/discountAmount）
        const origSrc = detail.totalAmount != null ? detail.totalAmount : (detail.expressPrice != null ? detail.expressPrice : 0)
        const actSrc = detail.actualAmount != null ? detail.actualAmount : origSrc
        const discSrc = detail.discountAmount != null ? detail.discountAmount : (amount.parseBigDecimalLike(origSrc, 0) - amount.parseBigDecimalLike(actSrc, 0))
        const orig = amount.parseBigDecimalLike(origSrc, 0)
        const act = amount.parseBigDecimalLike(actSrc, 0)
        const disc = Math.max(0, amount.parseBigDecimalLike(discSrc, 0))

        const canShowContact = detail.courierId && detail.expressStatus >= 2 && detail.expressStatus <= 7 && detail.expressStatus !== 5 && detail.expressStatus !== 6
        
        this.setData({
          orderDetail: detail,
          amountStr: amountStr,
          originalAmountStr: amount.formatAmount(orig),
          finalAmountStr: amount.formatAmount(act),
          discountAmountStr: amount.formatAmount(disc),
          hasDiscount: orig > act,
          couponName: detail.couponName || '',
          progressPercent: progressPercent,
          loading: false,
          isFirstLoad: false
        })
      } else {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (e) {
      console.error('加载订单详情失败')
      wx.showToast({ title: '加载失败', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } finally {
      wx.hideLoading()
    }
  },

  // 计算进度步骤
  calculateProgressSteps(detail) {
    const steps = []
    const status = detail.expressStatus || 1
    
    // 1. 已预约
    steps.push({
      key: 'scheduled',
      title: '已预约',
      status: 'completed',
      time: detail.createdAt,
      show: true
    })
    
    // 2. 待取件（业务员接单）
    steps.push({
      key: 'pending_pickup',
      title: '待取件',
      status: status >= 2 ? 'completed' : status === 1 ? 'waiting' : 'disabled',
      time: null, // 需要业务员接单时间（暂时没有）
      show: true
    })
    
    // 3. 运输中（取件成功）
    steps.push({
      key: 'in_transit',
      title: '运输中',
      status: status >= 3 ? 'completed' : status === 2 ? 'waiting' : 'disabled',
      time: detail.actPickTime,
      show: true
    })
    
    // 4. 待支付（送达）
    // 状态判断：status === 4 (待支付) → waiting, status === 7 (支付中) 或 status === 5 (已支付) → completed
    let waitPayStatus = 'disabled'
    if (status === 4) {
      waitPayStatus = 'waiting'  // 待支付状态，显示为等待中
    } else if (status === 7 || status === 5) {
      waitPayStatus = 'completed'  // 支付中或已支付，待支付步骤已完成
    } else if (status === 3) {
      waitPayStatus = 'waiting'  // 运输中，下一步是待支付
    }
    steps.push({
      key: 'wait_pay',
      title: '待支付',
      status: waitPayStatus,
      time: detail.sendSucTime,
      show: true
    })
    
    // 5. 已支付
    // 状态判断：status === 4 (待支付) → waiting, status === 7 (支付中) → waiting, status === 5 (已支付) → completed
    let paidStatus = 'disabled'
    if (status === 4 || status === 7) {
      paidStatus = 'waiting'  // 待支付或支付中状态，显示为等待中
    } else if (status === 5) {
      paidStatus = 'completed'  // 已支付状态，显示为已完成
    }
    steps.push({
      key: 'paid',
      title: '已支付',
      status: paidStatus,
      time: detail.paidAt,
      show: true
    })
    
    // 为每个步骤添加连接线状态（基于前一个步骤的状态）
    for (let i = 0; i < steps.length; i++) {
      if (i > 0) {
        // 连接线的状态由前一个步骤决定
        steps[i].lineStatus = steps[i - 1].status === 'completed' ? 'completed' : 'disabled'
      }
    }
    
    return steps
  },

  // 计算进度百分比
  calculateProgressPercent(steps) {
    if (!steps || steps.length === 0) return 0
    
    // 找到当前进行中的节点索引
    let activeIndex = -1
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].status === 'waiting') {
        activeIndex = i
        break
      }
    }
    
    // 如果找到进行中的节点，计算到该节点的进度
    if (activeIndex >= 0) {
      // 进度到当前节点，但不包括该节点（因为是进行中）
      return (activeIndex / (steps.length - 1)) * 100
    }
    
    // 如果没有进行中的节点，检查是否有已完成的
    let lastCompletedIndex = -1
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status === 'completed') {
        lastCompletedIndex = i
        break
      }
    }
    
    if (lastCompletedIndex >= 0) {
      // 如果最后一个已完成，进度100%
      if (lastCompletedIndex === steps.length - 1) {
        return 100
      }
      // 否则进度到最后一个已完成节点
      return ((lastCompletedIndex + 1) / (steps.length - 1)) * 100
    }
    
    return 0
  },

  // 格式化时间
  // 格式化时间段（显示日期和时间，格式：MM-dd HH:mm）
  formatTimeSlot(timeStr) {
    if (!timeStr) return ''
    try {
      // 处理 "yyyy-MM-dd HH:mm:ss" 或 "yyyy-MM-ddTHH:mm:ss" 格式
      const normalized = timeStr.replace('T', ' ')
      // 提取 MM-dd HH:mm 部分
      const match = normalized.match(/^\d{4}-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
      if (match) {
        return `${match[1]}-${match[2]} ${match[3]}:${match[4]}`
      }
      // 如果格式不匹配，尝试直接截取
      return normalized.substring(5, 16) // 截取 MM-dd HH:mm 部分
    } catch (e) {
      return timeStr
    }
  },

  formatTimeRange(startTimeStr, endTimeStr) {
    if (!startTimeStr || !endTimeStr) {
      return ''
    }
    try {
      // 处理 "yyyy-MM-dd HH:mm:ss" 或 "yyyy-MM-ddTHH:mm:ss" 格式
      const normalize = (str) => str.replace('T', ' ').substring(0, 16) // 取 yyyy-MM-dd HH:mm
      
      const startNormalized = normalize(startTimeStr)
      const endNormalized = normalize(endTimeStr)
      
      // 提取开始时间的日期和时间部分
      const startMatch = startNormalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/)
      const endMatch = endNormalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/)
      
      if (startMatch && endMatch) {
        const startDate = startMatch[1]
        const startTime = startMatch[2]
        const endDate = endMatch[1]
        const endTime = endMatch[2]
        
        // 如果开始和结束时间在同一天，只显示一次日期
        if (startDate === endDate) {
          return `${startDate} ${startTime} 到 ${endTime}`
        } else {
          // 如果不在同一天，显示完整日期和时间
          return `${startDate} ${startTime} 到 ${endDate} ${endTime}`
        }
      }
      
      // 如果解析失败，返回原始格式
      return `${startNormalized} - ${endNormalized}`
    } catch (e) {
      return `${startTimeStr} - ${endTimeStr}`
    }
  },

  formatTime(timeStr) {
    if (!timeStr) return ''
    
    // 处理 "yyyy-MM-dd HH:mm:ss" 格式的时间字符串
    // 直接提取 MM-dd HH:mm 部分
    if (typeof timeStr === 'string') {
      // 格式: "2025-10-29 21:51:31"
      // 提取: "10-29 21:51"
      const match = timeStr.match(/^\d{4}-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
      if (match) {
        return `${match[1]}-${match[2]} ${match[3]}:${match[4]}`
      }
      // 如果格式不匹配，尝试其他格式
      const spaceIndex = timeStr.indexOf(' ')
      if (spaceIndex > 0) {
        const datePart = timeStr.substring(0, spaceIndex)
        const timePart = timeStr.substring(spaceIndex + 1)
        const dateMatch = datePart.match(/\d{4}-(\d{2})-(\d{2})/)
        const timeMatch = timePart.match(/(\d{2}):(\d{2})/)
        if (dateMatch && timeMatch) {
          return `${dateMatch[1]}-${dateMatch[2]} ${timeMatch[1]}:${timeMatch[2]}`
        }
      }
    }
    // 如果都解析失败，返回原字符串的一部分
    return timeStr.length > 16 ? timeStr.substring(5, 16) : timeStr
  },

  // 预览图片
  previewImage(e) {
    const current = e.currentTarget.dataset.url
    const urls = e.currentTarget.dataset.urls || []
    wx.previewImage({
      current,
      urls
    })
  },

  // 拨打业务员电话
  callCourier(e) {
    const phone = e.currentTarget.dataset.phone
    if (!phone) {
      wx.showToast({ title: '电话号码不存在', icon: 'none' })
      return
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      success: () => {},
      fail: () => {
        console.error('拨打电话失败')
        wx.showToast({ title: '拨打电话失败', icon: 'none' })
      }
    })
  },

  // 处理操作按钮点击
  async handleAction(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'PAY') {
      await this.handlePay()
    } else if (action === 'CONTINUE_PAY') {
      await this.handleContinuePay()
    } else if (action === 'CANCEL_PAYMENT') {
      await this.handleCancelPayment()
    } else if (action === 'CANCEL') {
      await this.handleCancel()
    } else if (action === 'CANCEL_WITH_REDIRECT') {
      // 取消订单（继续支付模式，提示跳转到支付详情页）
      wx.showModal({
        title: '提示',
        content: '当前有支付中订单，请前往支付详情页操作',
        confirmText: '前往支付',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: `/pages/payment/index?orderNo=${this.data.orderNo}` })
          }
        }
      })
    }
  },

  // 处理支付
  async handlePay() {
    // 跳转到支付页面（不再需要传递 orderType，后端会自动识别）
    wx.navigateTo({
      url: `/pages/payment/index?orderNo=${this.data.orderNo}`
    })
  },

  // 处理继续支付
  async handleContinuePay() {
    wx.navigateTo({ url: `/pages/payment/index?orderNo=${this.data.orderNo}` })
  },


  // 处理取消支付（支付中状态下的取消）
  async handleCancelPayment() {
    try {
      wx.showModal({
        title: '确认取消支付',
        content: '确定要取消本次支付吗？取消后订单将回到待支付状态，您可以稍后重新支付。',
        success: async (res) => {
          if (res.confirm) {
            wx.showLoading({ title: '取消中...' })
            try {
              const { api } = require('../../utils/util.js')
              const result = await api.cancelThirdPartyPayment(this.data.orderNo)
              
              wx.hideLoading()
              if (result.success) {
                wx.showToast({ title: '已取消支付', icon: 'success' })
                // 重新加载订单详情，刷新状态
                setTimeout(() => {
                  this.loadOrderDetail()
                }, 1500)
              } else {
                wx.showToast({ title: result.message || '取消支付失败', icon: 'none' })
              }
            } catch (e) {
              wx.hideLoading()
              console.error('取消支付异常')
              wx.showToast({ title: '取消支付失败', icon: 'none' })
            }
          }
        }
      })
    } catch (e) {
      console.error('取消支付异常')
    }
  },

  // 处理取消订单
  async handleCancel() {
    try {
      wx.showModal({
        title: '确认取消',
        content: '确定要取消该订单吗？',
        success: async (res) => {
          if (res.confirm) {
            wx.showLoading({ title: '取消中...' })
            try {
              const { api } = require('../../utils/util.js')
              const result = await api.cancelExpressOrder(this.data.orderNo)
              
              wx.hideLoading()
              if (result.success) {
                wx.showToast({ title: '已取消', icon: 'success' })
                // 重新加载订单详情，刷新状态
                setTimeout(() => {
                  this.loadOrderDetail()
                }, 1500)
              } else {
                wx.showToast({ title: result.message || '取消失败', icon: 'none' })
              }
            } catch (e) {
              wx.hideLoading()
              console.error('取消订单异常')
              wx.showToast({ title: '取消失败', icon: 'none' })
            }
          }
        }
      })
    } catch (e) {
      console.error('取消订单异常')
    }
  },

  // 点击联系按钮
  onContactTap() {
    wx.navigateTo({
      url: `/pages/chat/index?orderNo=${this.data.orderNo}`
    })
  }
})

