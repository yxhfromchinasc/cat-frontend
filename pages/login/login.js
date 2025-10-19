// pages/login/login.js
const api = require('../../utils/api.js')

Page({
  data: {
    loginType: 'wechat', // 'wechat' | 'phone'
    phone: '',
    code: '',
    countdown: 0,
    isLogin: false,
    showPhoneAuth: false,
    phoneAuthData: null
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

  // 构建用户信息对象
  buildUserInfo(userInfo) {
    return {
      nickname: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
      gender: userInfo.gender,
      country: userInfo.country,
      province: userInfo.province,
      city: userInfo.city,
      language: userInfo.language
    }
  },

  // 构建登录数据
  buildLoginData(userInfo, phone = null) {
    const loginData = {
      nickname: userInfo.nickname,
      avatarUrl: userInfo.avatarUrl,
      gender: userInfo.gender,
      country: userInfo.country,
      province: userInfo.province,
      city: userInfo.city,
      language: userInfo.language
    }
    
    if (phone) {
      loginData.phone = phone
    }
    
    return loginData
  },

  // 检查是否需要手机号授权
  isNeedPhoneAuth(errorCode) {
    return errorCode === 3002 || errorCode === '3002'
  },

  // 微信授权登录
  wechatLogin() {
    // 获取用户信息 - 必须在用户点击事件中直接调用
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: async (res) => {
        try {
          // 获取微信授权码
          const loginRes = await wx.login()
          const code = loginRes.code

          // 构建用户信息
          const userInfo = this.buildUserInfo(res.userInfo)
          
          // 构建登录数据（首次登录不带手机号）
          const loginData = this.buildLoginData(userInfo)
          
          // 首次登录请求（不带手机号）
          const result = await api.wechatLogin(loginData, code)

          if (result.success) {
            // 登录成功，处理结果
            this.handleLoginSuccess(result.data)
          } else {
            // 检查是否需要手机号授权
            if (this.isNeedPhoneAuth(result.code)) {
              // 需要授权手机号
              await this.requestPhoneAuth(userInfo)
            } else {
              // 其他错误
              console.error('微信登录失败:', result)
            }
          }
        } catch (error) {
          // 检查是否是3002错误码（需要手机号授权）
          if (this.isNeedPhoneAuth(error.code)) {
            // 重新构建用户信息
            const userInfo = this.buildUserInfo(res.userInfo)
            await this.requestPhoneAuth(userInfo)
          } else {
            console.error('微信登录失败:', error)
            // 其他错误提示已在API工具中处理
          }
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
  },


  // 授权手机号并重新登录
  async requestPhoneAuth(userInfo) {
    try {
      // 显示手机号授权提示
      wx.showModal({
        title: '需要授权手机号',
        content: '为了完成登录，需要获取您的手机号',
        confirmText: '授权',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户确认授权，显示手机号授权按钮
            this.showPhoneAuthButton(userInfo)
          } else {
            // 用户取消授权
            wx.showToast({
              title: '需要授权手机号才能登录',
              icon: 'none'
            })
          }
        }
      })
    } catch (error) {
      console.error('手机号授权失败:', error)
      wx.showToast({
        title: '手机号授权失败',
        icon: 'none'
      })
    }
  },

  // 显示手机号授权按钮
  showPhoneAuthButton(userInfo) {
    // 设置数据，显示手机号授权按钮
    this.setData({
      showPhoneAuth: true,
      phoneAuthData: {
        userInfo: userInfo
      }
    })
  },

  // 处理手机号授权结果
  async onPhoneNumberGet(e) {
    try {
      const { userInfo } = this.data.phoneAuthData
      
      if (e.detail.encryptedData && e.detail.iv) {
        // 重新获取微信授权码（避免code重复使用）
        const loginRes = await wx.login()
        const freshCode = loginRes.code
        
        // 解密手机号
        const decryptResult = await api.decryptPhoneNumber(e.detail.encryptedData, e.detail.iv, freshCode)
        
        if (decryptResult.success) {
          // 重新获取微信授权码用于登录（避免code重复使用）
          const loginRes = await wx.login()
          const loginCode = loginRes.code
          
          // 重新调用登录接口，带上手机号
          const loginData = this.buildLoginData(userInfo, decryptResult.data.phone)
          
          const result = await api.wechatLogin(loginData, loginCode)
          
          if (result.success) {
            // 登录成功，处理结果
            this.handleLoginSuccess(result.data)
            // 隐藏手机号授权按钮
            this.setData({
              showPhoneAuth: false,
              phoneAuthData: null
            })
          } else {
            console.error('重新登录失败:', result)
          }
        } else {
          console.error('手机号解密失败:', decryptResult)
          wx.showToast({
            title: '手机号解密失败',
            icon: 'none'
          })
        }
      } else {
        console.error('获取手机号失败:', e.detail)
        wx.showToast({
          title: '获取手机号失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('手机号授权处理失败:', error)
      wx.showToast({
        title: '手机号授权失败',
        icon: 'none'
      })
    }
  },

  // 取消手机号授权
  cancelPhoneAuth() {
    this.setData({
      showPhoneAuth: false,
      phoneAuthData: null
    })
    wx.showToast({
      title: '需要授权手机号才能登录',
      icon: 'none'
    })
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

  // 处理登录成功
  handleLoginSuccess(data) {
    if (data.success) {
      // 保存登录信息
      wx.setStorageSync('accessToken', data.accessToken)
      wx.setStorageSync('userId', data.userId)
      wx.setStorageSync('userInfo', {
        username: data.username,
        phone: data.phone,
        openId: data.openId,
        isNewUser: data.isNewUser
      })
      
      // 根据登录状态处理
      if (data.isNewUser) {
        wx.showToast({
          title: '欢迎新用户！',
          icon: 'success'
        })
        // 预留新用户引导方法
        this.handleNewUser(data)
      } else {
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
        // 预留跳转逻辑方法
        this.handleUserLogin(data)
      }
      
      // 检查是否需要完善信息
      if (data.needCompleteInfo) {
        this.handleCompleteInfo()
      }
    } else if (data.needBindPhone) {
      // 需要绑定手机号
      wx.showModal({
        title: '提示',
        content: '需要绑定手机号才能使用完整功能',
        success: (res) => {
          if (res.confirm) {
            this.bindPhone()
          } else {
            this.loginSuccess()
          }
        }
      })
    }
  },

  // 新用户引导（预留方法）
  handleNewUser(data) {
    // 暂时跳转到首页，后续可以扩展
    this.loginSuccess()
  },

  // 用户登录处理（预留方法）
  handleUserLogin(data) {
    // 暂时跳转到首页，后续可以区分新老用户
    this.loginSuccess()
  },

  // 完善信息引导（预留方法）
  handleCompleteInfo() {
    // 暂时弹窗提示，后续可以跳转到完善信息页面
    wx.showModal({
      title: '提示',
      content: '请完善您的个人信息以获得更好的服务体验',
      showCancel: false,
      success: () => {
        // 后续可以跳转到完善信息页面
        // wx.navigateTo({
        //   url: '/pages/complete-info/index'
        // })
      }
    })
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
