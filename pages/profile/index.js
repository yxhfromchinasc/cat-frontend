// pages/profile/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    isLogin: false
  },

  onShow(){
    const isLogin = api.checkLogin()
    this.setData({ isLogin })
    if (isLogin) {
      this.loadUserInfo()
    }
  },

  async loadUserInfo(){
    try {
      const res = await api.getUserInfo()
      if (res && res.success) {
        this.setData({ userInfo: res.data, isLogin: true })
      }
    } catch (e) {
      api.clearToken()
      this.setData({ userInfo: null, isLogin: false })
    }
  },

  goLogin(){ wx.navigateTo({ url: '/pages/login/login' }) },
  goOrders(){ wx.switchTab({ url: '/pages/orders/index' }) },
  goRecharge(){ wx.navigateTo({ url: '/pages/recharge/recharge' }) },
  goBindPhone(){ wx.navigateTo({ url: '/pages/bind-phone/bind-phone' }) },
  goWallet(){ wx.navigateTo({ url: '/pages/wallet/index' }) },

  // 地址管理已实现
  goAddress(){ wx.navigateTo({ url: '/pages/address/index' }) },
  goCouponCenter(){ wx.navigateTo({ url: '/pages/placeholder/index' }) },
  goMyCoupons(){ wx.navigateTo({ url: '/pages/placeholder/index' }) },
  goFeedback(){ wx.navigateTo({ url: '/pages/placeholder/index' }) },
  goService(){ wx.navigateTo({ url: '/pages/placeholder/index' }) },
  goInvite(){ wx.navigateTo({ url: '/pages/placeholder/index' }) },
  goSettings(){ wx.navigateTo({ url: '/pages/placeholder/index' }) }
})
