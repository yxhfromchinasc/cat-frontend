// activity/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    activityUrl: '',
    activityTitle: '活动' // 默认标题
  },

  async onLoad(options) {
    // 加载活动标题配置
    await this.loadActivityTitle()
    
    // 从页面参数获取活动链接
    if (options.url) {
      const decodedUrl = decodeURIComponent(options.url)
      this.setData({
        activityUrl: decodedUrl
      })
    } else {
      wx.showToast({
        title: '活动链接无效',
        icon: 'none'
      })
      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 加载活动标题配置
  async loadActivityTitle() {
    try {
      const result = await api.getConfigValue('activity_entry_title')
      if (result.success && result.data && result.data.trim()) {
        const title = result.data.trim()
        this.setData({
          activityTitle: title
        })
        // 动态设置导航栏标题
        wx.setNavigationBarTitle({
          title: title
        })
      }
    } catch (error) {
      console.warn('加载活动标题配置失败，使用默认标题:', error)
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.activityTitle,
      path: `/pages/activity/index?url=${encodeURIComponent(this.data.activityUrl)}`
    }
  }
})

