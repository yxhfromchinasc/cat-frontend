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
        
        // 评分默认5分并生成星数组
        detail.recyclerRating = 5
        detail.recyclerRatingArray = [1, 2, 3, 4, 5]

        // 统一金额：回收类一般不支付，但如果后端有金额字段则格式化准备展示
        const amountVal = detail.actualAmount != null ? detail.actualAmount : detail.totalAmount
        const amountNum = amount.parseBigDecimalLike(amountVal, 0)
        detail.amount = amountNum
        const amountStr = amount.formatAmount(amountNum)

        // 预处理时间字段，格式化后直接存储在对象中
        detail.createdAtFormatted = this.formatTime(detail.createdAt)
        detail.bandingTimeFormatted = this.formatTime(detail.bandingTime)
        detail.actualTimeFormatted = this.formatTime(detail.actualTime)
        detail.startTimeFormatted = this.formatTime(detail.startTime)
        detail.endTimeFormatted = this.formatTime(detail.endTime)

        // 计算进度节点
        detail.progressSteps = this.calculateProgressSteps(detail)
        
        this.setData({
          orderDetail: detail,
          amountStr: amountStr,
          loading: false
        })
      } else {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (e) {
      console.error('加载订单详情失败:', e)
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
    
    // 1. 已预约
    steps.push({
      key: 'scheduled',
      title: '已预约',
      status: 'completed',
      time: detail.createdAt,
      show: true
    })
    
    // 2. 待上门（回收员接单）
    steps.push({
      key: 'in_progress',
      title: '待上门',
      status: status >= 2 ? 'completed' : status === 1 ? 'waiting' : 'disabled',
      time: detail.bandingTime,
      show: true
    })
    
    // 3. 已完成
    steps.push({
      key: 'completed',
      title: '已完成',
      status: status >= 3 ? 'completed' : status === 2 ? 'waiting' : 'disabled',
      time: detail.actualTime,
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

  // 预览图片
  previewImage(e) {
    const current = e.currentTarget.dataset.url
    const urls = e.currentTarget.dataset.urls || []
    wx.previewImage({
      current,
      urls
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
              console.error('取消订单异常:', e)
              wx.showToast({ title: '取消失败', icon: 'none' })
            }
          }
        }
      })
    } catch (e) {
      console.error('取消订单异常:', e)
    }
  }
})

