// pages/chat/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    conversationId: null,
    conversation: null,
    messageList: [],
    pageNum: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    
    // 当前用户头像
    currentUserAvatar: '/assets/tabbar/profile.png',
    
    // 输入框
    inputValue: '',
    inputHeight: 0,
    hasInput: false,  // 是否有输入内容（用于控制按钮显示）
    
    // 轮询相关
    pollTimer: null,  // 轮询定时器
    pollFirstTimer: null,  // 首次轮询延迟定时器（避免与初始加载重叠导致跳动）
    pollInterval: 5000,  // 轮询间隔（毫秒），5秒减少无谓更新与跳动
    lastMessageId: null,  // 最后一条消息的ID（用于增量获取）
    isPolling: false,  // 是否正在轮询中
    
    // 是否已滚动到底部（用于标记已读）
    isScrolledToBottom: false,
    
    // 滚动位置
    scrollTop: 0,
    scrollIntoView: '',
    
    // 是否正在发送消息
    sending: false,
    
    // 是否显示扩展工具栏
    showMoreTools: false,
    
    // 待发送的内容（从其他页面返回时使用）
    pendingImage: null,  // 待发送的图片路径
    pendingLocation: null,  // 待发送的位置信息
    
    // 图片预览弹窗
    showImagePreview: false,  // 是否显示图片预览弹窗
    previewImagePath: null,  // 预览的图片路径
    
    // 新消息提示
    newMessageCount: 0,  // 新消息数量（当不在底部时）
    showNewMessageTip: false,  // 是否显示新消息提示气泡
    
    // 标记已读防重复
    markReadInFlight: false,
    
    // 滚动区域高度
    scrollViewHeight: 0,
    
    // 进入会话时的初始化遮罩（会话详情+消息列表加载完成后关闭）
    initLoading: true,
    // 首屏加载完成时间戳，用于忽略首屏后误触的 scrolltolower（约 1.5s 内不加载更多）
    initLoadDoneAt: 0
  },

  onReady() {
    this.updateScrollViewHeight()
  },

  updateScrollViewHeight() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#message-list').boundingClientRect(rect => {
      if (rect) {
        this.setData({ scrollViewHeight: rect.height })
      }
    }).exec()
  },

  onLoad(options) {
    const conversationId = options.conversationId
    const orderNo = options.orderNo
    
    // 加载当前用户信息（用于显示头像）
    this.loadCurrentUserInfo()
    
    if (conversationId) {
      // 从会话列表进入
      this.setData({ conversationId: parseInt(conversationId) })
      this.loadConversationDetail()
    } else if (orderNo) {
      // 从订单详情页进入，需要先创建会话
      this.createConversationFromOrder(orderNo)
    } else {
      this.setData({ initLoading: false })
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  // 加载当前用户信息
  async loadCurrentUserInfo() {
    try {
      const res = await api.getUserInfo()
      if (res.success && res.data && res.data.avatarUrl) {
        this.setData({ currentUserAvatar: res.data.avatarUrl })
      }
    } catch (e) {
      console.error('加载用户信息失败:', e)
    }
  },

  onShow() {
    console.log('[Chat] onShow', { conversationId: this.data.conversationId, initLoading: this.data.initLoading })
    if (this.data.conversationId && !this.data.initLoading) {
      this.startPolling()
    }
    this.checkPendingContent()
  },

  onHide() {
    // 页面隐藏时停止轮询
    this.stopPolling()
  },

  onUnload() {
    // 页面卸载时停止轮询并清理状态
    this.setData({ conversationId: null })
    this.stopPolling()
  },

  // 从订单创建会话
  async createConversationFromOrder(orderNo) {
    try {
      wx.showLoading({ title: '创建会话中...' })
      const res = await api.createConversation(orderNo)
      wx.hideLoading()
      if (res.success && res.data) {
        this.setData({
          conversationId: res.data.id,
          conversation: res.data
        })
        this.loadConversationDetail()
      } else {
        this.setData({ initLoading: false })
        const msg = res.message || res.error || '创建会话失败'
        wx.showToast({ title: msg, icon: 'none', duration: 2000 })
        setTimeout(() => wx.navigateBack(), 2000)
      }
    } catch (e) {
      wx.hideLoading()
      this.setData({ initLoading: false })
      const msg = (e && (e.message || e.error)) || '创建会话失败'
      wx.showToast({ title: msg, icon: 'none', duration: 2000 })
      setTimeout(() => wx.navigateBack(), 2000)
    }
  },

  // 加载会话详情
  async loadConversationDetail() {
    console.log('[Chat] loadConversationDetail 开始', { conversationId: this.data.conversationId })
    try {
      const res = await api.getConversationDetail(this.data.conversationId)
      if (res.success && res.data) {
        this.setData({ conversation: res.data })
        this.setNavigationBarTitle()
        console.log('[Chat] loadConversationDetail 会话详情已拉取，即将 loadMessageList(true)')
        await this.loadMessageList(true)
        console.log('[Chat] loadConversationDetail 首屏消息已拉取，即将 startPolling')
        this.startPolling()
      } else {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
      }
    } catch (e) {
      console.error('加载会话详情失败:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ initLoading: false })
    }
  },

  // 跳转订单详情（用户端：根据订单类型跳转快递/回收详情）
  goToOrderDetail() {
    const conv = this.data.conversation
    if (!conv || !conv.orderNo) return
    const serviceType = conv.orderServiceType
    const path = serviceType === 3
      ? `/pages/recycling-detail/index?orderNo=${conv.orderNo}`
      : `/pages/express-detail/index?orderNo=${conv.orderNo}`
    wx.navigateTo({ url: path })
  },

  // 设置导航栏标题（对方昵称 + 订单号）
  setNavigationBarTitle() {
    if (this.data.conversation) {
      const name = (this.data.conversation.otherUser && this.data.conversation.otherUser.nickname)
        ? this.data.conversation.otherUser.nickname
        : '聊天'
      const orderNo = this.data.conversation.orderNo ? ' ' + this.data.conversation.orderNo : ''
      wx.setNavigationBarTitle({
        title: name + orderNo
      })
    }
  },

  // 加载消息列表
  async loadMessageList(reset = false) {
    console.log('[Chat] loadMessageList 入口', { reset, loading: this.data.loading, hasMore: this.data.hasMore, messageListLen: this.data.messageList.length })
    if (this.data.loading) {
      console.log('[Chat] loadMessageList 跳过: loading=true')
      return
    }
    if (!this.data.hasMore && !reset) {
      console.log('[Chat] loadMessageList 跳过: hasMore=false 且非 reset')
      return
    }
    const beforeMessageId = !reset && this.data.messageList.length ? this.data.messageList[0].id : null
    console.log('[Chat] loadMessageList 发起请求', { reset, beforeMessageId, conversationId: this.data.conversationId })
    this.setData({ loading: true }) // 立即加锁，防止 scrolltoupper 连续触发导致多次并发请求
    try {
      let oldScrollHeight = 0
      if (!reset) {
        oldScrollHeight = await new Promise(resolve => {
          wx.createSelectorQuery().in(this).select('#message-list').fields({ scrollHeight: true }, res => {
            resolve(res && res.scrollHeight !== undefined ? res.scrollHeight : 0)
          }).exec()
        })
      }

      const params = {
        conversationId: this.data.conversationId,
        pageNum: 1,
        pageSize: this.data.pageSize
      }
      if (beforeMessageId) params.beforeMessageId = beforeMessageId
      console.log('[Chat] loadMessageList 请求参数', params)
      const res = await api.getMessageList(params)
      console.log('[Chat] loadMessageList 原始响应', { success: res.success, hasData: !!res.data, listLen: res.data?.list?.length, total: res.data?.total, hasMore: res.data?.hasMore })

      if (res.success && res.data) {
        const newMessages = res.data.list || []
        const formattedMessages = newMessages.map(msg => this.formatMessage(msg))
        // 只有后端明确返回 true/false 时才用 hasMore；null/undefined 时首屏用 total>pageSize，加载更多用 false
        const hasMore = (res.data.hasMore === true || res.data.hasMore === false)
          ? res.data.hasMore
          : (reset && res.data.total != null ? res.data.total > this.data.pageSize : false)
        console.log('[Chat] loadMessageList 请求返回', { reset, beforeMessageId, listLen: newMessages.length, total: res.data.total, hasMore })
        if (reset) {
          // 重置列表
          const reversedMessages = formattedMessages.reverse()
          const lastMessage = reversedMessages[reversedMessages.length - 1]
          this.setData({
            messageList: reversedMessages, // 后端返回的是倒序，需要反转
            hasMore,
            loading: false,
            lastMessageId: lastMessage ? lastMessage.id : null,
            showNewMessageTip: false,
            newMessageCount: 0,
            initLoadDoneAt: Date.now()
          })
          // 滚动到底部（scrollToBottom 内已有 300ms 延迟，列表稳定后再滚）
          this.scrollToBottom()
          this.markAsRead()
        } else {
          // 加载更多（历史消息，游标分页）：按 id 去重，避免重复请求或后端重放导致 wx:key 重复
          const reversedNew = formattedMessages.reverse()
          const existingIds = new Set(this.data.messageList.map(m => m.id))
          const newOnly = reversedNew.filter(m => !existingIds.has(m.id))
          this.setData({
            messageList: [...newOnly, ...this.data.messageList],
            hasMore,
            loading: false
          }, () => {
            // 计算新增内容高度并调整 scrollTop，保持视觉位置不变
            if (oldScrollHeight > 0) {
              wx.createSelectorQuery().in(this).select('#message-list').fields({ scrollHeight: true }, res => {
                if (res && res.scrollHeight > oldScrollHeight) {
                  const jump = res.scrollHeight - oldScrollHeight
                  this.setData({ scrollTop: jump })
                }
              }).exec()
            }
          })
        }
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('加载消息列表失败:', e)
      this.setData({ loading: false })
    }
  },

  // 格式化消息
  formatMessage(msg) {
    return {
      ...msg,
      timeFormatted: this.formatTime(msg.createdAt),
      isMine: msg.senderType === 1, // 1-用户，2-小哥
      isRead: msg.isRead !== undefined ? msg.isRead : (msg.senderType === 1 ? false : true) // 自己发送的消息显示已读状态，对方发送的消息不显示
    }
  },

  // 格式化时间（用于消息下方显示）
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
    
    // 更早：显示日期 MM-dd HH:mm
    const month = String(msgTime.getMonth() + 1).padStart(2, '0')
    const day = String(msgTime.getDate()).padStart(2, '0')
    const hours = String(msgTime.getHours()).padStart(2, '0')
    const minutes = String(msgTime.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  },

  // 滚动到底部（延迟以等列表渲染稳定，减少跳动）
  scrollToBottom() {
    setTimeout(() => {
      this.setData({
        scrollTop: 99999,
        showNewMessageTip: false,
        newMessageCount: 0,
        isScrolledToBottom: true
      })
    }, 300)
  },
  
  // 点击新消息提示气泡
  onNewMessageTipTap() {
    this.scrollToBottom()
  },

  // 滚动事件（检测是否滚动到底部）
  onScroll(e) {
    const scrollTop = e.detail.scrollTop
    const scrollHeight = e.detail.scrollHeight
    const clientHeight = this.data.scrollViewHeight
    
    if (!clientHeight) return

    // 判断是否滚动到底部（距离底部50px内）
    if (scrollHeight - scrollTop - clientHeight < 50) {
      if (!this.data.isScrolledToBottom) {
        this.setData({ 
          isScrolledToBottom: true,
          showNewMessageTip: false,
          newMessageCount: 0
        })
        this.markAsRead()
      }
    } else {
      this.setData({ isScrolledToBottom: false })
    }
  },

  // 标记已读（防重复：同一时间只允许一次请求在途）
  async markAsRead() {
    if (!this.data.conversationId) return
    if (this.data.markReadInFlight) return
    
    this.setData({ markReadInFlight: true })
    try {
      await api.markAsRead(this.data.conversationId)
    } catch (e) {
      console.error('标记已读失败:', e)
    } finally {
      this.setData({ markReadInFlight: false })
    }
  },

  // 开始轮询（首次延迟执行，避免与初始加载、滚动重叠导致列表跳动）
  startPolling() {
    if (this.data.pollTimer) {
      console.log('[Chat] startPolling 跳过: 已有 pollTimer')
      return
    }
    if (!this.data.conversationId) return
    console.log('[Chat] startPolling 启动，首次 2s 后执行')
    const interval = this.data.pollInterval
    const firstDelay = 2000
    const firstTimer = setTimeout(() => {
      this.setData({ pollFirstTimer: null })
      console.log('[Chat] startPolling 首次轮询执行')
      this.pollNewMessages()
      const timer = setInterval(() => {
        this.pollNewMessages()
      }, interval)
      this.setData({ pollTimer: timer })
    }, firstDelay)
    this.setData({ pollFirstTimer: firstTimer })
  },

  // 停止轮询
  stopPolling() {
    if (this.data.pollFirstTimer) {
      clearTimeout(this.data.pollFirstTimer)
      this.setData({ pollFirstTimer: null })
    }
    if (this.data.pollTimer) {
      clearInterval(this.data.pollTimer)
      this.setData({ 
        pollTimer: null,
        isPolling: false
      })
    }
  },

  // 轮询获取新消息
  async pollNewMessages() {
    if (this.data.isPolling || this.data.loading) {
      console.log('[Chat] pollNewMessages 跳过', { isPolling: this.data.isPolling, loading: this.data.loading })
      return Promise.resolve()
    }
    if (!this.data.conversationId) {
      this.stopPolling()
      return Promise.resolve()
    }
    console.log('[Chat] pollNewMessages 开始，将调用 loadNewMessages(pageNum=1)')
    try {
      this.setData({ isPolling: true })
      if (this.data.isScrolledToBottom) {
        this.markAsRead()
      }
      const newMessages = await this.loadNewMessages()
      
      if (newMessages && newMessages.length > 0) {
        const currentList = this.data.messageList || []
        const existingIds = new Set(currentList.map(msg => msg.id))
        const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id))

        // 检查已读状态是否有变化（即使没有新消息，已读状态也可能变了）
        let hasReadStatusChanged = false
        const idToNewMsg = {}
        newMessages.forEach(m => { idToNewMsg[m.id] = m })
        
        // 遍历当前列表中的消息，如果新拉取的消息中有此ID，且已读状态不同，则标记为变化
        // 这里只检查最近 20 条（新拉取的那一页），之前的历史消息状态暂不更新，避免全量遍历
        for (let i = currentList.length - 1; i >= 0; i--) {
          const msg = currentList[i]
          const newMsg = idToNewMsg[msg.id]
          if (newMsg) {
             // 仅检查自己发送的消息的已读状态变化
             // 或者对方发送的消息，如果本地是未读，后端变成了已读（理论上不会发生，除非其他端读了）
             if (msg.isMine && msg.isRead !== newMsg.isRead) {
               hasReadStatusChanged = true
               break
             }
          } else {
            // currentList 是全量，newMessages 只有最新20条，
            // 所以遍历到不在 newMessages 里的旧消息时，说明已经超出范围，可以停止检查
            // 但考虑到乱序可能性（虽然id倒序），还是简单处理：
            // 如果连续多条都没在 newMessages 里，说明已经到了历史消息区域，停止
            if (currentList.length - i > 25) break 
          }
        }

        if (uniqueNewMessages.length > 0 || hasReadStatusChanged) {
          // 有新消息 或 已读状态有变化：合并列表并更新
          const mergedList = currentList.map(msg => {
            const newMsg = idToNewMsg[msg.id]
            if (newMsg && newMsg.isRead !== msg.isRead) return { ...msg, isRead: newMsg.isRead }
            return msg
          })
          const finalList = [...mergedList, ...uniqueNewMessages]
          const lastMessage = uniqueNewMessages.length > 0 ? uniqueNewMessages[uniqueNewMessages.length - 1] : (finalList.length > 0 ? finalList[finalList.length - 1] : null)
          
          this.setData({
            messageList: finalList,
            lastMessageId: lastMessage ? lastMessage.id : this.data.lastMessageId
          })
          
          if (uniqueNewMessages.length > 0) {
             if (this.data.isScrolledToBottom) {
               this.scrollToBottom()
               this.markAsRead()
               this.setData({ showNewMessageTip: false, newMessageCount: 0 })
             } else {
               const newCount = (this.data.newMessageCount || 0) + uniqueNewMessages.length
               this.setData({ showNewMessageTip: true, newMessageCount: newCount })
             }
          }
        }
      }
      
      // 返回 Promise，确保调用者可以等待完成
      return Promise.resolve()
    } catch (e) {
      console.error('轮询新消息失败:', e)
      // 轮询失败时不中断轮询，继续下一次轮询
      return Promise.resolve()
    } finally {
      this.setData({ isPolling: false })
    }
  },

  // 加载新消息（增量）
  async loadNewMessages() {
    console.log('[Chat] loadNewMessages 发起请求 pageNum=1 (轮询用)')
    try {
      const res = await api.getMessageList({
        conversationId: this.data.conversationId,
        pageNum: 1,  // 获取最新一页
        pageSize: 20
      })
      if (res.success && res.data) {
        console.log('[Chat] loadNewMessages 返回', { listLen: (res.data.list || []).length })
        const newMessages = res.data.list || []
        const formattedMessages = newMessages.map(msg => this.formatMessage(msg))
        
        // 后端返回的是倒序（最新的在前），需要反转
        return formattedMessages.reverse()
      }
      
      return []
    } catch (e) {
      console.error('加载新消息失败:', e)
      return []
    }
  },


  // 输入框内容变化
  onInput(e) {
    const value = e.detail.value || ''
    const hasInput = value.trim().length > 0
    this.setData({ 
      inputValue: value,
      hasInput: hasInput
    })
    // 输入内容时，如果有扩展工具栏打开，则关闭
    if (this.data.showMoreTools) {
      this.setData({ showMoreTools: false })
    }
  },

  // 切换扩展工具栏
  toggleMoreTools() {
    this.setData({ 
      showMoreTools: !this.data.showMoreTools 
    })
  },

  // 发送文本消息
  async sendTextMessage() {
    const content = this.data.inputValue.trim()
    if (!content) {
      return
    }
    
    if (this.data.sending) {
      return
    }
    
    // 检查会话是否已关闭
    if (this.data.conversation && this.data.conversation.isClosed === 1) {
      wx.showToast({ title: '订单已结束，无法发送消息', icon: 'none' })
      return
    }
    
    try {
      this.setData({ 
        sending: true, 
        inputValue: '',
        hasInput: false
      })
      
      const res = await api.sendMessage({
        conversationId: this.data.conversationId,
        messageType: 1, // 文本
        content: content
      })
      
      if (res.success && res.data) {
        // 发送成功后，立即刷新消息（不等待轮询）
        this.pollNewMessages().then(() => {
          // 消息加载完成后，滚动到底部
          setTimeout(() => {
            this.scrollToBottom()
          }, 200)
        }).catch(() => {
          // 即使失败也尝试滚动
          setTimeout(() => {
            this.scrollToBottom()
          }, 200)
        })
      } else {
        wx.showToast({ title: res.message || res.error || '发送失败', icon: 'none' })
        this.setData({ 
          inputValue: content,
          hasInput: content.trim().length > 0
        }) // 恢复输入内容
      }
    } catch (e) {
      const msg = (e && (e.message || e.error)) || '发送失败'
      wx.showToast({ title: msg, icon: 'none' })
      this.setData({ 
        inputValue: content,
        hasInput: content.trim().length > 0
      }) // 恢复输入内容
    } finally {
      this.setData({ sending: false })
    }
  },

  // 选择图片
  chooseImage() {
    // 检查会话是否已关闭
    if (this.data.conversation && this.data.conversation.isClosed === 1) {
      wx.showToast({ title: '订单已结束，无法发送消息', icon: 'none' })
      return
    }
    
    // 关闭扩展工具栏
    this.setData({ showMoreTools: false })
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // 选择图片后显示预览弹窗
        const imagePath = res.tempFilePaths[0]
        this.setData({
          showImagePreview: true,
          previewImagePath: imagePath
        })
      }
    })
  },
  
  // 关闭图片预览弹窗
  closeImagePreview() {
    this.setData({
      showImagePreview: false,
      previewImagePath: null
    })
  },
  
  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },
  
  // 确认发送图片
  confirmSendImage() {
    const imagePath = this.data.previewImagePath
    if (imagePath) {
      this.setData({
        showImagePreview: false,
        previewImagePath: null
      })
      this.uploadAndSendImage(imagePath)
    }
  },

  // 上传并发送图片
  async uploadAndSendImage(filePath) {
    try {
      wx.showLoading({ title: '发送中...' })
      
      // 上传图片
      const uploadRes = await api.uploadImage(filePath, 'chat')
      
      if (uploadRes.success && uploadRes.data) {
        // 发送图片消息
        const sendRes = await api.sendMessage({
          conversationId: this.data.conversationId,
          messageType: 2, // 图片
          imageUrl: uploadRes.data.url || uploadRes.data
        })
        
        wx.hideLoading()
        
        if (sendRes.success && sendRes.data) {
          // 发送成功后，立即刷新消息（不等待轮询）
          this.pollNewMessages().then(() => {
            // 消息加载完成后，滚动到底部
            setTimeout(() => {
              this.scrollToBottom()
            }, 200)
          }).catch(() => {
            // 即使失败也尝试滚动
            setTimeout(() => {
              this.scrollToBottom()
            }, 200)
          })
        } else {
          wx.showToast({ title: sendRes.message || sendRes.error || '发送失败', icon: 'none' })
        }
      } else {
        wx.hideLoading()
        wx.showToast({ title: uploadRes.message || uploadRes.error || '上传失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      const msg = (e && (e.message || e.error)) || '发送失败'
      wx.showToast({ title: msg, icon: 'none' })
    }
  },

  // 选择位置
  chooseLocation() {
    // 检查会话是否已关闭
    if (this.data.conversation && this.data.conversation.isClosed === 1) {
      wx.showToast({ title: '订单已结束，无法发送消息', icon: 'none' })
      return
    }
    
    // 关闭扩展工具栏
    this.setData({ showMoreTools: false })
    
    wx.chooseLocation({
      success: (res) => {
        // 选择位置后立即弹窗确认
        wx.showModal({
          title: '提示',
          content: `是否发送位置：${res.address || res.name}？`,
          confirmText: '发送',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              this.sendLocationMessage(res)
            }
          }
        })
      },
      fail: (err) => {
        if (err.errMsg.indexOf('auth deny') !== -1) {
          wx.showModal({
            title: '提示',
            content: '需要您授权位置信息才能发送位置',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
        }
      }
    })
  },

  // 发送位置消息
  async sendLocationMessage(location) {
    try {
      wx.showLoading({ title: '发送中...' })
      
      const res = await api.sendMessage({
        conversationId: this.data.conversationId,
        messageType: 3, // 位置
        locationLatitude: location.latitude,
        locationLongitude: location.longitude,
        locationAddress: location.address || location.name
      })
      
      wx.hideLoading()
      
      if (res.success && res.data) {
        // 发送成功后，立即刷新消息（不等待轮询）
        this.pollNewMessages().then(() => {
          // 消息加载完成后，滚动到底部
          setTimeout(() => {
            this.scrollToBottom()
          }, 200)
        }).catch(() => {
          // 即使失败也尝试滚动
          setTimeout(() => {
            this.scrollToBottom()
          }, 200)
        })
      } else {
        wx.showToast({ title: res.message || res.error || '发送失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      const msg = (e && (e.message || e.error)) || '发送失败'
      wx.showToast({ title: msg, icon: 'none' })
    }
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.messageList
      .filter(msg => msg.messageType === 2 && msg.imageUrl)
      .map(msg => msg.imageUrl)
    
    wx.previewImage({
      current: url,
      urls: urls
    })
  },

  // 打开位置地图
  openLocation(e) {
    const latitude = e.currentTarget.dataset.latitude
    const longitude = e.currentTarget.dataset.longitude
    const address = e.currentTarget.dataset.address
    
    wx.openLocation({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      name: address || '位置',
      fail: (err) => {
        console.error('打开地图失败:', err)
        wx.showToast({ title: '打开地图失败', icon: 'none' })
      }
    })
  },

  // 检查待发送的内容
  checkPendingContent() {
    // 检查是否有待发送的图片
    if (this.data.pendingImage) {
      wx.showModal({
        title: '提示',
        content: '是否发送这张图片？',
        confirmText: '发送',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            const imagePath = this.data.pendingImage
            this.setData({ pendingImage: null })
            this.uploadAndSendImage(imagePath)
          } else {
            // 取消发送，清除待发送内容
            this.setData({ pendingImage: null })
          }
        }
      })
      return
    }
    
    // 检查是否有待发送的位置
    if (this.data.pendingLocation) {
      wx.showModal({
        title: '提示',
        content: `是否发送位置：${this.data.pendingLocation.address || this.data.pendingLocation.name}？`,
        confirmText: '发送',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            const location = this.data.pendingLocation
            this.setData({ pendingLocation: null })
            this.sendLocationMessage(location)
          } else {
            // 取消发送，清除待发送内容
            this.setData({ pendingLocation: null })
          }
        }
      })
    }
  },

  // 加载更多历史消息（点击触发）
  loadMoreHistory() {
    if (this.data.loading || !this.data.hasMore) return
    this.loadMessageList(false)
  },

  // 滑到顶部时不再自动加载
  onReachTop() {
    // 已废弃，改为手动点击加载
  }
})