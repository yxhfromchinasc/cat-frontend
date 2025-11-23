// pages/profile/edit.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    nickname: '',
    phone: '',
    maskedPhone: '',
    avatarSrc: '/assets/tabbar/profile.png'
  },

  onLoad() {
    this.loadUserInfo()
  },

  async loadUserInfo() {
    try {
      const res = await api.getUserInfo()
      if (res && res.success && res.data) {
        const userInfo = res.data
        this.setData({
          nickname: userInfo.nickname || '',
          phone: userInfo.phone || '',
          maskedPhone: this.maskPhone(userInfo.phone)
        })
        this.updateAvatarSrc(userInfo.avatarUrl)
      }
    } catch (e) {
      console.error('加载用户信息失败:', e)
    }
  },

  // 更新头像显示
  updateAvatarSrc(avatarUrl) {
    if (avatarUrl) {
      // 如果有头像URL，添加时间戳防止缓存
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

  // 手机号脱敏显示
  maskPhone(phone) {
    if (!phone || phone.length !== 11) {
      return '未绑定'
    }
    return phone.substring(0, 3) + '****' + phone.substring(7)
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
    // 实时保存昵称
    this.debounceSaveNickname()
  },

  // 防抖保存昵称
  debounceSaveNickname() {
    if (this.saveNicknameTimer) {
      clearTimeout(this.saveNicknameTimer)
    }
    this.saveNicknameTimer = setTimeout(() => {
      this.saveNickname()
    }, 1000) // 1秒后保存
  },

  // 保存昵称
  async saveNickname() {
    try {
      const res = await api.updateProfile(this.data.nickname)
      if (res && res.success) {
        // 静默保存，不显示提示
        console.log('昵称保存成功')
      }
    } catch (e) {
      console.error('保存昵称失败:', e)
    }
  },

  // 上传头像
  async uploadAvatar() {
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
        
        if (uploadRes.success && uploadRes.data) {
          // 获取图片URL
          let avatarUrl = uploadRes.data.url || uploadRes.data
          
          if (!avatarUrl) {
            wx.showToast({ title: '上传失败：未获取到图片地址', icon: 'none' })
            return
          }
          
          // 更新头像
          const updateRes = await api.updateAvatar(avatarUrl)
          
          if (updateRes && updateRes.success) {
            // 立即更新本地显示
            this.updateAvatarSrc(avatarUrl)
            wx.showToast({ title: '头像更新成功', icon: 'success' })
          } else {
            wx.showToast({ title: '更新失败，请重试', icon: 'none' })
          }
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

  onUnload() {
    // 清理定时器
    if (this.saveNicknameTimer) {
      clearTimeout(this.saveNicknameTimer)
    }
  }
})

