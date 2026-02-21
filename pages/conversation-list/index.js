// pages/conversation-list/index.js
const { api } = require('../../utils/util.js')
const constants = require('../../utils/constants.js')

const ORDER_STATUS = { IN_PROGRESS: 1, COMPLETED: 2 }

Page({
  data: {
    activeTab: 0,
    conversationList: [],
    loading: false,
    pollTimer: null,
    pollInterval: constants.POLL_INTERVAL_UNREAD_MESSAGES
  },

  onLoad() {
    this.loadConversationList()
  },

  onTabChange(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    if (this.data.activeTab === index) return
    this.setData({ activeTab: index, conversationList: [] })
    this.loadConversationList()
  },

  getOrderStatus() {
    return this.data.activeTab === 1 ? ORDER_STATUS.COMPLETED : ORDER_STATUS.IN_PROGRESS
  },

  onShow() {
    // 页面显示时刷新会话列表并开始轮询
    this.loadConversationList()
    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  // 加载会话列表
  async loadConversationList(silent = false) {
    try {
      if (!silent) {
        this.setData({ loading: true })
      }
      
      const res = await api.getConversationList({ orderStatus: this.getOrderStatus() })

      if (res.success && res.data) {
        // 格式化时间
        const list = res.data.map(item => {
          return {
            ...item,
            lastMessageTimeFormatted: this.formatTime(item.lastMessageTime),
            lastMessagePreview: this.getLastMessagePreview(item)
          }
        })
        
        this.setData({
          conversationList: list,
          loading: false
        })
      } else {
        this.setData({ loading: false })
        if (!silent) {
          wx.showToast({ title: res.message || '加载失败', icon: 'none' })
        }
      }
    } catch (e) {
      console.error('加载会话列表失败')
      this.setData({ loading: false })
      if (!silent) {
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    }
  },

  // 开始轮询
  startPolling() {
    if (this.data.pollTimer) return
    
    const timer = setInterval(() => {
      this.loadConversationList(true)
    }, this.data.pollInterval)
    
    this.setData({ pollTimer: timer })
  },

  // 停止轮询
  stopPolling() {
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer)
      this.setData({ pollTimer: null })
    }
  },

  // 格式化最后消息时间
  formatTime(timeStr) {
    if (!timeStr) return ''
    
    const now = new Date()
    const msgTime = new Date(timeStr)
    const diff = now - msgTime
    
    // 今天：显示时间 HH:mm
    if (diff < 24 * 60 * 60 * 1000 && now.getDate() === msgTime.getDate()) {
      const hours = String(msgTime.getHours()).padStart(2, '0')
      const minutes = String(msgTime.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    
    // 昨天：显示"昨天 HH:mm"
    if (diff < 48 * 60 * 60 * 1000 && now.getDate() - msgTime.getDate() === 1) {
      const hours = String(msgTime.getHours()).padStart(2, '0')
      const minutes = String(msgTime.getMinutes()).padStart(2, '0')
      return `昨天 ${hours}:${minutes}`
    }
    
    // 本周：显示"周X HH:mm"
    const weekDiff = Math.floor(diff / (7 * 24 * 60 * 60 * 1000))
    if (weekDiff === 0) {
      const weekDays = ['日', '一', '二', '三', '四', '五', '六']
      const hours = String(msgTime.getHours()).padStart(2, '0')
      const minutes = String(msgTime.getMinutes()).padStart(2, '0')
      return `周${weekDays[msgTime.getDay()]} ${hours}:${minutes}`
    }
    
    // 更早：显示日期 MM-dd HH:mm
    const month = String(msgTime.getMonth() + 1).padStart(2, '0')
    const day = String(msgTime.getDate()).padStart(2, '0')
    const hours = String(msgTime.getHours()).padStart(2, '0')
    const minutes = String(msgTime.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  },

  // 获取最后消息预览
  getLastMessagePreview(item) {
    if (!item.lastMessageContent) return ''
    
    const messageType = item.lastMessageType
    if (messageType === 1) {
      // 文本消息
      return item.lastMessageContent
    } else if (messageType === 2) {
      // 图片消息
      return '[图片]'
    } else if (messageType === 3) {
      // 位置消息
      return '[位置]'
    }
    
    return ''
  },

  // 点击会话项
  onConversationTap(e) {
    const conversationId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/chat/index?conversationId=${conversationId}`
    })
  }
})
