// pages/payment/index.js
const { api } = require('../../utils/util.js')

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
    
    loading: true
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
        // 确保金额字段正确解析（处理 null、undefined 和字符串数字）
        const originalAmount = detail.totalAmount != null && detail.totalAmount !== undefined ? Number(detail.totalAmount) : 0
        const actualAmount = detail.actualAmount != null && detail.actualAmount !== undefined ? Number(detail.actualAmount) : (detail.totalAmount != null && detail.totalAmount !== undefined ? Number(detail.totalAmount) : 0)
        
        console.log('支付详情数据:', detail)
        console.log('订单金额 (totalAmount):', detail.totalAmount, '类型:', typeof detail.totalAmount)
        console.log('解析后的订单金额:', originalAmount, '类型:', typeof originalAmount)
        console.log('实际金额 (actualAmount):', detail.actualAmount, '类型:', typeof detail.actualAmount)
        console.log('解析后的实际金额:', actualAmount, '类型:', typeof actualAmount)
        
        // 格式化金额为字符串（用于显示）
        const originalAmountStr = originalAmount.toFixed(2)
        const finalAmountStr = actualAmount.toFixed(2)
        
        // 构建支付方式列表（根据后端返回的 supportedPaymentMethods）
        // PaymentMethod: 1=WECHAT_NATIVE, 2=WECHAT_MINIPROGRAM, 3=ALIPAY, 4=WALLET
        const paymentMethodsMap = {
          2: { code: 2, name: '微信支付', icon: '💳' },
          4: { code: 4, name: '钱包余额', icon: '💰' } // PaymentMethod.WALLET = 4
        }
        const paymentMethods = (detail.supportedPaymentMethods || []).map(code => paymentMethodsMap[code] || { code, name: '未知', icon: '💳' })
        
        this.setData({
          paymentDetail: detail,
          originalAmount: originalAmount || 0, // 保留数字类型用于计算
          originalAmountStr: originalAmountStr, // 格式化字符串用于显示
          finalAmount: actualAmount || originalAmount || 0, // 保留数字类型用于计算
          finalAmountStr: finalAmountStr, // 格式化字符串用于显示
          couponAllowed: detail.couponAllowed !== false,
          paymentMethods: paymentMethods.length > 0 ? paymentMethods : [{ code: 2, name: '微信支付', icon: '💳' }],
          // 默认选择最后一个支付方式（通常钱包支付排在最后）
          selectedPaymentMethod: paymentMethods.length > 0 ? paymentMethods[paymentMethods.length - 1].code : 2,
          loading: false
        }, () => {
          console.log('setData 后的数据:', this.data.originalAmount, this.data.finalAmount)
          console.log('格式化后的字符串:', this.data.originalAmountStr, this.data.finalAmountStr)
        })
        
        // 如果允许使用优惠券，加载可用优惠券
        if (detail.couponAllowed) {
          this.loadAvailableCoupons(originalAmount)
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

  // 加载用户余额
  async loadUserBalance() {
    try {
      const res = await api.getWalletBalance()
      if (res && res.success && res.data != null) {
        // 后端返回的是 BigDecimal，可能是数字、字符串或对象
        let balance = 0
        if (typeof res.data === 'number') {
          balance = res.data
        } else if (typeof res.data === 'string') {
          balance = parseFloat(res.data)
        } else if (res.data.value != null) {
          balance = parseFloat(res.data.value || res.data)
        }
        
        this.setData({
          userBalance: balance,
          userBalanceStr: balance.toFixed(2)
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
    // 处理 BigDecimal 序列化后的值（可能是对象、字符串或数字）
    let discountValue = 0
    if (item.discountValue != null) {
      if (typeof item.discountValue === 'number') {
        discountValue = item.discountValue
      } else if (typeof item.discountValue === 'string') {
        discountValue = parseFloat(item.discountValue)
      } else if (item.discountValue.value != null) {
        discountValue = parseFloat(item.discountValue.value || item.discountValue)
      }
    }
    
    let minAmount = 0
    if (item.minAmount != null) {
      if (typeof item.minAmount === 'number') {
        minAmount = item.minAmount
      } else if (typeof item.minAmount === 'string') {
        minAmount = parseFloat(item.minAmount)
      } else if (item.minAmount.value != null) {
        minAmount = parseFloat(item.minAmount.value || item.minAmount)
      }
    }
    
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
      mainValue = `¥${discountValue.toFixed(0)}`
      subtitle = '立减优惠'
      conditionText = minAmount > 0 ? `满¥${minAmount.toFixed(2)}可用` : '无门槛使用'
    } else if (type === 2) {
      // 折扣类型：显示折扣百分比
      mainValue = `${discountValue}%`
      subtitle = '折扣优惠'
      conditionText = minAmount > 0 ? `满¥${minAmount.toFixed(2)}可用` : '无门槛使用'
    } else if (type === 3) {
      // 满减类型：显示减免金额和满额要求
      mainValue = `¥${discountValue.toFixed(0)}`
      subtitle = '满减优惠'
      conditionText = `满¥${minAmount.toFixed(2)}减¥${discountValue.toFixed(0)}`
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
      valueDisplay: type === 2 ? `${discountValue}%` : discountValue.toFixed(0),
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
        // 后端返回的是优惠金额（BigDecimal），可能是数字、字符串或对象
        let discountValue = 0
        if (typeof res.data === 'number') {
          discountValue = res.data
        } else if (typeof res.data === 'string') {
          discountValue = parseFloat(res.data)
        } else if (res.data.value != null) {
          discountValue = parseFloat(res.data.value || res.data)
        }
        
        const discount = Math.max(0, discountValue)
        const finalAmount = Math.max(0, this.data.originalAmount - discount)
        
        this.setData({
          selectedCoupon: coupon,
          couponDiscount: discount,
          finalAmount: finalAmount,
          finalAmountStr: finalAmount.toFixed(2),
          showCouponPicker: false
        })
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
    this.setData({
      selectedCoupon: null,
      couponDiscount: 0,
      finalAmount: this.data.originalAmount,
      finalAmountStr: this.data.originalAmount.toFixed(2)
    })
  },

  // 选择支付方式
  selectPaymentMethod(e) {
    const method = e.currentTarget.dataset.method
    if (!method) return
    
    this.setData({
      selectedPaymentMethod: method.code
    })
  },

  // 确认支付
  async onPay() {
    const { orderNo, selectedPaymentMethod, selectedCoupon, finalAmount } = this.data
    
    // 验证支付金额
    if (finalAmount <= 0) {
      wx.showToast({ title: '支付金额必须大于0', icon: 'none' })
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
      wx.showLoading({ title: '支付中...', mask: true })
      
      // 获取选中的优惠券ID（如果有）
      const couponId = selectedCoupon ? selectedCoupon.id : null
      
      // 调用后端创建支付订单接口（传递优惠券ID）
      const res = await api.createPayment(orderNo, selectedPaymentMethod, couponId)
      
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
          // 微信小程序支付，需要调起微信支付
          const paymentParams = res.data.paymentParams
          if (!paymentParams) {
            wx.showToast({ title: '支付参数错误', icon: 'none' })
            return
          }
          
          // 调起微信支付
          wx.requestPayment({
            timeStamp: String(paymentParams.timeStamp),
            nonceStr: paymentParams.nonceStr,
            package: paymentParams.package,
            signType: paymentParams.signType,
            paySign: paymentParams.paySign,
            success: () => {
              // 支付调起成功，启动5秒轮询查询支付结果
              this.pollPaymentResult(orderNo, 5)
            },
            fail: (err) => {
              console.error('微信支付失败:', err)
              if (err && err.errMsg && err.errMsg.includes('cancel')) {
                // 用户主动取消支付，但需要先确认订单状态
                // 因为支付成功后关闭组件也可能触发 cancel 回调
                this.handleUserCancelPaymentWithCheck(orderNo)
              } else {
                // 支付失败，也启动轮询（防止网络问题导致状态未同步）
                wx.showToast({ 
                  title: '支付失败，正在确认结果...', 
                  icon: 'none',
                  duration: 2000
                })
                this.pollPaymentResult(orderNo, 5)
              }
            }
          })
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

  /**
   * 轮询查询支付结果
   * @param {string} orderNo 订单号
   * @param {number} durationSeconds 轮询持续时间（秒），默认5秒
   */
  pollPaymentResult(orderNo, durationSeconds = 5) {
    if (!orderNo) {
      console.error('订单号不能为空')
      return
    }

    wx.showLoading({ title: '确认支付结果...', mask: true })

    let pollCount = 0
    const maxPolls = durationSeconds // 每秒查询一次，共查询指定次数
    const pollInterval = 1000 // 1秒

    const pollTimer = setInterval(async () => {
      pollCount++

      try {
        // 查询支付结果
        const statusRes = await api.getRechargeStatus(orderNo)

        if (statusRes && statusRes.success && statusRes.data) {
          const status = statusRes.data.status

          if (status === 2) {
            // 已支付 - 立即处理并停止轮询
            clearInterval(pollTimer)
            wx.hideLoading()
            wx.showToast({
              title: '支付成功',
              icon: 'success',
              duration: 2000
            })

            // 延迟跳转
            setTimeout(() => {
              wx.navigateBack()
            }, 1500)
            return
          } else if (status === 3 || status === 4) {
            // 支付失败或已取消 - 停止轮询
            clearInterval(pollTimer)
            wx.hideLoading()
            if (status === 3) {
              wx.showToast({
                title: '支付失败',
                icon: 'none',
                duration: 2000
              })
            } else {
              wx.showToast({
                title: '订单已取消',
                icon: 'none',
                duration: 2000
              })
            }
            return
          }
          // status === 1 (待支付) 或其他状态，继续轮询
        }

        // 如果达到最大轮询次数，停止轮询
        if (pollCount >= maxPolls) {
          clearInterval(pollTimer)
          wx.hideLoading()
          // 如果还是待支付状态，提示用户稍后查看
          wx.showToast({
            title: '支付处理中，请稍后查看',
            icon: 'none',
            duration: 3000
          })
        }
      } catch (e) {
        // 查询失败，记录日志但继续轮询
        console.error(`第${pollCount}次查询支付状态失败:`, e)

        // 如果达到最大轮询次数，停止轮询
        if (pollCount >= maxPolls) {
          clearInterval(pollTimer)
          wx.hideLoading()
          wx.showToast({
            title: '支付已提交，请稍后查看结果',
            icon: 'none',
            duration: 3000
          })
        }
      }
    }, pollInterval)
  },

  /**
   * 处理用户主动取消支付（带订单状态检查）
   * 先查询订单状态，确认是否已经支付成功，再决定是否调用取消接口
   * @param {string} orderNo 订单号
   */
  async handleUserCancelPaymentWithCheck(orderNo) {
    try {
      wx.showLoading({ title: '确认支付结果...', mask: true })
      
      // 延迟 2 秒，等待微信回调处理完成
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 查询订单状态，确认是否已经支付成功
      const statusRes = await api.getRechargeStatus(orderNo)
      
      if (statusRes && statusRes.success && statusRes.data) {
        const status = statusRes.data.status
        
        if (status === 2) {
          // 订单已支付成功，不调用取消接口，直接显示成功并返回
          wx.hideLoading()
          wx.showToast({
            title: '支付成功',
            icon: 'success',
            duration: 2000
          })
          
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
          return
        } else if (status === 3 || status === 4) {
          // 订单已失败或已取消，不需要再调用取消接口
          wx.hideLoading()
          if (status === 3) {
            wx.showToast({
              title: '支付失败',
              icon: 'none',
              duration: 2000
            })
          } else {
            wx.showToast({
              title: '订单已取消',
              icon: 'none',
              duration: 2000
            })
          }
          
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
          return
        } else {
          // 订单还在待支付状态（status === 1），调用取消接口
          wx.hideLoading()
          await this.handleUserCancelPayment(orderNo)
          return
        }
      } else {
        // 查询订单状态失败，保守处理：不调用取消接口，继续轮询确认
        wx.hideLoading()
        this.pollPaymentResult(orderNo, 5)
      }
    } catch (e) {
      wx.hideLoading()
      console.error('查询订单状态异常:', e)
      // 查询失败，保守处理：不调用取消接口，继续轮询确认
      this.pollPaymentResult(orderNo, 5)
    }
  },

  /**
   * 处理用户主动取消支付
   * 调用后端取消接口，关闭第三方支付订单并更新本地订单状态
   * @param {string} orderNo 订单号
   */
  async handleUserCancelPayment(orderNo) {
    try {
      wx.showLoading({ title: '取消支付中...', mask: true })
      
      // 调用后端取消第三方支付接口
      const res = await api.cancelThirdPartyPayment(orderNo)
      
      wx.hideLoading()
      
      if (res && res.success) {
        // 取消成功
        wx.showToast({
          title: '已取消支付',
          icon: 'success',
          duration: 2000
        })
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        // 取消失败，但仍然可能已取消，继续轮询确认
        wx.showToast({
          title: res?.message || '取消支付失败',
          icon: 'none',
          duration: 2000
        })
        
        // 继续轮询确认订单状态
        this.pollPaymentResult(orderNo, 5)
      }
    } catch (e) {
      wx.hideLoading()
      console.error('取消支付异常:', e)
      wx.showToast({
        title: '取消支付失败，请稍后查看',
        icon: 'none',
        duration: 2000
      })
      
      // 即使取消接口调用失败，也轮询确认订单状态
      this.pollPaymentResult(orderNo, 5)
    }
  },

})

