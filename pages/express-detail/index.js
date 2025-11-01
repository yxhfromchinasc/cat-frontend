// pages/express-detail/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    orderNo: '',
    orderDetail: null,
    loading: true
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
      
      const res = await api.getExpressOrderDetail(this.data.orderNo)
      
      if (res.success && res.data) {
        const detail = res.data
        
        // 调试：打印后端返回的时间数据
        console.log('=== 订单详情数据 ===')
        console.log('createdAt:', detail.createdAt)
        console.log('bandingTime:', detail.bandingTime)
        console.log('actPickTime:', detail.actPickTime)
        console.log('sendSucTime:', detail.sendSucTime)
        console.log('paidAt:', detail.paidAt)
        console.log('完整数据:', JSON.stringify(detail, null, 2))
        
        // 处理图片列表，确保是数组
        if (detail.pickPics && !Array.isArray(detail.pickPics)) {
          detail.pickPics = []
        }
        if (detail.pickCodes && !Array.isArray(detail.pickCodes)) {
          detail.pickCodes = []
        }
        if (detail.expressPics && !Array.isArray(detail.expressPics)) {
          detail.expressPics = []
        }
        if (detail.sendSucPics && !Array.isArray(detail.sendSucPics)) {
          detail.sendSucPics = []
        }
        
        // 评分默认5分并生成星数组
        detail.courierRating = 5
        detail.courierRatingArray = [1, 2, 3, 4, 5]

        // 预处理时间字段，格式化后直接存储在对象中
        detail.createdAtFormatted = this.formatTime(detail.createdAt)
        detail.bandingTimeFormatted = this.formatTime(detail.bandingTime)
        detail.actPickTimeFormatted = this.formatTime(detail.actPickTime)
        detail.sendSucTimeFormatted = this.formatTime(detail.sendSucTime)
        detail.paidAtFormatted = this.formatTime(detail.paidAt)
        
        console.log('格式化后的时间:')
        console.log('createdAtFormatted:', detail.createdAtFormatted)
        console.log('bandingTimeFormatted:', detail.bandingTimeFormatted)
        console.log('actPickTimeFormatted:', detail.actPickTimeFormatted)
        console.log('sendSucTimeFormatted:', detail.sendSucTimeFormatted)
        console.log('paidAtFormatted:', detail.paidAtFormatted)

        // 计算进度节点
        detail.progressSteps = this.calculateProgressSteps(detail)
        
        this.setData({
          orderDetail: detail,
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
    steps.push({
      key: 'wait_pay',
      title: '待支付',
      status: status >= 4 ? 'completed' : status === 3 ? 'waiting' : 'disabled',
      time: detail.sendSucTime,
      show: true
    })
    
    // 5. 已支付
    steps.push({
      key: 'paid',
      title: '已支付',
      status: status >= 5 ? 'completed' : status === 4 ? 'waiting' : 'disabled',
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

  // 格式化时间
  formatTime(timeStr) {
    console.log('formatTime 被调用，输入:', timeStr, '类型:', typeof timeStr)
    if (!timeStr) {
      console.log('formatTime: timeStr为空')
      return ''
    }
    
    // 处理 "yyyy-MM-dd HH:mm:ss" 格式的时间字符串
    // 直接提取 MM-dd HH:mm 部分
    if (typeof timeStr === 'string') {
      // 格式: "2025-10-29 21:51:31"
      // 提取: "10-29 21:51"
      const match = timeStr.match(/^\d{4}-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
      if (match) {
        const result = `${match[1]}-${match[2]} ${match[3]}:${match[4]}`
        console.log('formatTime: 匹配成功，返回:', result)
        return result
      }
      // 如果格式不匹配，尝试其他格式
      const spaceIndex = timeStr.indexOf(' ')
      if (spaceIndex > 0) {
        const datePart = timeStr.substring(0, spaceIndex)
        const timePart = timeStr.substring(spaceIndex + 1)
        const dateMatch = datePart.match(/\d{4}-(\d{2})-(\d{2})/)
        const timeMatch = timePart.match(/(\d{2}):(\d{2})/)
        if (dateMatch && timeMatch) {
          const result = `${dateMatch[1]}-${dateMatch[2]} ${timeMatch[1]}:${timeMatch[2]}`
          console.log('formatTime: 备用匹配成功，返回:', result)
          return result
        }
      }
    }
    // 如果都解析失败，返回原字符串的一部分
    const result = timeStr.length > 16 ? timeStr.substring(5, 16) : timeStr
    console.log('formatTime: 解析失败，返回原字符串的一部分:', result)
    return result
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
    if (action === 'PAY') {
      await this.handlePay()
    } else if (action === 'CANCEL') {
      await this.handleCancel()
    }
  },

  // 处理支付
  async handlePay() {
    // 跳转到支付页面（不再需要传递 orderType，后端会自动识别）
    wx.navigateTo({
      url: `/pages/payment/index?orderNo=${this.data.orderNo}`
    })
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

