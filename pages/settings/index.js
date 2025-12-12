// pages/settings/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    isLogin: false,
    appVersion: '1.0.0' // 小程序版本号
  },

  onLoad() {
    // 获取小程序版本号
    const accountInfo = wx.getAccountInfoSync()
    if (accountInfo && accountInfo.miniProgram) {
      this.setData({ appVersion: accountInfo.miniProgram.version || '1.0.0' })
    }
  },

  onShow() {
    // 每次进入页面都刷新登录状态
    const isLogin = api.checkLogin()
    this.setData({ isLogin })
  },

  // 关于我们
  goAbout() {
    wx.showModal({
      title: '关于我们',
      content: '喵上门\n一款便捷的生活服务小程序\n版本：' + this.data.appVersion,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 用户协议
  goUserAgreement() {
    wx.navigateTo({ url: '/pages/settings/user-agreement' })
  },

  // 隐私政策
  goPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/settings/privacy-policy' })
  },

  // 退出登录
  async logout() {
    if (!this.data.isLogin) {
      wx.showToast({ title: '未登录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.logout()
            wx.showToast({ 
              title: '已退出登录', 
              icon: 'success',
              duration: 2000
            })
            // 退出后返回上一页
            setTimeout(() => {
              wx.navigateBack()
            }, 2000)
          } catch (e) {
            console.error('退出登录失败:', e)
            wx.showToast({ title: '退出失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 处理打开设置按钮点击
  onOpenSetting(e) {
    console.log('[设置] 用户点击打开设置按钮')
    // openSetting 会打开小程序设置页面，用户可以在其中管理订阅消息
  }
})
