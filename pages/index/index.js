// index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    isLogin: false,
    showLoginModal: false
  },

  onLoad() {
    this.checkLoginStatus()
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

  // 进入上门回收占位页
  goToRecycle() {
    wx.navigateTo({
      url: '/pages/recycle/index'
    })
  },

  // 跳转到地址管理
  goToAddress() {
    wx.navigateTo({
      url: '/pages/address/index'
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
  }
})
