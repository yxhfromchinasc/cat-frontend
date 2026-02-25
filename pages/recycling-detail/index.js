// pages/recycling-detail/index.js
const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')

Page({
  data: {
    orderNo: '',
    orderDetail: null,
    loading: true,
    isFirstLoad: true, // 标记是否是首次加载
    amountStr: '0.00'
  },

  onLoad(options) {
    if (options.orderNo) {
      this.setData({ orderNo: options.orderNo })
      this.loadOrderDetail()
    } else {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 加载订单详情
  async loadOrderDetail() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await api.getRecyclingOrderDetail(this.data.orderNo)
      
      if (res.success && res.data) {
        const detail = res.data
        
        // 处理图片列表，确保是数组
        if (detail.images && !Array.isArray(detail.images)) {
          detail.images = []
        }
        // 处理结算照片列表，确保是数组
        if (detail.settlementImage && !Array.isArray(detail.settlementImage)) {
          detail.settlementImage = []
        }
        
        // 评分默认5分并生成星数组
        detail.recyclerRating = 5
        detail.recyclerRatingArray = [1, 2, 3, 4, 5]

        // 统一金额：回收类一般不支付，但如果后端有金额字段则格式化准备展示
        const amountVal = detail.actualAmount != null ? detail.actualAmount : detail.totalAmount
        const amountNum = amount.parseBigDecimalLike(amountVal, 0)
        detail.amount = amountNum
        const amountStr = amount.formatAmount(amountNum)

        // 预处理时间字段，格式化后直接存储在对象中（保留用于兼容）
        detail.createdAtFormatted = this.formatTime(detail.createdAt)
        detail.bandingTimeFormatted = this.formatTime(detail.bandingTime)
        detail.actualTimeFormatted = this.formatTime(detail.actualTime)
        detail.startTimeFormatted = this.formatTime(detail.startTime)
        detail.endTimeFormatted = this.formatTime(detail.endTime)
        detail.cancelTimeFormatted = this.formatTime(detail.cancelTime)
        
        // 处理时间线事件记录（后端返回）
        if (detail.timeline && Array.isArray(detail.timeline)) {
          // 为每个时间线事件格式化时间
          detail.timeline.forEach(event => {
            if (event.time) {
              event.timeFormatted = this.formatTime(event.time)
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
        
        this.setData({
          orderDetail: detail,
          amountStr: amountStr,
          progressPercent: progressPercent,
          loading: false
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
    const status = detail.recyclingStatus || 1
    
    steps.push({
      key: 'scheduled',
      title: '已预约',
      status: 'completed',
      time: detail.createdAt,
      show: true
    })
    
    if (status === 4) {
      steps.push({
        key: 'cancelled',
        title: '已取消',
        status: 'completed',
        time: detail.cancelTime,
        show: true
      })
    } else {
      steps.push({
        key: 'in_progress',
        title: '待上门',
        status: status >= 2 ? 'completed' : status === 1 ? 'waiting' : 'disabled',
        time: detail.bandingTime,
        show: true
      })
      
      // 添加"打款中"步骤
      steps.push({
        key: 'paying',
        title: '打款中',
        status: status === 5 ? 'waiting' : status >= 3 ? 'completed' : status === 2 ? 'waiting' : 'disabled',
        time: detail.actualTime, // 使用实际回收时间
        show: status >= 2
      })
      
      steps.push({
        key: 'completed',
        title: '已完成',
        status: status === 3 ? 'completed' : status === 5 ? 'waiting' : status >= 3 ? 'completed' : 'disabled',
        time: detail.actualTime,
        show: true
      })
    }
    
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
  formatTime(timeStr) {
    if (!timeStr) {
      return ''
    }
    
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

  // 格式化时间段（格式：年-月-日 时：分 到 时：分）
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

  // 预览图片
  previewImage(e) {
    const current = e.currentTarget.dataset.url
    const urls = e.currentTarget.dataset.urls || []
    wx.previewImage({
      current,
      urls
    })
  },

  // 拨打回收员电话（由 courier-card 组件触发，e.detail.phone）
  callRecycler(e) {
    const phone = e.detail && e.detail.phone
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
    if (action === 'CANCEL') {
      await this.handleCancel()
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
              const result = await api.cancelRecyclingOrder(this.data.orderNo)
              
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

