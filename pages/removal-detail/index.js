// pages/removal-detail/index.js
const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')

Page({
  data: {
    orderNo: '',
    orderDetail: null,
    loading: true,
    isFirstLoad: true
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
      const res = await api.getRemovalOrderDetail(this.data.orderNo)
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
            if (title.indexOf('用户下单') !== -1) {
              event.displayType = 'CREATED'
              d.orderNo = detail.orderNo
              d.addressDetail = detail.addressDetail
              d.startTime = detail.startTime
              d.endTime = detail.endTime
              d.timeRangeFormatted = (detail.startTime && detail.endTime) ? this.formatTimeRange(detail.startTime, detail.endTime) : ''
              d.itemDescription = detail.itemDescription
              d.isUrgent = detail.isUrgent
              d.removalPointName = detail.removalPointName
              d.serviceCategory = detail.serviceCategory
              d.serviceCategoryName = (detail.serviceCategory === 1 ? '报废清除' : detail.serviceCategory === 2 ? '屋内搬运' : '') || ''
              d.images = detail.images && Array.isArray(detail.images) ? detail.images : []
              d.remark = detail.remark || ''
            } else if (title.indexOf('小哥接单') !== -1) {
              event.displayType = 'BANDING'
              d.courierNickname = detail.courierNickname
            } else if (title.indexOf('接受报价') !== -1) {
              event.displayType = 'QUOTE'
            } else if (title.indexOf('服务完成') !== -1) {
              event.displayType = 'COMPLETE_SERVICE'
              d.actualPrice = detail.actualPrice != null ? detail.actualPrice : (detail.actualAmount != null ? detail.actualAmount : '')
              d.images = detail.images && Array.isArray(detail.images) ? detail.images : []
            } else if (title.indexOf('发起支付') !== -1) {
              event.displayType = 'START_PAY'
            } else if (title.indexOf('支付成功') !== -1) {
              event.displayType = 'PAID'
              d.totalAmount = detail.actualPriceStr || detail.totalAmount
              d.actualAmount = detail.actualPriceStr
            } else if (title.indexOf('取消支付') !== -1) {
              event.displayType = 'ABORT_PAY'
            } else if (title.indexOf('订单取消') !== -1) {
              event.displayType = 'CANCELLED'
            } else {
              event.displayType = 'EVENT'
            }
          })
        } else {
          detail.timeline = []
        }
        const amountVal = detail.actualAmount != null ? detail.actualAmount : detail.totalAmount
        detail.amount = amount.parseBigDecimalLike(amountVal, 0)
        detail.actualPriceStr = amount.formatAmount(detail.amount)
        const actionLabels = { CANCEL: '取消订单', PAY: '立即支付', CONTINUE_PAY: '继续支付', CANCEL_PAYMENT: '取消本次支付', CANCEL_WITH_REDIRECT: '取消订单', CONTACT_COURIER: '联系小哥' }
        detail.allowedActionLabels = (detail.allowedActions || []).map(a => ({ code: a, label: actionLabels[a] || a }))
        detail.showCourierContact = (detail.allowedActions || []).includes('CONTACT_COURIER')
        // 小哥星级展示（与快递/回收一致，默认 5 星）
        detail.courierRatingArray = detail.courierRatingArray || [1, 2, 3, 4, 5]
        this.setData({
          orderDetail: detail,
          loading: false,
          isFirstLoad: false
        })
      } else {
        wx.showToast({ title: res?.message || '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('加载大件清运订单详情失败', e)
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

  previewImage(e) {
    const current = e.currentTarget.dataset.url
    const urls = e.currentTarget.dataset.urls || []
    wx.previewImage({ current, urls })
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

  async handleAction(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'CANCEL') {
      await this.handleCancel()
    } else if (action === 'PAY' || action === 'CONTINUE_PAY') {
      this.payOrder()
    } else if (action === 'CANCEL_PAYMENT') {
      await this.handleCancelPayment()
    } else if (action === 'CANCEL_WITH_REDIRECT') {
      // 支付中时在详情页点击「取消订单」：提示跳转支付页操作（与快递一致）
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
    }
  },

  async handleCancel() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '取消中...' })
        try {
          const result = await api.cancelRemovalOrder(this.data.orderNo, '用户取消')
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
  },

})
