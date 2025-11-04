const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')

Page({
  data: {
    orderNo: '',
    detail: {},
    rechargeStatus: null,
    rechargeStatusDesc: '',
    amountStr: '0.00',
    allowedActions: [] // 允许的操作按钮列表
  },

  onLoad(options) {
    const orderNo = options?.orderNo || ''
    this.setData({ orderNo })
    this.loadDetail()
  },

  onShow() {
    if (this.data.orderNo) {
      this.loadDetail()
    }
  },

  async loadDetail() {
    const { orderNo } = this.data
    try {
      const res = await api.getRechargeOrderDetail(orderNo)
      if (res && res.success) {
        const detail = res.data || {}
        const orig = amount.parseBigDecimalLike(detail.totalAmount, 0)
        const act = amount.parseBigDecimalLike(detail.actualAmount != null ? detail.actualAmount : detail.totalAmount, 0)
        const hasDiscount = orig > act
        const discount = Math.max(0, orig - act)
        // 状态映射：1-待支付，2-支付中，3-已支付，4-取消订单
        const statusClass = detail.rechargeStatus === 1 ? 'pending' : 
                           detail.rechargeStatus === 2 ? 'paying' : 
                           detail.rechargeStatus === 3 ? 'success' : 
                           detail.rechargeStatus === 4 ? 'failed' : 'pending'
        
        this.setData({
          detail,
          amountStr: amount.formatAmount(act),
          originalAmountStr: amount.formatAmount(orig),
          finalAmountStr: amount.formatAmount(act),
          discountAmountStr: amount.formatAmount(discount),
          hasDiscount: hasDiscount,
          rechargeStatus: statusClass,
          rechargeStatusDesc: detail.rechargeStatusDesc || '',
          allowedActions: detail.allowedActions || [] // 从后端获取允许的操作列表
        })
      }
    } catch (e) {
      console.error('获取充值订单详情失败', e)
    }
  },

  // 处理操作按钮点击
  async handleAction(e) {
    const action = e.currentTarget.dataset.action
    const { orderNo } = this.data

    if (action === 'PAY') {
      // 去支付（发起支付模式）
      wx.navigateTo({ url: `/pages/payment/index?orderNo=${orderNo}` })
    } else if (action === 'CONTINUE_PAY') {
      // 继续支付
      wx.navigateTo({ url: `/pages/payment/index?orderNo=${orderNo}` })
    } else if (action === 'CANCEL') {
      // 取消订单（发起支付模式，直接取消）
      wx.showModal({
        title: '确认取消',
        content: '确定要取消该充值订单吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              wx.showLoading({ title: '取消中...' })
              const cancelRes = await api.cancelRechargeOrder(orderNo)
              if (cancelRes && cancelRes.success) {
                wx.hideLoading()
                wx.showToast({ title: '已取消', icon: 'success' })
                // 刷新订单详情
                setTimeout(() => {
                  this.loadDetail()
                }, 1000)
              } else {
                wx.hideLoading()
                wx.showToast({ title: cancelRes?.message || '取消失败', icon: 'none' })
              }
            } catch (e) {
              wx.hideLoading()
              console.error('取消充值订单失败', e)
              wx.showToast({ title: '取消失败', icon: 'none' })
            }
          }
        }
      })
    } else if (action === 'CANCEL_WITH_REDIRECT') {
      // 取消订单（继续支付模式，提示跳转到支付详情页）
      wx.showModal({
        title: '提示',
        content: '当前有支付中订单，请前往支付详情页操作',
        confirmText: '前往支付',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: `/pages/payment/index?orderNo=${orderNo}` })
          }
        }
      })
    }
  }
})

