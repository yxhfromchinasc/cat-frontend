const api = require('../../utils/api.js')

Page({
  data: {
    currentTab: 0, // 0-我的卡券，1-可领取
    couponStatus: 1, // 1-未使用，2-已使用，3-已过期
    userCoupons: [],
    couponTemplates: [],
    loading: false
  },

  onLoad() {
    this.loadUserCoupons()
  },

  onShow() {
    if (this.data.currentTab === 0) {
      this.loadUserCoupons()
    } else {
      this.loadCouponTemplates()
    }
  },

  onPullDownRefresh() {
    if (this.data.currentTab === 0) {
      this.loadUserCoupons()
    } else {
      this.loadCouponTemplates()
    }
    wx.stopPullDownRefresh()
  },

  // 切换标签
  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({ currentTab: index })
    
    if (index === 0) {
      this.loadUserCoupons()
    } else {
      this.loadCouponTemplates()
    }
  },

  // 筛选卡券状态
  filterCoupons(e) {
    const status = parseInt(e.currentTarget.dataset.status)
    this.setData({ couponStatus: status })
    this.loadUserCoupons()
  },

  // 加载用户卡券
  async loadUserCoupons() {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    try {
      const res = await api.getUserCoupons(this.data.couponStatus, 1, 20)
      if (res && res.success && res.data) {
        const list = (res.data.list || []).map(this.decorateCoupon)
        this.setData({ 
          userCoupons: list,
          loading: false 
        })
      } else {
        this.setData({ 
          userCoupons: [],
          loading: false 
        })
      }
    } catch (error) {
      console.error('加载用户卡券失败:', error)
      this.setData({ 
        userCoupons: [],
        loading: false 
      })
    }
  },

  // 加载可领取卡券模板
  async loadCouponTemplates() {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    try {
      const res = await api.getCouponTemplates(1, 20)
      if (res && res.success && res.data) {
        // 获取用户对每个代金券的领取次数
        const templates = res.data.list || []
        const decoratedTemplates = []
        
        for (const template of templates) {
          try {
            const countRes = await api.getUserCouponReceiveCount(template.id)
            const userReceivedCount = countRes && countRes.success ? countRes.data : 0
            const decorated = this.decorateTemplate(template, userReceivedCount)
            decoratedTemplates.push(decorated)
          } catch (error) {
            console.error('获取领取次数失败:', error)
            const decorated = this.decorateTemplate(template, 0)
            decoratedTemplates.push(decorated)
          }
        }
        
        this.setData({ 
          couponTemplates: decoratedTemplates,
          loading: false 
        })
      } else {
        this.setData({ 
          couponTemplates: [],
          loading: false 
        })
      }
    } catch (error) {
      console.error('加载卡券模板失败:', error)
      this.setData({ 
        couponTemplates: [],
        loading: false 
      })
    }
  },

  // 领取代金券
  async receiveCoupon(e) {
    const couponTemplateId = e.currentTarget.dataset.id
    
    try {
      const res = await api.receiveCoupon(couponTemplateId)
      if (res && res.success) {
        wx.showToast({
          title: '领取成功',
          icon: 'success',
          duration: 2000
        })
        // 刷新可领取列表
        this.loadCouponTemplates()
      }
    } catch (error) {
      console.error('领取代金券失败:', error)
      wx.showToast({
        title: error.message || '领取失败',
        icon: 'none',
        duration: 2000
      })
    }
  }
  ,

  // 美化展示字段
  decorateCoupon(item) {
    const type = item.type ?? item.couponType ?? item.templateType
    const rawDiscount = item.discountValue ?? item.discount ?? item.value
    const rawMin = item.minAmount ?? item.min ?? 0

    const toNumber = (v, d = 0) => {
      const n = parseFloat(v)
      return Number.isFinite(n) ? n : d
    }

    const typeMap = { 1: '立减', 2: '折扣', 3: '满减' }
    const discount = toNumber(rawDiscount, 0)
    const minAmt = toNumber(rawMin, 0)
    const valuePrefix = type === 2 ? '' : '¥'
    const valueDisplay = type === 2 ? (discount ? `${discount}%` : '--') : (discount ? discount.toFixed(0) : '--')
    const conditionText = minAmt <= 0 ? '无门槛' : `满${minAmt.toFixed(0)}可用`
    const expiredText = (item.expiredAt || '').replace('T', ' ').slice(0, 19) // Format to seconds

    // 使用服务端提供的状态信息
    // 类型样式
    const typeClass = type === 1 ? 'type-fixed' : (type === 2 ? 'type-discount' : 'type-fullreduce')

    let cardClass = 'available' // Default to available
    if (item.used) {
      cardClass = 'used'
    } else if (item.expired) {
      cardClass = 'expired'
    }

    // 折扣券附加文案（最高减）
    const extraText = type === 2 && Number.isFinite(discount) && Number.isFinite(toNumber(item.maxDiscount, 0)) && toNumber(item.maxDiscount, 0) > 0
      ? `最高减¥${toNumber(item.maxDiscount, 0).toFixed(0)}` : ''

    return Object.assign({}, item, {
      typeText: typeMap[type] || '优惠',
      valuePrefix,
      valueDisplay,
      conditionText,
      expiredText,
      cardClass: `${cardClass} ${typeClass}`.trim(), // Add cardClass for styling
      statusText: item.statusText || '未使用', // Use server-provided status text
      extraText
    })
  },

  decorateTemplate(item, userReceivedCount = 0) {
    const type = item.type ?? item.couponType ?? item.templateType
    const rawDiscount = item.discountValue ?? item.discount ?? item.value
    const rawMin = item.minAmount ?? item.min ?? 0

    const toNumber = (v, d = 0) => {
      const n = parseFloat(v)
      return Number.isFinite(n) ? n : d
    }

    const typeMap = { 1: '立减', 2: '折扣', 3: '满减' }
    const discount = toNumber(rawDiscount, 0)
    const minAmt = toNumber(rawMin, 0)
    const valuePrefix = type === 2 ? '' : '¥'
    const valueDisplay = type === 2 ? (discount ? `${discount}%` : '--') : (discount ? discount.toFixed(0) : '--')
    const conditionText = minAmt <= 0 ? '无门槛' : `满${minAmt.toFixed(0)}可用`
    const validToRaw = item.validTo || item.expiredAt || item.expiredTime
    const validToText = validToRaw ? String(validToRaw).replace('T', ' ').slice(0, 19) : '--'
    
    // 判断卡券状态
    const now = new Date()
    const expiredTime = validToRaw ? new Date(validToRaw) : null
    const isExpired = expiredTime && now > expiredTime
    const isSoldOut = item.usedCount >= item.totalCount
    const maxReceivePerUser = item.maxReceivePerUser || 1
    const isUserMaxReached = userReceivedCount >= maxReceivePerUser
    
    let buttonText = '立即领取'
    let buttonDisabled = false
    let cardClass = 'available'
    
    if (isExpired) {
      buttonText = '已过期'
      buttonDisabled = true
      cardClass = 'expired'
    } else if (isSoldOut) {
      buttonText = '已领完'
      buttonDisabled = true
      cardClass = 'sold-out'
    } else if (isUserMaxReached) {
      buttonText = '已领取'
      buttonDisabled = true
      cardClass = 'max-reached'
    }
    
    // 类型样式
    const typeClass = type === 1 ? 'type-fixed' : (type === 2 ? 'type-discount' : 'type-fullreduce')
    // 折扣券附加文案
    const extraText = type === 2 && Number.isFinite(discount) && Number.isFinite(toNumber(item.maxDiscount, 0)) && toNumber(item.maxDiscount, 0) > 0
      ? `最高减¥${toNumber(item.maxDiscount, 0).toFixed(0)}` : ''

    return Object.assign({}, item, {
      typeText: typeMap[type] || '优惠',
      valuePrefix,
      valueDisplay,
      conditionText,
      validToText,
      buttonText,
      buttonDisabled,
      cardClass: `${cardClass} ${typeClass}`.trim(),
      userReceivedCount,
      maxReceivePerUser,
      extraText
    })
  },

  // 分享给好友
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    const sharePath = app.getSharePath()
    const shareConfig = {
      title: '喵呜管家 - 便捷的生活服务小程序',
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

})
