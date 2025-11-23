// pages/profile/index.js
const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')

Page({
  data: {
    userInfo: null,
    isLogin: false,
    balance: 0, // 钱包余额
    balanceStr: '0.00', // 钱包余额格式化字符串
    couponCount: 0, // 卡券数量
    addressCount: 0, // 地址数量
    avatarSrc: '/assets/tabbar/profile.png', // 头像地址
    addressIcon: '' // 地址图标 SVG data URI
  },

  onLoad() {
    // 将地址 SVG 转换为 data URI
    const addressSvg = encodeURIComponent(`
      <svg t="1763878411962" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <path d="M700.8 944C571.2 944 464 836.8 464 707.2c0-129.6 107.2-236.8 236.8-236.8 129.6 0 236.8 107.2 236.8 236.8C939.2 836.8 832 944 700.8 944z" fill="#00ccb5"></path>
        <path d="M732.8 825.6H224c-68.8 0-123.2-40-123.2-89.6v-4.8l16-75.2c3.2-11.2 16-19.2 27.2-16 12.8 3.2 19.2 14.4 17.6 27.2l-16 72c1.6 20.8 33.6 43.2 76.8 43.2h510.4c44.8 0 75.2-22.4 76.8-43.2l-16-76.8c-3.2-12.8 4.8-24 17.6-25.6 12.8-1.6 24 4.8 25.6 17.6l16 80v4.8c3.2 46.4-51.2 86.4-120 86.4z" fill="#2c2c2c"></path>
        <path d="M472 814.4c-6.4 0-11.2-1.6-16-6.4-11.2-11.2-254.4-259.2-254.4-408 0-33.6 6.4-67.2 17.6-99.2 4.8-11.2 17.6-17.6 28.8-12.8 11.2 4.8 17.6 17.6 12.8 28.8-9.6 27.2-14.4 54.4-14.4 83.2 0 100.8 150.4 281.6 225.6 360 80-78.4 241.6-259.2 241.6-360 0-129.6-104-233.6-233.6-233.6-30.4 0-60.8 6.4-89.6 17.6-4.8 1.6-11.2 4.8-16 6.4-11.2 6.4-24 1.6-30.4-9.6-4.8-11.2-1.6-24 9.6-30.4 6.4-3.2 12.8-6.4 19.2-8 33.6-14.4 68.8-20.8 107.2-20.8 153.6 0 278.4 124.8 278.4 278.4 0 148.8-259.2 398.4-270.4 408-6.4 4.8-11.2 6.4-16 6.4z" fill="#2c2c2c"></path>
        <path d="M264 283.2c-4.8 0-8-1.6-12.8-3.2-9.6-6.4-12.8-20.8-6.4-30.4 11.2-17.6 25.6-33.6 41.6-49.6 9.6-8 22.4-8 32 0 8 9.6 8 22.4 0 32-12.8 12.8-24 25.6-33.6 41.6-4.8 4.8-12.8 9.6-20.8 9.6zM480 494.4c-60.8 0-110.4-49.6-110.4-110.4s49.6-110.4 110.4-110.4 110.4 49.6 110.4 110.4-49.6 110.4-110.4 110.4z m0-176c-36.8 0-65.6 28.8-65.6 65.6s28.8 65.6 65.6 65.6 65.6-28.8 65.6-65.6-30.4-65.6-65.6-65.6zM824 164.8H768c-9.6 0-16-6.4-16-16s6.4-16 16-16h56c9.6 0 16 6.4 16 16s-6.4 16-16 16z" fill="#2c2c2c"></path>
        <path d="M796.8 192c-9.6 0-16-6.4-16-16V120c0-9.6 6.4-16 16-16s16 6.4 16 16V176c0 9.6-8 16-16 16z" fill="#103E26"></path>
      </svg>
    `)
    this.setData({ 
      addressIcon: `data:image/svg+xml;charset=UTF-8,${addressSvg}` 
    })
  },

  onShow(){
    // 每次进入页面都刷新数据
    const isLogin = api.checkLogin()
    this.setData({ isLogin })
    if (isLogin) {
      // 刷新用户信息和统计数据
      this.loadUserInfo()
      this.loadStats() // 加载统计数据（余额、卡券、地址）
    } else {
      // 未登录时重置为0
      this.setData({
        userInfo: null,
        balance: 0,
        couponCount: 0,
        addressCount: 0
      })
    }
  },

  async loadUserInfo(){
    try {
      const res = await api.getUserInfo()
      if (res && res.success) {
        this.setData({ 
          userInfo: res.data, 
          isLogin: true 
        })
        // 更新头像显示
        this.updateAvatarSrc()
      } else {
        // 如果接口返回失败，清除登录状态
        this.setData({ 
          userInfo: null, 
          isLogin: false,
          balance: 0,
          couponCount: 0,
          addressCount: 0,
          avatarSrc: '/assets/tabbar/profile.png'
        })
      }
    } catch (e) {
      console.error('加载用户信息失败:', e)
      api.clearToken()
      this.setData({ 
        userInfo: null, 
        isLogin: false,
        balance: 0,
        couponCount: 0,
        addressCount: 0,
        avatarSrc: '/assets/tabbar/profile.png'
      })
    }
  },

  // 更新头像显示
  updateAvatarSrc() {
    const userInfo = this.data.userInfo
    if (userInfo && userInfo.avatarUrl) {
      // 如果有头像URL，添加时间戳防止缓存
      const avatarUrl = userInfo.avatarUrl
      const separator = avatarUrl.includes('?') ? '&' : '?'
      this.setData({
        avatarSrc: `${avatarUrl}${separator}t=${Date.now()}`
      })
    } else {
      // 没有头像，使用默认头像
      this.setData({
        avatarSrc: '/assets/tabbar/profile.png'
      })
    }
  },

  // 加载统计数据（余额、卡券数量、地址数量）
  async loadStats() {
    // 并行加载三个统计数据
    Promise.all([
      this.loadBalance(),
      this.loadCouponCount(),
      this.loadAddressCount()
    ]).catch(e => {
      console.error('加载统计数据失败:', e)
    })
  },

  // 加载钱包余额
  async loadBalance() {
    try {
      const res = await api.getWalletBalance()
      if (res && res.success && res.data != null) {
        // 处理后端返回的 BigDecimal
        const balance = amount.parseBigDecimalLike(res.data, 0)
        const balanceStr = amount.formatAmount(balance)
        this.setData({ 
          balance,
          balanceStr
        })
      }
    } catch (e) {
      console.error('加载余额失败:', e)
    }
  },

  // 加载卡券数量
  async loadCouponCount() {
    try {
      // 获取未使用状态的卡券总数
      // 注意：这里只统计未使用的卡券（status=1），如果需要统计所有状态的卡券，需要调用多次并累加
      const res = await api.getUserCoupons(1, 1, 1) // status=1表示未使用，pageNum=1, pageSize=1（只需要总数）
      if (res && res.success && res.data) {
        const data = res.data
        let total = 0
        // 后端返回的是 PageResult 格式：{ list: [], total: 0, page: 1, pageSize: 20 }
        if (data.total != null) {
          total = parseInt(data.total) || 0
        } else if (data.list && Array.isArray(data.list)) {
          // 如果没有total字段，使用list长度（但这不是真实总数，只是一个估计）
          total = data.list.length
        }
        this.setData({ couponCount: total })
      }
    } catch (e) {
      console.error('加载卡券数量失败:', e)
    }
  },

  // 加载地址数量
  async loadAddressCount() {
    try {
      // 获取地址列表（使用一个小页面大小来获取总数）
      const res = await api.getAddressList(1, 1) // pageNum=1, pageSize=1（只需要总数）
      if (res && res.success && res.data) {
        const data = res.data
        let total = 0
        // 后端返回的是 PageResult 格式：{ list: [], total: 0, page: 1, pageSize: 20 }
        if (data.total != null) {
          total = parseInt(data.total) || 0
        } else if (data.list && Array.isArray(data.list)) {
          // 如果没有total字段，使用list长度（但这不是真实总数，只是一个估计）
          total = data.list.length
        }
        this.setData({ addressCount: total })
      }
    } catch (e) {
      console.error('加载地址数量失败:', e)
    }
  },

  goLogin(){ wx.navigateTo({ url: '/pages/login/login' }) },
  goOrders(){ wx.switchTab({ url: '/pages/orders/index' }) },
  goRecharge(){ wx.navigateTo({ url: '/pages/recharge/recharge' }) },
  goBindPhone(){ wx.navigateTo({ url: '/pages/bind-phone/bind-phone' }) },
  goWallet(){ wx.navigateTo({ url: '/pages/wallet/index' }) },

  // 地址管理已实现
  goAddress(){ wx.navigateTo({ url: '/pages/address/index' }) },
  
  // 卡券相关
  goCouponCenter(){ wx.navigateTo({ url: '/pages/coupon/index' }) },
  goMyCoupons(){ wx.navigateTo({ url: '/pages/coupon/index' }) },
  goFeedback(){ wx.navigateTo({ url: '/pages/feedback/index' }) },
  async goService(){
    try {
      // 获取客服电话
      const res = await api.getPublicConfigs()
      if (res && res.success && res.data) {
        const phone = res.data.customer_service_phone
        if (phone) {
          // 显示拨打电话弹窗
          wx.showModal({
            title: '联系客服',
            content: `确定要拨打 ${phone} 吗？`,
            confirmText: '拨打',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.makePhoneCall({
                  phoneNumber: phone,
                  success: () => {
                    console.log('拨打电话成功')
                  },
                  fail: (err) => {
                    console.error('拨打电话失败:', err)
                    if (err.errMsg && err.errMsg.includes('cancel')) {
                      return
                    }
                    api.showError('拨打电话失败，请稍后重试')
                  }
                })
              }
            }
          })
        } else {
          api.showError('暂未配置客服电话')
        }
      } else {
        api.showError('获取客服信息失败')
      }
    } catch (e) {
      console.error('获取客服信息失败:', e)
      api.showError('获取客服信息失败，请稍后重试')
    }
  },
  goInvite(){ wx.navigateTo({ url: '/pages/placeholder/index' }) },
  goSettings(){ wx.navigateTo({ url: '/pages/settings/index' }) },
  goEditProfile(){ 
    if (!this.data.isLogin) {
      return
    }
    wx.navigateTo({ url: '/pages/profile/edit' }) 
  },

  // 上传头像（已移至编辑页面，保留此方法以防其他地方调用）
  async uploadAvatar() {
    if (!this.data.isLogin) {
      return
    }
    
    try {
      // 选择图片
      const res = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      
      if (!res.tempFilePaths || res.tempFilePaths.length === 0) {
        return
      }
      
      const tempFilePath = res.tempFilePaths[0]
      
      // 显示上传中提示
      wx.showLoading({ title: '上传中...', mask: true })
      
      try {
        // 上传图片
        const uploadRes = await api.uploadImage(tempFilePath, 'avatar')
        
        console.log('上传结果:', uploadRes)
        
        if (uploadRes.success && uploadRes.data) {
          // 获取图片URL（可能是 uploadRes.data.url 或 uploadRes.data）
          let avatarUrl = uploadRes.data.url || uploadRes.data
          
          if (!avatarUrl) {
            wx.showToast({ title: '上传失败：未获取到图片地址', icon: 'none' })
            return
          }
          
          console.log('准备更新头像，URL:', avatarUrl)
          
          // 更新头像
          const updateRes = await api.updateAvatar(avatarUrl)
          console.log('更新头像结果:', updateRes)
          
          // 立即更新本地数据，避免等待接口返回
          if (this.data.userInfo) {
            this.setData({
              'userInfo.avatarUrl': avatarUrl
            })
          }
          
          // 更新头像显示（立即生效）
          this.updateAvatarSrc()
          
          // 刷新用户信息（确保数据同步）
          await this.loadUserInfo()
          
          wx.showToast({ title: '头像更新成功', icon: 'success' })
        } else {
          wx.showToast({ title: '上传失败，请重试', icon: 'none' })
        }
      } catch (e) {
        console.error('上传头像失败:', e)
        wx.showToast({ title: e.error || '上传失败，请重试', icon: 'none' })
      } finally {
        wx.hideLoading()
      }
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('cancel')) {
        // 用户取消选择，不显示错误
        return
      }
      console.error('选择图片失败:', e)
      wx.showToast({ title: '选择图片失败', icon: 'none' })
    }
  },

  // 分享给好友
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    const sharePath = app.getSharePath()
    const shareConfig = {
      title: '喵屋管家 - 便捷的生活服务小程序',
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

})
