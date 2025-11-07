// pages/profile/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    isLogin: false,
    balance: 0, // 钱包余额
    couponCount: 0, // 卡券数量
    addressCount: 0 // 地址数量
  },

  onShow(){
    // 每次进入页面都刷新数据
    const isLogin = api.checkLogin()
    this.setData({ isLogin })
    if (isLogin) {
      // 刷新用户信息和统计数据
      this.loadUserInfo()
      this.loadStats() // 加载统计数据（余额、卡券、地址）
    } else {
      // 未登录时重置为0
      this.setData({
        userInfo: null,
        balance: 0,
        couponCount: 0,
        addressCount: 0
      })
    }
  },

  async loadUserInfo(){
    try {
      const res = await api.getUserInfo()
      if (res && res.success) {
        this.setData({ 
          userInfo: res.data, 
          isLogin: true 
        })
      } else {
        // 如果接口返回失败，清除登录状态
        this.setData({ 
          userInfo: null, 
          isLogin: false,
          balance: 0,
          couponCount: 0,
          addressCount: 0
        })
      }
    } catch (e) {
      console.error('加载用户信息失败:', e)
      api.clearToken()
      this.setData({ 
        userInfo: null, 
        isLogin: false,
        balance: 0,
        couponCount: 0,
        addressCount: 0
      })
    }
  },

  // 加载统计数据（余额、卡券数量、地址数量）
  async loadStats() {
    // 并行加载三个统计数据
    Promise.all([
      this.loadBalance(),
      this.loadCouponCount(),
      this.loadAddressCount()
    ]).catch(e => {
      console.error('加载统计数据失败:', e)
    })
  },

  // 加载钱包余额
  async loadBalance() {
    try {
      const res = await api.getWalletBalance()
      if (res && res.success && res.data != null) {
        // 处理后端返回的 BigDecimal
        let balance = 0
        if (typeof res.data === 'number') {
          balance = res.data
        } else if (typeof res.data === 'string') {
          balance = parseFloat(res.data)
        } else if (res.data.value != null) {
          balance = parseFloat(res.data.value || res.data)
        }
        this.setData({ balance })
      }
    } catch (e) {
      console.error('加载余额失败:', e)
    }
  },

  // 加载卡券数量
  async loadCouponCount() {
    try {
      // 获取未使用状态的卡券总数
      // 注意：这里只统计未使用的卡券（status=1），如果需要统计所有状态的卡券，需要调用多次并累加
      const res = await api.getUserCoupons(1, 1, 1) // status=1表示未使用，pageNum=1, pageSize=1（只需要总数）
      if (res && res.success && res.data) {
        const data = res.data
        let total = 0
        // 后端返回的是 PageResult 格式：{ list: [], total: 0, page: 1, pageSize: 20 }
        if (data.total != null) {
          total = parseInt(data.total) || 0
        } else if (data.list && Array.isArray(data.list)) {
          // 如果没有total字段，使用list长度（但这不是真实总数，只是一个估计）
          total = data.list.length
        }
        this.setData({ couponCount: total })
      }
    } catch (e) {
      console.error('加载卡券数量失败:', e)
    }
  },

  // 加载地址数量
  async loadAddressCount() {
    try {
      // 获取地址列表（使用一个小页面大小来获取总数）
      const res = await api.getAddressList(1, 1) // pageNum=1, pageSize=1（只需要总数）
      if (res && res.success && res.data) {
        const data = res.data
        let total = 0
        // 后端返回的是 PageResult 格式：{ list: [], total: 0, page: 1, pageSize: 20 }
        if (data.total != null) {
          total = parseInt(data.total) || 0
        } else if (data.list && Array.isArray(data.list)) {
          // 如果没有total字段，使用list长度（但这不是真实总数，只是一个估计）
          total = data.list.length
        }
        this.setData({ addressCount: total })
      }
    } catch (e) {
      console.error('加载地址数量失败:', e)
    }
  },

  goLogin(){ wx.navigateTo({ url: '/pages/login/login' }) },
  goOrders(){ wx.switchTab({ url: '/pages/orders/index' }) },
  goRecharge(){ wx.navigateTo({ url: '/pages/recharge/recharge' }) },
  goBindPhone(){ wx.navigateTo({ url: '/pages/bind-phone/bind-phone' }) },
  goWallet(){ wx.navigateTo({ url: '/pages/wallet/index' }) },

  // 地址管理已实现
  goAddress(){ wx.navigateTo({ url: '/pages/address/index' }) },
  
  // 卡券相关
  goCouponCenter(){ wx.navigateTo({ url: '/pages/coupon/index' }) },
  goMyCoupons(){ wx.navigateTo({ url: '/pages/coupon/index' }) },
  goFeedback(){ wx.navigateTo({ url: '/pages/feedback/index' }) },
  goService(){ wx.navigateTo({ url: '/pages/service/index' }) },
  goInvite(){ wx.navigateTo({ url: '/pages/placeholder/index' }) },
  goSettings(){ wx.navigateTo({ url: '/pages/placeholder/index' }) }
})
