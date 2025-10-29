// index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    isLogin: false,
    showLoginModal: false,
    currentAddress: null // 当前显示的地址
  },

  onLoad() {
    this.checkLoginStatus()
  },

  onShow() {
    // 每次显示页面时检查登录状态
    this.checkLoginStatus()
    // 刷新地址信息
    if (this.data.isLogin) {
      this.loadCurrentAddress()
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLogin = api.checkLogin()
    this.setData({ isLogin })
    
    if (isLogin) {
      this.getUserInfo()
      this.loadCurrentAddress()
    } else {
      this.setData({ currentAddress: null })
    }
  },

  // 加载当前地址
  async loadCurrentAddress() {
    try {
      // 1. 先获取用户位置
      let userLocation = null
      try {
        userLocation = await this.getUserLocation()
      } catch (error) {
        console.log('获取用户位置失败:', error)
      }

      // 2. 调用后端接口获取最近的地址
      const result = await api.getNearestAddress(
        userLocation ? userLocation.latitude : null,
        userLocation ? userLocation.longitude : null
      )

      if (result.success && result.data) {
        this.setData({ currentAddress: result.data })
      } else {
        this.setData({ currentAddress: null })
      }

    } catch (error) {
      console.error('加载地址失败:', error)
      this.setData({ currentAddress: null })
    }
  },

  // 获取用户位置
  getUserLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02', // 返回可以用于微信地图的坐标类型
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude
          })
        },
        fail: (error) => {
          console.error('获取位置失败:', error)
          reject(error)
        }
      })
    })
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

  // 跳转到地址选择页面
  goToAddress() {
    const currentAddressId = this.data.currentAddress ? this.data.currentAddress.id : null
    wx.navigateTo({ 
      url: `/pages/address/select${currentAddressId ? `?currentAddressId=${currentAddressId}` : ''}` 
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
