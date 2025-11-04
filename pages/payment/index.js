// pages/payment/index.js
const { api } = require('../../utils/util.js')
const payUtils = require('../../utils/pay.js')
const amount = require('../../utils/amount.js')

Page({
  data: {
    // 订单信息
    orderNo: '',
    paymentDetail: null, // 支付详情（从后端统一接口获取）
    
    // 支付金额
    originalAmount: 0, // 原始金额（数字类型，用于计算）
    originalAmountStr: '0.00', // 原始金额（字符串类型，用于显示）
    couponDiscount: 0, // 优惠金额
    finalAmount: 0, // 最终支付金额（数字类型，用于计算）
    finalAmountStr: '0.00', // 最终支付金额（字符串类型，用于显示）
    hasDiscount: false, // 是否存在优惠（用于展示只读优惠信息）
    discountAmountStr: '0.00', // 优惠金额字符串
    
    // 优惠券
    availableCoupons: [], // 可用优惠券列表
    selectedCoupon: null, // 选中的优惠券
    showCouponPicker: false, // 是否显示优惠券选择器
    couponAllowed: true, // 是否允许使用优惠券
    
    // 支付方式
    paymentMethods: [], // 支持的支付方式列表（从后端获取）
    selectedPaymentMethod: 2, // 默认微信支付
    
    // 用户余额
    userBalance: 0, // 用户余额（数字类型，用于计算）
    userBalanceStr: '0.00', // 用户余额（字符串类型，用于显示）
    
    loading: true,
    // 自定义倒计时加载UI
    showPaymentLoading: false,
    paymentLoadingCountdown: 0,
    // 继续支付倒计时展示
    payRemainSeconds: 0,
    payRemainStr: '',
    // 允许的操作按钮列表
    allowedActions: []
  },

  onLoad(options) {
    // 从页面参数获取订单信息
    const orderNo = options.orderNo
    
    if (!orderNo) {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    this.setData({
      orderNo
    })
    
    this.loadPaymentDetail()
    this.loadUserBalance()
  },

  // 加载支付详情（统一接口）
  async loadPaymentDetail() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await api.getPaymentDetail(this.data.orderNo)
      
      if (res.success && res.data) {
        const detail = res.data
        // 统一金额解析
        const originalAmount = amount.parseBigDecimalLike(detail.totalAmount, 0)
        const actualAmount = amount.parseBigDecimalLike(
          detail.actualAmount != null ? detail.actualAmount : detail.totalAmount,
          0
        )
        
        console.log('支付详情数据:', detail)
        console.log('订单金额 (totalAmount):', detail.totalAmount, '类型:', typeof detail.totalAmount)
        console.log('解析后的订单金额:', originalAmount, '类型:', typeof originalAmount)
        console.log('实际金额 (actualAmount):', detail.actualAmount, '类型:', typeof detail.actualAmount)
        console.log('解析后的实际金额:', actualAmount, '类型:', typeof actualAmount)
        
        // 统一金额格式化
        const originalAmountStr = amount.formatAmount(originalAmount)
        const finalAmountStr = amount.formatAmount(actualAmount)
        const hasDiscount = originalAmount > actualAmount
        const discountAmountStr = hasDiscount ? amount.formatAmount(originalAmount - actualAmount) : '0.00'
        
        // 构建支付方式列表（根据后端返回的 supportedPaymentMethods）
        // PaymentMethod: 1=WECHAT_NATIVE, 2=WECHAT_MINIPROGRAM, 3=ALIPAY, 4=WALLET
        const paymentMethodsMap = {
          2: { code: 2, name: '微信支付', icon: '💳' },
          4: { code: 4, name: '钱包余额', icon: '💰' } // PaymentMethod.WALLET = 4
        }
        let paymentMethods = (detail.supportedPaymentMethods || []).map(code => paymentMethodsMap[code] || { code, name: '未知', icon: '💳' })

        // 如果是继续支付模式：隐藏优惠券、固定支付方式
        let readOnlyPayment = false
        if (detail.continueMode) {
          // 隐藏优惠券
          detail.couponAllowed = false
          // 固定支付方式为 currentPaymentMethod
          const fixed = paymentMethodsMap[detail.currentPaymentMethod] || null
          paymentMethods = fixed ? [fixed] : paymentMethods
          readOnlyPayment = true
          // 启动本次支付剩余时间倒计时
          this.startPayRemainCountdown(detail.paymentExpireTime)
        }
        
        // 支付页面只显示操作相关的按钮，过滤掉取消订单相关的按钮
        const allActions = detail.allowedActions || []
        const operateActions = allActions.filter(action => 
          action === 'PAY' || 
          action === 'CONTINUE_PAY' || 
          action === 'CANCEL_PAYMENT'
        )
        
        this.setData({
          paymentDetail: detail,
          originalAmount: originalAmount || 0, // 保留数字类型用于计算
          originalAmountStr: originalAmountStr, // 格式化字符串用于显示
          finalAmount: actualAmount || originalAmount || 0, // 保留数字类型用于计算
          finalAmountStr: finalAmountStr, // 格式化字符串用于显示
          hasDiscount,
          discountAmountStr,
          couponAllowed: detail.couponAllowed !== false,
          paymentMethods: paymentMethods.length > 0 ? paymentMethods : [{ code: 2, name: '微信支付', icon: '💳' }],
          // 默认选择第一个（继续支付模式下即为固定方式）
          selectedPaymentMethod: paymentMethods.length > 0 ? paymentMethods[0].code : 2,
          readOnlyPayment,
          allowedActions: operateActions, // 支付页面只显示操作相关的按钮
          loading: false
        }, () => {
          console.log('setData 后的数据:', this.data.originalAmount, this.data.finalAmount)
          console.log('格式化后的字符串:', this.data.originalAmountStr, this.data.finalAmountStr)
        })
        
        // 加载优惠券：
        // 1) 正常场景：允许使用优惠券 -> 加载可用优惠券供用户选择
        // 2) 继续支付：不允许选择，但需要根据 currentCouponId 展示只读优惠券信息
        if (detail.couponAllowed) {
          this.loadAvailableCoupons(originalAmount)
        } else if (detail.continueMode && detail.currentCouponId) {
          try {
            const resDetail = await api.getCouponDetail(detail.currentCouponId)
            if (resDetail && resDetail.success && resDetail.data) {
              const decorated = this.decorateCoupon(resDetail.data)
              this.setData({
                selectedCoupon: decorated
              })
            }
          } catch (e) {
            console.warn('加载只读优惠券失败（继续支付展示用）:', e)
          }
        }
      } else {
        wx.hideLoading()
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (e) {
      wx.hideLoading()
      console.error('加载支付详情失败:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } finally {
      wx.hideLoading()
    }
  },

  // 启动支付剩余时间倒计时
  startPayRemainCountdown(expireTime) {
    try {
      if (!expireTime) return
      if (this._remainTimer) clearInterval(this._remainTimer)
      const parseTs = (t) => {
        // 兼容字符串格式：优先 new Date(t)
        const d = new Date(t)
        if (!isNaN(d.getTime())) return d.getTime()
        return Date.parse(t)
      }
      const expireTs = typeof expireTime === 'number' ? expireTime : parseTs(expireTime)
      const tick = () => {
        const now = Date.now()
        let remain = Math.floor((expireTs - now) / 1000)
        if (remain < 0) remain = 0
        const mm = Math.floor(remain / 60)
        const ss = remain % 60
        const str = `${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`
        this.setData({ payRemainSeconds: remain, payRemainStr: str })
        if (remain === 0) {
          clearInterval(this._remainTimer)
          this._remainTimer = null
        }
      }
      tick()
      this._remainTimer = setInterval(tick, 1000)
    } catch (_) {}
  },

  onUnload() {
    if (this._remainTimer) {
      clearInterval(this._remainTimer)
      this._remainTimer = null
    }
  },

  // 加载用户余额
  async loadUserBalance() {
    try {
      const res = await api.getWalletBalance()
      if (res && res.success && res.data != null) {
        const balance = amount.parseBigDecimalLike(res.data, 0)
        
        this.setData({
          userBalance: balance,
          userBalanceStr: amount.formatAmount(balance)
        })
      } else {
        // 如果没有余额信息，设置为0
        this.setData({
          userBalance: 0,
          userBalanceStr: '0.00'
        })
      }
    } catch (e) {
      console.error('加载余额失败:', e)
      // 加载失败时设置为0
      this.setData({
        userBalance: 0,
        userBalanceStr: '0.00'
      })
    }
  },

  // 加载可用优惠券
  async loadAvailableCoupons(orderAmount) {
    try {
      console.log('加载可用优惠券，订单金额:', orderAmount)
      const res = await api.getAvailableCoupons(orderAmount)
      console.log('优惠券API返回:', res)
      if (res && res.success && res.data) {
        // 处理不同的数据格式：可能是数组，也可能是包含 list 的对象
        let couponsList = []
        if (Array.isArray(res.data)) {
          couponsList = res.data
        } else if (res.data.list && Array.isArray(res.data.list)) {
          couponsList = res.data.list
        } else if (res.data.data && Array.isArray(res.data.data)) {
          couponsList = res.data.data
        }
        
        const coupons = couponsList.map(item => this.decorateCoupon(item))
        console.log('处理后的优惠券列表:', coupons)
        this.setData({
          availableCoupons: coupons
        })
      } else {
        console.log('优惠券API返回数据格式异常:', res)
        this.setData({
          availableCoupons: []
        })
      }
    } catch (e) {
      console.error('加载优惠券失败:', e)
      this.setData({
        availableCoupons: []
      })
    }
  },

  // 装饰优惠券数据
  decorateCoupon(item) {
    // 后端返回的 UserCouponResp 字段：type, discountValue, minAmount, couponTemplateId, name, expiredAt
    const type = item.type || item.couponType || 1
    // 统一 BigDecimal 解析
    const discountValue = amount.parseBigDecimalLike(item.discountValue, 0)
    const minAmount = amount.parseBigDecimalLike(item.minAmount, 0)
    
    const typeMap = { 
      1: { name: '立减', icon: '💰', color: '#FF6B6B' }, 
      2: { name: '折扣', icon: '🎯', color: '#4ECDC4' }, 
      3: { name: '满减', icon: '🎁', color: '#FFA07A' }
    }
    const typeInfo = typeMap[type] || { name: '优惠券', icon: '🎫', color: '#95A5A6' }
    
    // 根据不同类型生成不同的显示内容
    let mainValue = '' // 主要优惠值显示
    let subtitle = '' // 副标题说明
    let conditionText = '' // 使用条件
    
    if (type === 1) {
      // 立减类型：显示减免金额
      mainValue = `¥${Math.round(discountValue).toString()}`
      subtitle = '立减优惠'
      conditionText = minAmount > 0 ? `满¥${amount.formatAmount(minAmount)}可用` : '无门槛使用'
    } else if (type === 2) {
      // 折扣类型：显示折扣百分比
      mainValue = `${discountValue}%`
      subtitle = '折扣优惠'
      conditionText = minAmount > 0 ? `满¥${amount.formatAmount(minAmount)}可用` : '无门槛使用'
    } else if (type === 3) {
      // 满减类型：显示减免金额和满额要求
      mainValue = `¥${Math.round(discountValue).toString()}`
      subtitle = '满减优惠'
      conditionText = `满¥${amount.formatAmount(minAmount)}减¥${Math.round(discountValue).toString()}`
    }
    
    // 格式化过期时间
    let expiredAtText = ''
    if (item.expiredAt) {
      try {
        const expiredDate = new Date(item.expiredAt)
        const now = new Date()
        const daysLeft = Math.ceil((expiredDate - now) / (1000 * 60 * 60 * 24))
        if (daysLeft > 0) {
          expiredAtText = daysLeft === 1 ? '今日过期' : `${daysLeft}天后过期`
        } else {
          expiredAtText = '已过期'
        }
      } catch (e) {
        console.error('解析过期时间失败:', e)
      }
    }
    
    return {
      ...item,
      couponTemplateId: item.couponTemplateId || item.id, // 确保 couponTemplateId 存在
      type: type,
      typeText: typeInfo.name,
      typeIcon: typeInfo.icon,
      typeColor: typeInfo.color,
      mainValue: mainValue,
      subtitle: subtitle,
      conditionText: conditionText,
      discountValue: discountValue,
      minAmount: minAmount,
      expiredAtText: expiredAtText,
      // 保留旧字段用于兼容
      valuePrefix: type === 2 ? '' : '¥',
      valueDisplay: type === 2 ? `${discountValue}%` : Math.round(discountValue).toString(),
      discount: discountValue
    }
  },

  // 显示/隐藏优惠券选择器
  toggleCouponPicker() {
    const newState = !this.data.showCouponPicker
    console.log('切换优惠券选择器状态:', newState, '当前优惠券数量:', this.data.availableCoupons.length)
    this.setData({
      showCouponPicker: newState
    })
    
    // 如果打开选择器且没有加载过优惠券，则加载
    if (newState && this.data.availableCoupons.length === 0) {
      this.loadAvailableCoupons(this.data.originalAmount)
    }
  },

  // 选择优惠券
  async selectCoupon(e) {
    const coupon = e.currentTarget.dataset.coupon
    if (!coupon) return
    
    try {
      wx.showLoading({ title: '计算中...' })
      
      // 调用后端计算优惠金额（使用订单号和用户代金券ID）
      const res = await api.calculateCouponDiscountByOrder(
        this.data.orderNo,
        coupon.id  // 使用用户代金券ID，不是模板ID
      )
      
      wx.hideLoading()
      
      if (res && res.success && res.data != null) {
        const discountValue = amount.parseBigDecimalLike(res.data, 0)
        const discount = amount.nonNegative(discountValue)
        const finalAmount = amount.nonNegative(this.data.originalAmount - discount)
        
        const updates = {
          selectedCoupon: coupon,
          couponDiscount: discount,
          finalAmount: finalAmount,
          finalAmountStr: amount.formatAmount(finalAmount),
          showCouponPicker: false
        }
        // 若为0元，限定仅钱包支付
        if (finalAmount === 0) {
          const walletOnly = [{ code: 4, name: '钱包余额', icon: '💰' }]
          updates.paymentMethods = walletOnly
          updates.selectedPaymentMethod = 4
        }
        this.setData(updates)
      } else {
        wx.showToast({ title: res?.message || '计算失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('计算优惠金额失败:', e)
      wx.showToast({ title: e?.message || '计算失败', icon: 'none' })
    }
  },

  // 不使用优惠券
  removeCoupon() {
    const fa = this.data.originalAmount
    const updates = {
      selectedCoupon: null,
      couponDiscount: 0,
      finalAmount: fa,
      finalAmountStr: amount.formatAmount(fa)
    }
    // 恢复默认支付方式（微信+钱包），当金额>0时
    if (fa > 0) {
      updates.paymentMethods = [
        { code: 2, name: '微信支付', icon: '💳' },
        { code: 4, name: '钱包余额', icon: '💰' }
      ]
      updates.selectedPaymentMethod = 2
    }
    this.setData(updates)
  },

  // 选择支付方式
  selectPaymentMethod(e) {
    if (this.data.readOnlyPayment) return
    const method = e.currentTarget.dataset.method
    if (!method) return
    
    this.setData({
      selectedPaymentMethod: method.code
    })
  },

  // 确认支付
  async onPay() {
    const { orderNo, selectedPaymentMethod, selectedCoupon, finalAmount } = this.data
    
    // 每次点击前先确保清理自定义倒计时与系统Loading
    try { wx.hideLoading() } catch (_) {}
    this.setData({ showPaymentLoading: false, paymentLoadingCountdown: 0 })

    // 金额校验与0元分支
    if (finalAmount < 0) {
      wx.showToast({ title: '金额异常', icon: 'none' })
      return
    }
    if (finalAmount === 0) {
      // 仅走钱包支付，同步成功，不拉起三方
      try {
        const couponId = selectedCoupon ? selectedCoupon.id : null
        const res = await api.createPayment(orderNo, 4, couponId)
        if (res && res.success) {
          wx.showToast({ title: '支付成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1200)
        } else {
          wx.showToast({ title: res?.message || '支付失败，请重试', icon: 'none' })
        }
      } catch (e) {
        wx.showToast({ title: e?.message || '支付失败，请重试', icon: 'none' })
      }
      return
    }
    
    // 如果是钱包支付，检查余额是否充足
    if (selectedPaymentMethod === 4) {
      const { userBalance } = this.data
      if (userBalance < finalAmount) {
        wx.showToast({ title: '余额不足，请选择其他支付方式', icon: 'none' })
        return
      }
    }
    
    try {
      // 若处于继续支付模式，先主动刷新一次三方状态；失败则阻断后续流程
      if (this.data.paymentDetail && this.data.paymentDetail.continueMode) {
        try {
          await api.refreshPaymentStatus(orderNo)
        } catch (e) {
          // 确保不进入倒计时覆盖层
          this.setData({ showPaymentLoading: false, paymentLoadingCountdown: 0 })
          wx.showToast({ title: '无法确认支付状态，请稍后重试', icon: 'none' })
          return
        }
      }
      wx.showLoading({ title: '支付中...', mask: true })
      
      // 先查询订单的支付进度，判断是创建支付还是继续支付
      const progressRes = await api.getPaymentProgress(orderNo)
      let res = null
      
      if (progressRes && progressRes.success && progressRes.data) {
        const paymentStatus = progressRes.data.paymentStatus
        
        if (paymentStatus === 'paying') {
          // 订单处于支付中状态，调用继续支付接口
          res = await api.continuePayment(orderNo)
        } else if (paymentStatus === 'pending') {
          // 订单处于待支付状态，调用创建支付订单接口
          const couponId = selectedCoupon ? selectedCoupon.id : null
          res = await api.createPayment(orderNo, selectedPaymentMethod, couponId)
        } else {
          // 订单已支付成功或失败，不允许再次支付
          wx.hideLoading()
          wx.showToast({ 
            title: paymentStatus === 'success' ? '订单已支付成功' : '订单已支付失败', 
            icon: 'none' 
          })
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
          return
        }
      } else {
        // 查询支付进度失败，默认调用创建支付订单接口
        const couponId = selectedCoupon ? selectedCoupon.id : null
        res = await api.createPayment(orderNo, selectedPaymentMethod, couponId)
      }
      
      wx.hideLoading()
      
      if (res && res.success) {
        // 钱包支付是同步的，不需要调起微信支付
        if (selectedPaymentMethod === 4) {
          // 钱包支付成功
          wx.showToast({ 
            title: '支付成功', 
            icon: 'success',
            duration: 2000
          })
          
          // 延迟跳转到订单详情或订单列表
          setTimeout(() => {
            wx.navigateBack()
            // 或者跳转到订单详情页面
            // wx.redirectTo({
            //   url: `/pages/orders/index?orderNo=${orderNo}`
            // })
          }, 1500)
        } else {
          // 微信小程序支付：调起并进入5秒短轮询（自定义倒计时加载，不使用系统Loading）
          const paymentParams = res.data.paymentParams
          if (!paymentParams) {
            wx.showToast({ title: '支付参数错误', icon: 'none' })
            return
          }
          
          try {
            // 封装的 Promise 版支付请求
            await payUtils.requestPayment(paymentParams)
          } catch (_) {
            // 无论成功或失败（含用户取消），都进行一次快速确认
          }

          // 快速确认：先触发一次直查回补，再查进度；若已得出结论则不进入倒计时
          try {
            try { await api.refreshPaymentStatus(orderNo) } catch (_) {}
            const quick = await api.getPaymentProgress(orderNo)
            if (quick && quick.success && quick.data) {
              const st = quick.data.paymentStatus
              if (st === 'success') {
                wx.showToast({ title: '支付成功', icon: 'success' })
                setTimeout(() => wx.navigateBack(), 1200)
                return
              } else if (st === 'failed') {
                wx.showToast({ title: '支付失败', icon: 'none' })
                return
              }
            }
          } catch (_) { /* 忽略，进入倒计时兜底 */ }

          // 进入5秒短轮询确认（展示自定义倒计时 UI）
          try {
            const result = await payUtils.pollPaymentProgress(orderNo, 5, this)
            if (result.paymentStatus === 'success') {
              wx.showToast({ title: '支付成功', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 1200)
            } else if (result.paymentStatus === 'failed') {
              wx.showToast({ title: '支付失败', icon: 'none' })
            } else {
              wx.showToast({ title: '支付处理中，请稍后在订单查看', icon: 'none' })
            }
          } catch (e) {
            wx.showToast({ title: '确认支付结果失败', icon: 'none' })
          }
        }
      } else {
        wx.showToast({ 
          title: res?.message || '支付失败，请重试', 
          icon: 'none' 
        })
      }
    } catch (e) {
      wx.hideLoading()
      console.error('支付异常:', e)
      wx.showToast({ 
        title: e?.message || '支付失败，请重试', 
        icon: 'none' 
      })
    }
  },

  // 处理操作按钮点击
  async handleAction(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'PAY' || action === 'CONTINUE_PAY') {
      // 发起支付或继续支付
      await this.onPay()
    } else if (action === 'CANCEL_PAYMENT') {
      // 取消本次支付
      await this.onCancelPayment()
    }
  },

  async onCancelPayment() {
    const { orderNo } = this.data
    wx.showModal({
      title: '确认取消支付',
      content: '确定要取消本次支付吗？取消后可稍后重新支付。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '取消中...' })
          const { api } = require('../../utils/util.js')
          const result = await api.cancelThirdPartyPayment(orderNo)
          wx.hideLoading()
          if (result && result.success) {
            wx.showToast({ title: '已取消本次支付', icon: 'success' })
            // 返回上一页
            setTimeout(() => {
              wx.navigateBack()
            }, 800)
          } else {
            wx.showToast({ title: result?.message || '取消失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    })
  },

  // 已移除倒计时与轮询逻辑，支付结果完全交由后端更新


})

