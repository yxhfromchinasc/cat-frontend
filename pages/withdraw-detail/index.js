const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')

Page({
  data: {
    orderNo: '',
    detail: {},
    withdrawStatus: null,
    withdrawStatusDesc: '',
    amountStr: '0.00',
    actualAmountStr: '0.00',
    feeStr: '0.00',
    loading: false,
    allowedActions: [] // 允许的操作按钮列表
  },

  onLoad(options) {
    const orderNo = options?.orderNo || ''
    if (!orderNo) {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
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
      const res = await api.getWithdrawDetail(orderNo)
      if (res && res.success && res.data) {
        const detail = res.data
        const amt = amount.parseBigDecimalLike(detail.amount, 0)
        const actAmt = amount.parseBigDecimalLike(detail.actualAmount != null ? detail.actualAmount : detail.amount, 0)
        const fee = amount.parseBigDecimalLike(detail.fee, 0)
        
        // 状态映射：1-待提现，2-提现中，3-已提现，4-取消订单
        const statusClass = detail.withdrawStatus === 1 ? 'pending' : 
                           detail.withdrawStatus === 2 ? 'withdrawing' : 
                           detail.withdrawStatus === 3 ? 'withedrawed' : 
                           detail.withdrawStatus === 4 ? 'cancel' : 'pending'
        
        this.setData({
          detail,
          amountStr: amount.formatAmount(amt),
          actualAmountStr: amount.formatAmount(actAmt),
          feeStr: amount.formatAmount(fee),
          withdrawStatus: statusClass,
          withdrawStatusDesc: detail.withdrawStatusDesc || '',
          allowedActions: detail.allowedActions || [] // 从后端获取允许的操作列表
        })
      }
    } catch (e) {
      console.error('获取提现订单详情失败', e)
    }
  },

  // 处理操作按钮点击
  async handleAction(e) {
    const action = e.currentTarget.dataset.action
    const { orderNo } = this.data

    if (action === 'WITHDRAW') {
      // 去提现（跳转到提现操作页）
      wx.navigateTo({ url: `/pages/withdraw-operate/index?orderNo=${orderNo}` })
    } else if (action === 'CONTINUE_WITHDRAW') {
      // 继续提现（跳转到提现操作页）
      wx.navigateTo({ url: `/pages/withdraw-operate/index?orderNo=${orderNo}` })
    } else if (action === 'CANCEL_TRANSFER') {
      // 取消本次提现（跳转到提现操作页）
      wx.navigateTo({ url: `/pages/withdraw-operate/index?orderNo=${orderNo}` })
    } else if (action === 'CANCEL') {
      // 取消订单（发起提现模式，直接取消）
      wx.showModal({
        title: '确认取消',
        content: '确定要取消该提现订单吗？取消后金额将退回账户余额',
        success: async (res) => {
          if (res.confirm) {
            try {
              wx.showLoading({ title: '取消中...' })
              const cancelRes = await api.cancelWithdrawOrder(orderNo)
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
              console.error('取消提现订单失败', e)
              wx.showToast({ title: '取消失败', icon: 'none' })
            }
          }
        }
      })
    } else if (action === 'CANCEL_WITH_REDIRECT') {
      // 取消订单（继续提现模式，提示跳转到提现操作页）
      wx.showModal({
        title: '提示',
        content: '当前有提现中订单，请前往提现操作页操作',
        confirmText: '前往提现',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: `/pages/withdraw-operate/index?orderNo=${orderNo}` })
          }
        }
      })
    }
  }
})

