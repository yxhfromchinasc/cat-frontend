const { api } = require('../../utils/util.js')
const amountUtil = require('../../utils/amount.js')

Page({
  data: {
    orderNo: '',
    orderDetail: null,
    loading: true,
    isFirstLoad: true,
    goodsExpanded: false,
    displayOrderItems: []
  },

  onLoad(options) {
    const orderNo = options.orderNo
    if (!orderNo) {
      wx.showToast({ title: '订单号缺失', icon: 'none' })
      return
    }
    this.setData({ orderNo })
    this.loadDetail()
  },

  onShow() {
    if (this.data.orderNo && !this.data.isFirstLoad) {
      this.loadDetail()
    }
  },

  async loadDetail() {
    this.setData({ loading: true })
    try {
      const res = await api.getGroceryOrderDetail(this.data.orderNo)
      if (res && res.success && res.data) {
        const detail = res.data
        if (!detail.progressSteps || !Array.isArray(detail.progressSteps)) {
          detail.progressSteps = []
        }
        if (detail.timeline && Array.isArray(detail.timeline)) {
          detail.timeline.forEach((event, idx) => {
            if (event.time) {
              event.timeFormatted = this.formatTime(event.time)
            }
            if (!event.data) event.data = {}
            const d = event.data
            const title = event.title || ''
            if (title.indexOf('用户下单') !== -1 || title.indexOf('订单创建') !== -1) {
              event.displayType = 'CREATED'
              d.orderNo = detail.orderNo
              d.addressDetail = detail.addressDetail
              d.startTime = detail.startTime
              d.endTime = detail.endTime
              d.timeRangeFormatted = (detail.startTime && detail.endTime) ? this.formatTimeRange(detail.startTime, detail.endTime) : ''
              d.groceryPointName = detail.groceryPointName
            } else if (title.indexOf('小哥接单') !== -1 || title.indexOf('配送员接单') !== -1) {
              event.displayType = 'BANDING'
              d.courierNickname = detail.courierNickname
            } else if (title.indexOf('支付成功') !== -1 || title.indexOf('已支付') !== -1 || event.type === 'PAID') {
              event.displayType = 'PAID'
              d.actualAmount = d.actualAmount != null ? amountUtil.formatAmount(d.actualAmount) : (detail.actualAmount != null ? amountUtil.formatAmount(detail.actualAmount) : '')
              d.totalAmount = d.totalAmount != null ? amountUtil.formatAmount(d.totalAmount) : (detail.totalAmount != null ? amountUtil.formatAmount(detail.totalAmount) : d.totalAmount)
              d.discountAmount = d.discountAmount != null ? amountUtil.formatAmount(d.discountAmount) : d.discountAmount
            } else if (title.indexOf('退款申请管理员审核中') !== -1 || (event.type === 'APPLY_REFUND')) {
              event.displayType = 'APPLY_REFUND'
            } else {
              event.displayType = 'EVENT'
            }
          })
        } else {
          detail.timeline = []
        }
        const amountVal = detail.actualAmount != null ? detail.actualAmount : detail.totalAmount
        detail.amount = amountUtil.parseBigDecimalLike(amountVal, 0)
        detail.actualPriceStr = amountUtil.formatAmount(detail.amount)
        // 格式化商品金额用于展示
        if (detail.orderItems && detail.orderItems.length > 0) {
          detail.orderItems.forEach(item => {
            item.subtotalAmountStr = amountUtil.formatAmount(item.subtotalAmount)
          })
        }
        const actionLabels = { CANCEL: '取消订单', PAY: '立即支付', CONTINUE_PAY: '继续支付', CANCEL_PAYMENT: '取消本次支付', CANCEL_WITH_REDIRECT: '取消订单', CONTACT_COURIER: '联系小哥', APPLY_REFUND: '申请退款' }
        detail.allowedActionLabels = (detail.allowedActions || []).map(a => ({ code: a, label: actionLabels[a] || a }))
        detail.courierRatingArray = detail.courierRatingArray || [1, 2, 3, 4, 5]
        const displayOrderItems = (detail.orderItems && detail.orderItems.length > 3)
          ? detail.orderItems.slice(0, 3)
          : (detail.orderItems || [])
        this.setData({
          orderDetail: detail,
          displayOrderItems,
          loading: false,
          isFirstLoad: false
        })
      } else {
        wx.showToast({ title: res?.message || '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('加载杂货订单详情失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  formatTime(timeStr) {
    if (!timeStr) return ''
    if (typeof timeStr === 'string') {
      const match = timeStr.match(/^\d{4}-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
      if (match) return `${match[1]}-${match[2]} ${match[3]}:${match[4]}`
    }
    return String(timeStr).length > 16 ? String(timeStr).substring(5, 16) : String(timeStr)
  },

  formatTimeRange(startTimeStr, endTimeStr) {
    if (!startTimeStr || !endTimeStr) return ''
    try {
      const normalize = (str) => String(str).replace('T', ' ').substring(0, 16)
      const start = normalize(startTimeStr)
      const end = normalize(endTimeStr)
      const startMatch = start.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/)
      const endMatch = end.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/)
      if (startMatch && endMatch) {
        if (startMatch[1] === endMatch[1]) return `${startMatch[1]} ${startMatch[2]} - ${endMatch[2]}`
        return `${start} - ${end}`
      }
      return start + ' - ' + end
    } catch (e) {
      return startTimeStr + ' - ' + endTimeStr
    }
  },

  payOrder() {
    if (!this.data.orderNo) return
    wx.navigateTo({ url: `/pages/payment/index?orderNo=${this.data.orderNo}` })
  },

  callCourier(e) {
    const phone = e.detail && e.detail.phone
    if (!phone) {
      wx.showToast({ title: '电话号码不存在', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: phone })
  },

  onContactTap() {
    wx.navigateTo({ url: `/pages/chat/index?orderNo=${this.data.orderNo}` })
  },

  toggleGoodsExpand() {
    const { orderDetail, goodsExpanded } = this.data
    if (!orderDetail || !orderDetail.orderItems) return
    const displayOrderItems = goodsExpanded
      ? orderDetail.orderItems.slice(0, 3)
      : orderDetail.orderItems
    this.setData({
      goodsExpanded: !goodsExpanded,
      displayOrderItems
    })
  },

  async handleAction(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'CANCEL') {
      await this.handleCancel()
    } else if (action === 'PAY' || action === 'CONTINUE_PAY') {
      this.payOrder()
    } else if (action === 'CANCEL_PAYMENT') {
      await this.handleCancelPayment()
    } else if (action === 'CANCEL_WITH_REDIRECT') {
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
    } else if (action === 'CONTACT_COURIER') {
      this.onContactTap()
    } else if (action === 'APPLY_REFUND') {
      this.handleApplyRefund()
    }
  },

  async handleApplyRefund() {
    const { orderNo, orderDetail } = this.data
    if (!orderNo || !orderDetail) return
    const refundAmount = orderDetail.actualAmount != null ? orderDetail.actualAmount : orderDetail.totalAmount
    const amountStr = orderDetail.actualPriceStr || (refundAmount != null ? amountUtil.formatAmount(refundAmount) : '')
    wx.showModal({
      title: '申请退款',
      content: `退款金额：¥${amountStr || '0.00'}`,
      editable: true,
      placeholderText: '请输入申请退款原因（必填）',
      confirmText: '确定',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        const reason = (res.content || '').trim()
        if (!reason) {
          wx.showToast({ title: '请填写申请原因', icon: 'none' })
          return
        }
        wx.showLoading({ title: '提交中...' })
        try {
          const result = await api.applyGroceryRefund({
            orderNo,
            refundAmount: refundAmount != null ? Number(refundAmount) : 0,
            reason
          })
          wx.hideLoading()
          if (result && result.success) {
            wx.showToast({ title: '退款申请已提交', icon: 'success' })
            setTimeout(() => this.loadDetail(), 1500)
          } else {
            wx.showToast({ title: (result && result.message) || '提交失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '提交失败', icon: 'none' })
        }
      }
    })
  },

  async handleCancel() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '取消中...' })
        try {
          const result = await api.cancelGroceryOrder(this.data.orderNo)
          wx.hideLoading()
          if (result && result.success) {
            wx.showToast({ title: '已取消', icon: 'success' })
            setTimeout(() => this.loadDetail(), 1500)
          } else {
            wx.showToast({ title: (result && result.message) || '取消失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    })
  },

  async handleCancelPayment() {
    wx.showModal({
      title: '确认取消支付',
      content: '确定要取消本次支付吗？取消后可稍后重新支付。',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '取消中...' })
        try {
          const result = await api.cancelThirdPartyPayment(this.data.orderNo)
          wx.hideLoading()
          if (result && result.success) {
            wx.showToast({ title: '已取消本次支付', icon: 'success' })
            setTimeout(() => this.loadDetail(), 800)
          } else {
            wx.showToast({ title: (result && result.message) || '取消失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    })
  }
})
