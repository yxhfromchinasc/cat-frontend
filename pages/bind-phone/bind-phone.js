// pages/bind-phone/bind-phone.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    phone: '',
    code: '',
    countdown: 0
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    })
  },

  // 输入验证码
  onCodeInput(e) {
    this.setData({
      code: e.detail.value
    })
  },

  // 发送验证码
  async sendCode() {
    const { phone } = this.data
    
    if (!phone) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      })
      return
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      })
      return
    }

    try {
      await api.post('/user/send-sms-code', { phone })
      wx.showToast({
        title: '验证码已发送',
        icon: 'success'
      })
      
      // 开始倒计时
      this.startCountdown()
    } catch (error) {
      console.error('发送验证码失败:', error)
    }
  },

  // 开始倒计时
  startCountdown() {
    this.setData({ countdown: 60 })
    
    const timer = setInterval(() => {
      const countdown = this.data.countdown - 1
      this.setData({ countdown })
      
      if (countdown <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  },

  // 绑定手机号
  async bindPhone() {
    const { phone, code } = this.data
    
    if (!phone) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      })
      return
    }

    if (!code) {
      wx.showToast({
        title: '请输入验证码',
        icon: 'none'
      })
      return
    }

    try {
      const result = await api.post('/user/bind/phone', {
        phone,
        verificationCode: code
      })

      if (result.success) {
        wx.showToast({
          title: '绑定成功',
          icon: 'success'
        })
        
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }, 1500)
      }
    } catch (error) {
      console.error('绑定手机号失败:', error)
    }
  },

  // 跳过绑定
  skipBind() {
    wx.showModal({
      title: '提示',
      content: '跳过绑定手机号可能会影响部分功能使用，确定要跳过吗？',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      }
    })
  }
})
