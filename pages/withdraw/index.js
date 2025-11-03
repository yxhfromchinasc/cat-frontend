const { api } = require('../../utils/util.js')

Page({
  data: {
    amount: '',
    balance: null,
    canSubmit: false,
    submitting: false
  },

  onLoad() {
    this.loadBalance()
  },

  onShow() {},

  // 加载余额
  async loadBalance() {
    try {
      const res = await api.get('/wallet/info', {}, { showSuccess: false })
      if (res.success && res.data) {
        this.setData({ balance: res.data.balance || 0 })
      }
    } catch (e) {
      console.error('加载余额失败:', e)
    }
  },

  onAmountInput(e) {
    const val = e.detail.value.trim()
    // 只允许数字与小数点，且两位小数
    const normalized = val.replace(/[^\d.]/g, '')
    const parts = normalized.split('.')
    let fixed = parts[0]
    if (parts.length > 1) {
      fixed += '.' + parts[1].slice(0, 2)
    }
    const num = Number(fixed)
    const valid = fixed !== '' && !isNaN(num) && num > 0
    this.setData({ amount: fixed, canSubmit: valid })
  },

  onQuickPick(e) {
    const val = Number(e.currentTarget.dataset.val)
    const value = val.toFixed(2)
    this.setData({ amount: value, canSubmit: true })
  },

  // 调起确认收款页面（商家转账升级版）
  async requestUserConfirmReceipt(packageInfoStr) {
    return new Promise((resolve, reject) => {
      try {
        // packageInfoStr 是后端返回的 base64 编码字符串，直接使用，无需解析
        if (!packageInfoStr || typeof packageInfoStr !== 'string') {
          reject(new Error('确认收款参数无效'))
          return
        }

        // 根据微信文档，使用 wx.openBusinessView 调起确认收款页面
        // businessType: 'transferConfirm' 表示转账确认
        wx.openBusinessView({
          businessType: 'transferConfirm',
          queryString: 'package=' + encodeURIComponent(packageInfoStr),
          success: (res) => {
            console.log('调起确认收款成功:', res)
            resolve(res)
          },
          fail: (err) => {
            console.error('调起确认收款失败:', err)
            // 用户取消
            if (err && err.errMsg && (err.errMsg.includes('cancel') || err.errMsg.includes('取消'))) {
              reject({ cancelled: true, errMsg: err.errMsg })
            } else {
              reject(new Error(err.errMsg || '调起确认收款失败'))
            }
          }
        })
      } catch (e) {
        console.error('调起确认收款异常:', e)
        reject(e)
      }
    })
  },

  async onWithdraw() {
    if (!this.data.canSubmit) return
    if (this.data.submitting) return
    
    const amountNum = Number(this.data.amount)
    
    // 检查余额
    if (this.data.balance && amountNum > this.data.balance) {
      wx.showToast({ title: '余额不足', icon: 'none' })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      api.showLoadingToast('发起提现...')
      
      // 1. 创建提现订单（仅创建本地订单，不扣除余额）
      const createRes = await api.createWithdraw(amountNum)
      
      if (!createRes.success || !createRes.data) {
        throw new Error(createRes.message || createRes.error || '创建提现订单失败')
      }
      
      const { orderNo } = createRes.data
      
      if (!orderNo) {
        throw new Error('未获取到订单号')
      }

      // 2. 发起转账申请（扣除余额、调用第三方API获取packageInfo）
      api.showLoadingToast('发起转账...')
      const initiateRes = await api.initiateWithdraw(orderNo)
      
      if (!initiateRes.success || !initiateRes.data) {
        throw new Error(initiateRes.message || initiateRes.error || '发起转账申请失败')
      }
      
      const { packageInfo } = initiateRes.data
      
      if (!packageInfo) {
        throw new Error('未获取到确认收款参数')
      }
      
      api.hideLoadingToast()
      
      // 3. 调起确认收款页面（类似wx.requestPayment）
      try {
        await this.requestUserConfirmReceipt(packageInfo)
        
        // 确认收款成功，显示成功提示
        wx.showToast({ title: '提现申请已提交', icon: 'success' })
        
        // 刷新余额
        this.loadBalance()
        
        // 延迟返回
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        
      } catch (receiptError) {
        // 用户取消确认收款
        if (receiptError.cancelled) {
          wx.showToast({ title: '已取消确认收款', icon: 'none' })
          // 订单已创建且已扣除余额，提示用户稍后查看
          wx.showModal({
            title: '提示',
            content: '订单已创建，请稍后在订单列表中查看提现结果',
            showCancel: false
          })
        } else {
          wx.showToast({ 
            title: receiptError.message || '确认收款失败', 
            icon: 'none',
            duration: 3000
          })
        }
      }
    } catch (error) {
      api.hideLoadingToast()
      console.error('提现失败:', error)
      console.error('错误对象详情:', JSON.stringify(error))
      // 优先使用 error.message（后端返回的具体错误信息），然后是 error.error，最后是默认提示
      const errorMessage = error.message || error.error || '提现失败，请稍后重试'
      wx.showToast({ 
        title: errorMessage, 
        icon: 'none',
        duration: 3000
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})

