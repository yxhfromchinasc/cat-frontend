// app.js
const { api } = require('./utils/util.js')

App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })

    // 加载分享配置
    this.loadShareConfig()
  },
  globalData: {
    userInfo: null,
    shareImageUrl: '', // 分享图片URL
    sharePath: '/pages/index/index' // 分享后进入的页面路径，默认首页
  },
  // 加载分享配置（图片和路径）
  async loadShareConfig() {
    // 并行加载分享图片和分享路径
    await Promise.all([
      this.loadShareImage(),
      this.loadSharePath()
    ])
  },
  // 加载分享图片配置
  async loadShareImage() {
    try {
      const res = await api.getShareImage()
      if (res && res.success && res.data) {
        const url = res.data || ''
        // 只有当URL不为空且是有效URL时才设置
        if (url && url.trim() !== '') {
          this.globalData.shareImageUrl = url.trim()
        } else {
          this.globalData.shareImageUrl = ''
        }
      } else {
        this.globalData.shareImageUrl = ''
      }
    } catch (e) {
      console.error('加载分享图片配置失败:', e)
      this.globalData.shareImageUrl = ''
    }
  },
  // 加载分享路径配置
  async loadSharePath() {
    try {
      const res = await api.getSharePath()
      if (res && res.success && res.data) {
        const path = res.data || ''
        // 如果配置了路径且不为空，使用配置的路径；否则使用默认首页
        if (path && path.trim() !== '') {
          this.globalData.sharePath = path.trim()
        } else {
          this.globalData.sharePath = '/pages/index/index'
        }
      } else {
        this.globalData.sharePath = '/pages/index/index'
      }
    } catch (e) {
      console.error('加载分享路径配置失败:', e)
      this.globalData.sharePath = '/pages/index/index'
    }
  },
  // 获取分享图片URL（如果未配置或为空，返回null，不设置imageUrl）
  getShareImageUrl() {
    const url = this.globalData.shareImageUrl || ''
    // 只有当URL不为空且是有效URL时才返回
    return url && url.trim() !== '' ? url.trim() : null
  },
  // 获取分享路径（如果未配置或为空，返回默认首页）
  getSharePath() {
    const path = this.globalData.sharePath || '/pages/index/index'
    // 确保路径以 / 开头
    return path.trim() !== '' ? path.trim() : '/pages/index/index'
  }
})
