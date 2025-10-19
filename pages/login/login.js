// pages/login/login.js
const api = require('../../utils/api.js')

Page({
  data: {
    loginType: 'wechat', // 'wechat' | 'phone'
    phone: '',
    code: '',
    countdown: 0,
    isLogin: false
  },

  onLoad() {
    // 检查是否已登录
    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLogin = api.checkLogin()
    if (isLogin) {
      this.setData({ isLogin: true })
      // 已登录，跳转到首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }, 1000)
    }
  },

  // 切换登录方式
  switchLoginType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      loginType: type,
      phone: '',
      code: '',
      countdown: 0
    })
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
      const result = await api.sendSmsCode(phone)
      
      if (result.success) {
        // 开始倒计时
        this.startCountdown()
      }
    } catch (error) {
      console.error('发送验证码失败:', error)
      // 错误提示已在API工具中处理，这里不需要重复处理
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

  // 微信授权登录
  async wechatLogin() {
    try {
      // 获取微信授权码
      const loginRes = await wx.login()
      const code = loginRes.code

      // 获取用户信息 - 必须在用户点击事件中调用
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: async (res) => {
          try {
            const userInfo = {
              nickname: res.userInfo.nickName,
              avatarUrl: res.userInfo.avatarUrl,
              gender: res.userInfo.gender,
              country: res.userInfo.country,
              province: res.userInfo.province,
              city: res.userInfo.city,
              language: res.userInfo.language
            }
            
            // 调用后端登录接口
            const result = await api.wechatLogin(code, userInfo)

            if (result.success) {
              // 保存token
              api.setToken(result.data.accessToken)
              
              // 检查是否需要绑定手机号
              if (result.data.needBindPhone) {
                wx.showModal({
                  title: '提示',
                  content: '首次登录需要绑定手机号，是否立即绑定？',
                  success: (res) => {
                    if (res.confirm) {
                      this.bindPhone()
                    } else {
                      // 用户取消绑定，跳转到首页
                      this.loginSuccess()
                    }
                  }
                })
              } else {
                this.loginSuccess()
              }
            }
          } catch (error) {
            console.error('微信登录失败:', error)
            // 错误提示已在API工具中处理，这里不需要重复处理
          }
        },
        fail: (error) => {
          console.error('获取用户信息失败:', error)
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('微信登录失败:', error)
      // 错误提示已在API工具中处理，这里不需要重复处理
    }
  },


  // 绑定手机号
  bindPhone() {
    wx.navigateTo({
      url: '/pages/bind-phone/bind-phone'
    })
  },

  // 手机号验证码登录
  async phoneLogin() {
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

    // 验证验证码格式
    if (!/^\d{6}$/.test(code)) {
      wx.showToast({
        title: '请输入6位数字验证码',
        icon: 'none'
      })
      return
    }

    try {
      const result = await api.phoneSmsLogin(phone, code)

      if (result.success) {
        // 保存token
        api.setToken(result.data.accessToken)
        this.loginSuccess()
      }
    } catch (error) {
      console.error('手机号登录失败:', error)
      // 错误提示已在API工具中处理，这里不需要重复处理
    }
  },

  // 登录成功处理
  loginSuccess() {
    // 成功提示已在API工具中处理，这里直接跳转
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index'
      })
    }, 1000)
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})
