// pages/invite/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    referralCode: '',
    recordList: [],
    pageNum: 1,
    pageSize: 10,
    total: 0,
    hasMore: true,
    loading: false,
  },

  onLoad() {
    this.getMyReferralCode()
    this.loadRecords(true)
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadRecords(true)
  },

  // 获取我的邀请码
  async getMyReferralCode() {
    try {
      const res = await api.getMyReferralCode()
      if (res && res.success && res.data) {
        this.setData({
          referralCode: res.data.referralCode || ''
        })
      }
    } catch (e) {
      console.error('获取邀请码失败:', e)
    }
  },

  // 加载邀请记录
  async loadRecords(refresh = false) {
    if (this.data.loading) return

    // 如果是刷新，重置页码和数据
    if (refresh) {
      this.setData({
        pageNum: 1,
        recordList: [],
        hasMore: true
      })
    }

    // 如果没有更多数据，不加载
    if (!this.data.hasMore && !refresh) {
      return
    }

    try {
      this.setData({ loading: true })

      const res = await api.getReferralRecords({
        pageNum: this.data.pageNum,
        pageSize: this.data.pageSize
      })

      if (res && res.success && res.data) {
        const pageResult = res.data
        let records = []
        if (pageResult.list && Array.isArray(pageResult.list)) {
          records = pageResult.list
        } else if (Array.isArray(pageResult)) {
          records = pageResult
        }

        // 处理记录数据
        const formattedRecords = records.map(item => ({
          ...item,
          // 映射状态码到显示文本
          rewardStatusText: this.mapRewardStatus(item.rewardStatusCode)
        }))

        // 合并或替换记录
        const newRecords = refresh
          ? formattedRecords
          : [...this.data.recordList, ...formattedRecords]

        // 判断是否还有更多数据
        const total = pageResult.total || 0
        const loadedCount = newRecords.length
        const hasMore = loadedCount < total

        this.setData({
          recordList: newRecords,
          total: total,
          hasMore: hasMore,
          pageNum: refresh ? 2 : this.data.pageNum + 1,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('加载邀请记录失败:', e)
      this.setData({ loading: false })
    }
  },

  // 映射奖励状态
  mapRewardStatus(statusCode) {
    if (statusCode === 1 || statusCode === 2) {
      return '审核中'
    } else if (statusCode === 3) {
      return '已到账'
    } else {
      return '已取消'
    }
  },

  // 滚动到底部加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadRecords(false)
    }
  },

  // 复制邀请码
  copyReferralCode() {
    if (!this.data.referralCode) {
      wx.showToast({
        title: '邀请码获取中...',
        icon: 'none'
      })
      return
    }

    wx.setClipboardData({
      data: this.data.referralCode,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success'
        })
      }
    })
  },

  // 分享邀请
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    const shareTitle = app.getShareTitle()
    
    // 分享路径包含邀请码参数
    const sharePath = `/pages/index/index?referralCode=${this.data.referralCode}`
    
    const shareConfig = {
      title: shareTitle || '邀请好友注册，获得奖励',
      path: sharePath
    }
    
    // 只有在配置了有效的分享图片URL时才设置
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    
    return shareConfig
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '邀请好友注册，获得奖励',
      query: `referralCode=${this.data.referralCode}`
    }
  }
})
