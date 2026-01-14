// pages/invite/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    referralCode: '',
    inviteImageUrl: '',
    rewardAmount: '10.00', // 奖励金额，默认10.00
    recordList: [],
    pageNum: 1,
    pageSize: 10,
    total: 0,
    hasMore: true,
    loading: false,
    showShareMask: false, // 是否显示分享到朋友圈的遮罩
  },

  onLoad() {
    this.getMyReferralCode()
    this.getInviteImage()
    this.getRewardAmount()
    this.loadRecords(true)
    // 启用分享到朋友圈功能
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
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

  // 获取邀请图片
  async getInviteImage() {
    try {
      const res = await api.getConfigValue('referral_invite_image')
      if (res && res.success && res.data) {
        this.setData({
          inviteImageUrl: res.data || ''
        })
      }
    } catch (e) {
      console.error('获取邀请图片失败:', e)
    }
  },

  // 获取奖励金额
  async getRewardAmount() {
    try {
      const res = await api.getConfigValue('referral_registration_reward_amount')
      if (res && res.success && res.data) {
        this.setData({
          rewardAmount: res.data || '10.00'
        })
      }
    } catch (e) {
      console.error('获取奖励金额失败:', e)
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
          rewardStatusText: this.mapRewardStatus(item.rewardStatusCode),
          // 格式化金额（保留两位小数）
          rewardAmount: item.rewardAmount ? parseFloat(item.rewardAmount).toFixed(2) : null
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
    if (statusCode === 1) {
      return '等待首单完成'
    } else if (statusCode === 2) {
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


  // 分享邀请
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    
    // 分享路径直接跳转到登录页面，携带邀请码参数
    const sharePath = `/pages/login/login?referralCode=${this.data.referralCode}`
    
    const shareConfig = {
      title: '拉新返现啦！！！',
      path: sharePath
    }
    
    // 只有在配置了有效的分享图片URL时才设置
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    
    return shareConfig
  },

  // 分享到朋友圈按钮点击
  shareToMoments() {
    // 显示全屏遮罩提示
    this.setData({
      showShareMask: true
    })
  },

  // 关闭分享遮罩
  closeShareMask() {
    this.setData({
      showShareMask: false
    })
  },

  // 分享到朋友圈（通过右上角菜单触发）
  onShareTimeline() {
    return {
      title: '拉新返现啦！！！',
      query: `referralCode=${this.data.referralCode}`
    }
  }
})
