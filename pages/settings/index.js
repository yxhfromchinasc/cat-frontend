// pages/settings/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    isLogin: false,
    appVersion: '1.0.0', // 小程序版本号
    // 公告相关
    showAnnouncementModal: false,
    announcementData: null,
    isRequestingNextAnnouncement: false,
    isCloseBtnLoading: false
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
            console.error('退出登录失败')
            wx.showToast({ title: '退出失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 打开消息设置
  openMessageSetting() {
    wx.openSetting({
      success: (res) => {
      },
      fail: (err) => {
        console.error('[设置] 打开设置页面失败')
        wx.showToast({
          title: '打开设置失败',
          icon: 'none'
        })
      }
    })
  },

  // 展示公告（忽略隐藏限制）
  async showAnnouncements() {
    if (!this.data.isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    try {
      // 获取第一个公告（忽略隐藏限制）
      const result = await api.getCurrentAnnouncementIgnoreHide()
      
      if (result.success && result.data) {
        // 显示公告弹窗
        this.setData({
          showAnnouncementModal: true,
          announcementData: result.data
        })
      } else {
        wx.showToast({
          title: '暂无公告',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('获取公告失败')
      wx.showToast({
        title: '获取公告失败',
        icon: 'none'
      })
    }
  },

  // 关闭公告弹窗
  async closeAnnouncementModal(e) {
    // 防止重复点击
    if (this.data.isRequestingNextAnnouncement) {
      return
    }

    // 如果点击的是背景（不是关闭按钮），直接关闭弹窗，不获取下一个
    if (e && e.target && e.target.id === 'announcement-modal') {
      this.setData({
        showAnnouncementModal: false,
        announcementData: null
      })
      return
    }

    const currentAnnouncement = this.data.announcementData
    if (!currentAnnouncement) {
      return
    }

    const currentPriority = currentAnnouncement.priority
    
    // 设置关闭按钮加载状态
    this.setData({
      isCloseBtnLoading: true
    })
    
    // 请求下一个公告（忽略隐藏限制，不隐藏当前公告）
    await this.getNextAnnouncement(currentPriority)
    
    // 清除关闭按钮加载状态
    this.setData({
      isCloseBtnLoading: false
    })
  },

  // 获取下一个公告（忽略隐藏限制）
  async getNextAnnouncement(currentPriority) {
    // 防止重复请求
    if (this.data.isRequestingNextAnnouncement) {
      return
    }

    // 设置请求中状态
    this.setData({
      isRequestingNextAnnouncement: true
    })

    try {
      // 请求下一个公告（忽略隐藏限制）
      const result = await api.getNextAnnouncementIgnoreHide(currentPriority)
      
      if (result.success && result.data) {
        // 有下一个公告，显示它
        this.setData({
          announcementData: result.data,
          isRequestingNextAnnouncement: false,
          isCloseBtnLoading: false
        })
      } else {
        // 没有下一个公告了，关闭弹窗
        this.setData({
          showAnnouncementModal: false,
          announcementData: null,
          isRequestingNextAnnouncement: false,
          isCloseBtnLoading: false
        })
      }
    } catch (error) {
      console.error('获取下一个公告失败')
      // 即使失败也关闭弹窗
      this.setData({
        showAnnouncementModal: false,
        announcementData: null,
        isRequestingNextAnnouncement: false,
        isCloseBtnLoading: false
      })
    }
  },

  // 阻止事件冒泡
  stopPropagation(e) {
    if (e) {
      e.stopPropagation && e.stopPropagation()
    }
  },

  // 点击公告内容（跳转）
  async onAnnouncementTap() {
    const announcement = this.data.announcementData
    if (!announcement) {
      return
    }

    const jumpType = announcement.jumpType
    const jumpValue = announcement.jumpValue

    // 关闭弹窗并获取下一个公告
    await this.closeAnnouncementModal()

    // 根据跳转类型处理
    if (jumpType === 1 && jumpValue) {
      // 小程序页面跳转
      try {
        wx.navigateTo({
          url: jumpValue,
          fail: (err) => {
            console.error('页面跳转失败')
            wx.switchTab({
              url: jumpValue,
              fail: () => {
                wx.showToast({
                  title: '页面不存在',
                  icon: 'none'
                })
              }
            })
          }
        })
      } catch (e) {
        console.error('跳转异常')
      }
    } else if (jumpType === 2 && jumpValue) {
      // 外部链接跳转
      wx.navigateTo({
        url: `/pages/activity/index?url=${encodeURIComponent(jumpValue)}`
      })
    }
  }
})
