// index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    userInfo: null,
    isLogin: false,
    showLoginModal: false,
    // 活动入口配置
    activityConfig: {
      iconUrl: '/assets/tabbar/现金.png', // 默认图标
      descriptions: ['邀请奖励', '拉新得现金'], // 默认描述
      linkUrl: '', // 活动链接
      title: '活动' // 默认标题
    },
    showActivityCard: false, // 是否显示活动卡片
    // 公告相关
    showAnnouncementModal: false,
    announcementData: null,
    hideTodayChecked: false,
    isRequestingNextAnnouncement: false, // 是否正在请求下一个公告，防止重复请求
    isCloseBtnLoading: false // 关闭按钮是否正在加载
  },

  onLoad(options) {
    // 检查是否有邀请码参数
    if (options && options.referralCode) {
      // 保存邀请码到本地存储，用于注册时使用
      wx.setStorageSync('pendingReferralCode', options.referralCode)
    }
    
    this.checkLoginStatus()
    this.loadActivityConfig()
    // 检查是否需要显示公告（仅在首次进入小程序时）
    this.checkAndShowAnnouncement()
  },

  onShow() {
    // 每次显示页面时检查登录状态
    const wasLogin = this.data.isLogin
    this.checkLoginStatus()
    
    // 如果从未登录变为已登录，且还没有显示过登录后的公告，则显示公告
    const isLogin = api.checkLogin()
    if (!wasLogin && isLogin) {
      // 检查是否已经显示过登录后的公告（本次小程序启动周期内）
      const hasShownAfterLogin = wx.getStorageSync('announcement_shown_after_login')
      if (!hasShownAfterLogin) {
        // 标记已显示，然后显示公告
        wx.setStorageSync('announcement_shown_after_login', true)
        this.showAnnouncementAfterLogin()
      }
    }
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

  // 快捷登录
  wechatLogin() {
    // 实现快捷登录逻辑
    console.log('快捷登录')
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
    if (type === 'withdraw') {
      // 提现教程
      this.goToWithdrawGuide()
    } else if (type === 'service') {
      // 服务介绍
      this.goToServiceIntro()
    } else {
      wx.showToast({
        title: '暂未开放',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 跳转到回收分类科普
  goToRecycleGuide() {
    wx.navigateTo({
      url: '/pages/image-content/index?type=recycle-guide'
    })
  },

  // 跳转到提现教程
  goToWithdrawGuide() {
    wx.navigateTo({
      url: '/pages/image-content/index?type=withdraw-guide'
    })
  },

  // 跳转到服务介绍
  goToServiceIntro() {
    wx.navigateTo({
      url: '/pages/image-content/index?type=service-intro'
    })
  },

  // 加载活动配置
  async loadActivityConfig() {
    try {
      const activityConfig = {
        iconUrl: '/assets/tabbar/现金.png', // 默认图标
        descriptions: ['邀请奖励', '拉新得现金'], // 默认描述
        linkUrl: '', // 活动链接
        title: '活动' // 默认标题
      }
      
      // 获取活动图标
      try {
        const iconResult = await api.getConfigValue('activity_entry_icon')
        if (iconResult.success && iconResult.data) {
          activityConfig.iconUrl = iconResult.data
        }
      } catch (e) {
        console.warn('获取活动图标配置失败:', e)
      }
      
      // 获取活动描述（JSON数组）
      try {
        const descResult = await api.getConfigValue('activity_entry_descriptions')
        if (descResult.success && descResult.data) {
          try {
            const descList = JSON.parse(descResult.data)
            if (Array.isArray(descList) && descList.length > 0) {
              activityConfig.descriptions = descList
            }
          } catch (e) {
            console.warn('解析活动描述失败:', e)
          }
        }
      } catch (e) {
        console.warn('获取活动描述配置失败:', e)
      }
      
      // 获取活动链接
      try {
        const linkResult = await api.getConfigValue('activity_entry_link')
        if (linkResult.success && linkResult.data) {
          activityConfig.linkUrl = linkResult.data
        }
      } catch (e) {
        console.warn('获取活动链接配置失败:', e)
      }
      
      // 获取活动标题
      try {
        const titleResult = await api.getConfigValue('activity_entry_title')
        if (titleResult.success && titleResult.data) {
          activityConfig.title = titleResult.data
        }
      } catch (e) {
        console.warn('获取活动标题配置失败:', e)
      }
      
      // 只有当配置了链接时才显示活动卡片
      this.setData({
        activityConfig: activityConfig,
        showActivityCard: !!activityConfig.linkUrl && activityConfig.linkUrl.trim() !== ''
      })
    } catch (error) {
      console.error('加载活动配置失败:', error)
      // 如果配置加载失败，不显示活动卡片
      this.setData({
        showActivityCard: false
      })
    }
  },

  // 跳转到活动页面
  goToActivity() {
    const { linkUrl, title } = this.data.activityConfig
    if (!linkUrl) {
      wx.showToast({
        title: '活动链接未配置',
        icon: 'none'
      })
      return
    }
    
    // 获取用户ID，拼接到活动链接后面
    let finalUrl = linkUrl
    const userInfo = this.data.userInfo
    if (userInfo && userInfo.id) {
      // 处理URL中的hash（#）部分，确保查询参数在hash之前
      let urlWithoutHash = linkUrl
      let hash = ''
      const hashIndex = linkUrl.indexOf('#')
      if (hashIndex !== -1) {
        urlWithoutHash = linkUrl.substring(0, hashIndex)
        hash = linkUrl.substring(hashIndex)
      }
      
      // 判断URL是否已有查询参数
      const separator = urlWithoutHash.includes('?') ? '&' : '?'
      finalUrl = `${urlWithoutHash}${separator}userid=${userInfo.id}${hash}`
    }
    
    // 跳转到活动页面，传递URL和title参数
    let navigateUrl = `/pages/activity/index?url=${encodeURIComponent(finalUrl)}`
    if (title) {
      navigateUrl += `&title=${encodeURIComponent(title)}`
    }
    wx.navigateTo({
      url: navigateUrl
    })
  },

  // 跳转到邀请奖励（保留作为备用）
  goToInviteReward() {
    // 如果配置了活动链接，跳转到活动页面；否则跳转到原来的邀请奖励页面
    const { linkUrl } = this.data.activityConfig
    if (linkUrl) {
      this.goToActivity()
    } else {
      wx.navigateTo({
        url: '/pages/image-content/index?type=invite-reward'
      })
    }
  },

  // 跳转到服务点地图页面
  goToServicePoint() {
    wx.navigateTo({
      url: '/pages/service-point/index'
    })
  },

  // 分享给好友
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    const sharePath = app.getSharePath()
    const shareTitle = app.getShareTitle()
    const shareConfig = {
      title: shareTitle, // 使用配置的分享标题
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

  // ========== 公告相关方法 ==========
  
  /**
   * 检查是否需要显示公告（仅在首次进入小程序时）
   */
  async checkAndShowAnnouncement() {
    try {
      const app = getApp()
      
      // 检查是否是首次启动
      if (!app.globalData.isFirstLaunch) {
        // 不是首次启动，不显示公告
        return
      }

      // 清除首次启动标记（只检查一次）
      app.globalData.isFirstLaunch = false

      // 获取当前公告（优先级最高的一个，未登录用户也可以查看全部用户类型的公告）
      const result = await api.getCurrentAnnouncement()
      
      if (result.success && result.data) {
        // 显示公告
        this.setData({
          showAnnouncementModal: true,
          announcementData: result.data,
          hideTodayChecked: false // 重置单选框状态
        })
      }
    } catch (error) {
      console.error('检查公告失败:', error)
      // 静默失败，不影响其他功能
    }
  },

  /**
   * 登录后显示公告（登录后第一次到主页时）
   */
  async showAnnouncementAfterLogin() {
    try {
      // 获取当前公告（优先级最高的一个，登录用户可以看到全部用户类型和指定用户类型的公告）
      const result = await api.getCurrentAnnouncement()
      
      if (result.success && result.data) {
        // 显示公告
        this.setData({
          showAnnouncementModal: true,
          announcementData: result.data,
          hideTodayChecked: false // 重置单选框状态
        })
      }
    } catch (error) {
      console.error('登录后显示公告失败:', error)
      // 静默失败，不影响其他功能
    }
  },

  /**
   * 关闭公告弹窗
   */
  async closeAnnouncementModal(e) {
    // 防止重复点击
    if (this.data.isRequestingNextAnnouncement) {
      return
    }

    // 如果点击的是背景（不是关闭按钮），直接关闭弹窗，不获取下一个
    if (e && e.target && e.target.id === 'announcement-modal') {
      this.setData({
        showAnnouncementModal: false,
        announcementData: null,
        hideTodayChecked: false
      })
      return
    }

    const currentAnnouncement = this.data.announcementData
    if (!currentAnnouncement) {
      return
    }

    const currentPriority = currentAnnouncement.priority
    const currentAnnouncementId = currentAnnouncement.id
    const hideToday = this.data.hideTodayChecked
    
    // 设置关闭按钮加载状态
    this.setData({
      isCloseBtnLoading: true
    })
    
    // 请求下一个公告（带上当前优先级和是否隐藏当前公告的标识）
    await this.getNextAnnouncement(currentPriority, currentAnnouncementId, hideToday)
    
    // 清除关闭按钮加载状态
    this.setData({
      isCloseBtnLoading: false
    })
  },

  /**
   * 单选框变化事件
   */
  onHideCheckboxChange(e) {
    const checked = e.detail.value.includes('hide')
    this.setData({
      hideTodayChecked: checked
    })
  },

  /**
   * 阻止事件冒泡（防止点击弹窗内容区域触发关闭弹窗）
   */
  stopPropagation(e) {
    // 阻止事件冒泡，防止触发父元素的closeAnnouncementModal
    if (e) {
      e.stopPropagation && e.stopPropagation()
    }
  },

  /**
   * 获取下一个公告
   */
  async getNextAnnouncement(currentPriority, currentAnnouncementId, hideToday = false) {
    // 防止重复请求
    if (this.data.isRequestingNextAnnouncement) {
      return
    }

    // 设置请求中状态
    this.setData({
      isRequestingNextAnnouncement: true
    })

    try {
      // 请求下一个公告（带上当前优先级和是否隐藏当前公告的标识）
      const result = await api.getNextAnnouncement(currentPriority, currentAnnouncementId, hideToday)
      
      if (result.success && result.data) {
        // 有下一个公告，显示它
        this.setData({
          announcementData: result.data,
          hideTodayChecked: false, // 重置单选框状态
          isRequestingNextAnnouncement: false,
          isCloseBtnLoading: false
        })
        
        if (hideToday) {
          wx.showToast({
            title: '已隐藏',
            icon: 'success',
            duration: 1500
          })
        }
      } else {
        // 没有下一个公告了，关闭弹窗
        this.setData({
          showAnnouncementModal: false,
          announcementData: null,
          hideTodayChecked: false,
          isRequestingNextAnnouncement: false,
          isCloseBtnLoading: false
        })
        
        if (hideToday) {
          wx.showToast({
            title: '已隐藏',
            icon: 'success',
            duration: 1500
          })
        }
      }
    } catch (error) {
      console.error('获取下一个公告失败:', error)
      // 即使失败也关闭弹窗
      this.setData({
        showAnnouncementModal: false,
        announcementData: null,
        hideTodayChecked: false,
        isRequestingNextAnnouncement: false,
        isCloseBtnLoading: false
      })
    }
  },

  /**
   * 点击公告内容（跳转）
   */
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
      // jumpValue格式：/pages/xxx/xxx
      try {
        wx.navigateTo({
          url: jumpValue,
          fail: (err) => {
            console.error('页面跳转失败:', err)
            // 如果navigateTo失败，尝试switchTab
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
        console.error('跳转异常:', e)
      }
    } else if (jumpType === 2 && jumpValue) {
      // 外部链接跳转
      // 跳转到活动页面（使用web-view）
      wx.navigateTo({
        url: `/pages/activity/index?url=${encodeURIComponent(jumpValue)}`
      })
    }
  }

})
