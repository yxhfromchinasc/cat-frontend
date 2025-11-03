// pages/express-detail/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    orderNo: '',
    orderDetail: null,
    loading: true,
    isFirstLoad: true // 标记是否是首次加载
  },

  onLoad(options) {
    if (options.orderNo) {
      this.setData({ 
        orderNo: options.orderNo,
        isFirstLoad: false // 设置标志，表示已经完成首次加载
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
    } else if (action === 'CONTINUE_PAY') {
      await this.handleContinuePay()
    } else if (action === 'CANCEL_PAYMENT') {
      await this.handleCancelPayment()
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

  // 处理继续支付
  async handleContinuePay() {
    try {
      wx.showLoading({ title: '获取支付参数...' })
      
      const { api } = require('../../utils/util.js')
      const { pollPaymentProgress } = require('../../utils/pay.js')
      
      // 调用继续支付接口
      const res = await api.continuePayment(this.data.orderNo)
      
      wx.hideLoading()
      
      if (res.success && res.data && res.data.paymentParams) {
        // 获取支付参数成功，调起微信支付
        const paymentParams = res.data.paymentParams
        
        // 隐藏 loading，准备进入轮询流程
        try {
          // 调起微信支付
          const { requestPayment } = require('../../utils/pay.js')
          await requestPayment(paymentParams)
          
          // 支付调起成功，进入5秒缓冲轮询（使用订单详情页实例）
          const result = await pollPaymentProgress(this.data.orderNo, 5, this)
          
          // 根据轮询结果刷新订单详情
          if (result.finished) {
            if (result.paymentStatus === 'success') {
              wx.showToast({ title: '支付成功', icon: 'success', duration: 2000 })
              setTimeout(() => {
                this.loadOrderDetail()
              }, 1500)
            } else if (result.paymentStatus === 'failed') {
              wx.showToast({ title: '支付失败', icon: 'none', duration: 2000 })
              setTimeout(() => {
                this.loadOrderDetail()
              }, 2000)
            } else {
              // 5秒内都是 paying，刷新订单详情查看最新状态
              this.loadOrderDetail()
            }
          }
          
        } catch (err) {
          console.error('调起支付失败:', err)
          // 检查是否是用户取消
          const isUserCancel = err && err.errMsg && err.errMsg.includes('cancel')
          
          if (isUserCancel) {
            // 用户取消支付，进入快速查询流程（与支付页面逻辑一致）
            await this.handleUserCancelPayment()
          } else {
            wx.showToast({ title: '调起支付失败，请重试', icon: 'none' })
          }
        }
      } else {
        wx.showToast({ title: res.message || '获取支付参数失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('继续支付异常:', e)
      wx.showToast({ title: '继续支付失败，请重试', icon: 'none' })
    }
  },

  // 处理用户取消支付（继续支付流程中的取消）
  async handleUserCancelPayment() {
    try {
      // 立即查询一次支付状态
      const { api } = require('../../utils/util.js')
      const progressRes = await api.getPaymentProgress(this.data.orderNo)
      
      if (progressRes && progressRes.success && progressRes.data) {
        const paymentStatus = progressRes.data.paymentStatus
        
        if (paymentStatus === 'success') {
          // 支付成功
          wx.showToast({ title: '支付成功', icon: 'success', duration: 2000 })
          setTimeout(() => {
            this.loadOrderDetail()
          }, 1500)
          return
        } else if (paymentStatus === 'failed') {
          // 支付失败
          wx.showToast({ title: '支付失败', icon: 'none', duration: 2000 })
          setTimeout(() => {
            this.loadOrderDetail()
          }, 2000)
          return
        }
      }
      
      // 等待2秒后再查询一次
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const secondProgressRes = await api.getPaymentProgress(this.data.orderNo)
      if (secondProgressRes && secondProgressRes.success && secondProgressRes.data) {
        const secondPaymentStatus = secondProgressRes.data.paymentStatus
        
        if (secondPaymentStatus === 'success') {
          // 支付成功
          wx.showToast({ title: '支付成功', icon: 'success', duration: 2000 })
          setTimeout(() => {
            this.loadOrderDetail()
          }, 1500)
          return
        } else if (secondPaymentStatus === 'failed') {
          // 支付失败
          wx.showToast({ title: '支付失败', icon: 'none', duration: 2000 })
          setTimeout(() => {
            this.loadOrderDetail()
          }, 2000)
          return
        }
      }
      
      // 两次查询都是 pending 或 paying，说明用户确实取消了
      // 刷新订单详情，让用户看到最新状态
      this.loadOrderDetail()
      
    } catch (e) {
      console.error('查询支付状态失败:', e)
      // 查询失败，刷新订单详情
      this.loadOrderDetail()
    }
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
              console.error('取消支付异常:', e)
              wx.showToast({ title: '取消支付失败', icon: 'none' })
            }
          }
        }
      })
    } catch (e) {
      console.error('取消支付异常:', e)
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

