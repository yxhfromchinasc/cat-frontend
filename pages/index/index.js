// index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    isLogin: false,
    showLoginModal: false,
    servicePhone: '' // 客服电话
  },

  onLoad() {
    this.checkLoginStatus()
    this.loadServicePhone()
  },

  onShow() {
    // 每次显示页面时检查登录状态
    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLogin = api.checkLogin()
    this.setData({ isLogin })
    
    if (isLogin) {
      this.getUserInfo()
    }
  },

  // 获取用户信息
  async getUserInfo() {
    try {
      const result = await api.getUserInfo()
      if (result.success) {
        this.setData({
          userInfo: result.data,
          isLogin: true
        })
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      // 如果获取用户信息失败，可能是token过期，清除登录状态
      api.clearToken()
      this.setData({
        userInfo: null,
        isLogin: false
      })
    }
  },

  // 显示登录弹窗
  showLogin() {
    this.setData({
      showLoginModal: true
    })
  },

  // 关闭登录弹窗
  closeLoginModal() {
    this.setData({
      showLoginModal: false
    })
  },

  // 登录成功回调
  onLoginSuccess() {
    this.setData({
      showLoginModal: false,
      isLogin: true
    })
    this.getUserInfo()
  },

  // 登出
  async logout() {
    try {
      await api.logout()
      api.clearToken()
      this.setData({
        userInfo: null,
        isLogin: false
      })
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      })
    } catch (error) {
      console.error('登出失败:', error)
    }
  },

  // 跳转到日志页面
  bindViewTap() {
    if (!this.data.isLogin) {
      this.showLogin()
      return
    }
    wx.navigateTo({
      url: '../logs/logs'
    })
  },

  // 微信登录
  wechatLogin() {
    // 实现微信登录逻辑
    console.log('微信登录')
    this.closeLoginModal()
  },

  // 跳转到手机号登录页面
  goToPhoneLogin() {
    this.closeLoginModal()
    wx.navigateTo({
      url: '../login/login'
    })
  },

  // 跳转到充值页面
  goToRecharge() {
    wx.navigateTo({
      url: '/pages/recharge/recharge'
    })
  },

  // 进入取快递占位页
  goToPickup() {
    wx.navigateTo({
      url: '/pages/pickup/index'
    })
  },

  // 进入上门回收页面
  goToRecycle() {
    wx.navigateTo({
      url: '/pages/recycle/index'
    })
  },

  // 跳转到卡券
  goToCoupon() {
    wx.navigateTo({
      url: '/pages/coupon/index'
    })
  },

  // 跳转到个人中心
  goToProfile() {
    if (!this.data.isLogin) {
      this.showLogin()
      return
    }
    wx.switchTab({
      url: '/pages/profile/index'
    })
  },

  // 小卡片点击事件
  onSmallCardTap(e) {
    const type = e.currentTarget.dataset.type
    wx.showToast({
      title: '暂未开放',
      icon: 'none',
      duration: 2000
    })
  },

  // 获取客服电话
  async loadServicePhone() {
    try {
      const res = await api.getPublicConfigs()
      if (res && res.success && res.data) {
        const phone = res.data.customer_service_phone
        if (phone) {
          this.setData({ servicePhone: phone })
        }
      }
    } catch (e) {
      console.error('获取客服电话失败:', e)
    }
  },

  // 跳转到服务点地图页面
  goToServicePoint() {
    wx.navigateTo({
      url: '/pages/placeholder/index'
    })
  },

  // 分享给好友
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    const sharePath = app.getSharePath()
    const shareConfig = {
      title: '喵到家 - 便捷的生活服务小程序',
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

})
