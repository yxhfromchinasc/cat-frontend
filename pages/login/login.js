// pages/login/login.js
const api = require('../../utils/api.js')

Page({
  data: {
    isLogin: false,
    showPhoneAuth: false,
    phoneAuthData: null,
    redirect: '',
    loading: false,
    loadingText: '处理中...',
    agreedProtocol: false, // 是否同意协议
    referralCode: '', // 邀请码
    referrerInfo: null, // 邀请人信息
    showReferrerInfo: false // 是否显示邀请人信息
  },

  onLoad(options) {
    // 读取 redirect 参数
    if (options && options.redirect) {
      this.setData({ redirect: decodeURIComponent(options.redirect) })
    }
    
    // 读取邀请码参数
    if (options && options.referralCode) {
      const referralCode = options.referralCode
      this.setData({ referralCode })
      // 存储邀请码到本地，确保浏览其他页面后仍能使用
      wx.setStorageSync('pendingReferralCode', referralCode)
      // 查询邀请人信息
      this.loadReferrerInfo(referralCode)
    } else {
      // 如果没有URL参数，尝试从本地存储读取
      const storedReferralCode = wx.getStorageSync('pendingReferralCode')
      if (storedReferralCode) {
        this.setData({ referralCode: storedReferralCode })
        this.loadReferrerInfo(storedReferralCode)
      }
    }
    
    // 检查是否已登录
    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLogin = api.checkLogin()
    if (isLogin) {
      this.setData({ isLogin: true })
      // 已登录，直接回跳
      this.loginSuccess()
    }
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

  // 切换协议同意状态
  toggleAgreeProtocol() {
    this.setData({
      agreedProtocol: !this.data.agreedProtocol
    })
  },

  // 跳转到用户协议
  goUserAgreement() {
    wx.navigateTo({ url: '/pages/settings/user-agreement' })
  },

  // 跳转到隐私政策
  goPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/settings/privacy-policy' })
  },

  // 检查是否同意协议
  checkAgreeProtocol() {
    if (!this.data.agreedProtocol) {
      wx.showToast({
        title: '请先同意用户协议和隐私政策',
        icon: 'none',
        duration: 2000
      })
      return false
    }
    return true
  },

  // 快捷登录
  wechatLogin() {
    // 检查是否同意协议
    if (!this.checkAgreeProtocol()) {
      return
    }

    // 获取用户信息 - 必须在用户点击事件中直接调用
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: async (res) => {
        try {
          this.setData({ loading: true, loadingText: '登录中...' })
          
          // 获取微信授权码
          const loginRes = await wx.login()
          const code = loginRes.code

          // 构建用户信息
          const userInfo = this.buildUserInfo(res.userInfo)
          
          // 获取本地存储的邀请码（如果有）
          const referralCode = this.data.referralCode || wx.getStorageSync('pendingReferralCode') || ''
          
          // 构建登录数据（首次登录不带手机号）
          const loginData = this.buildLoginData(userInfo)
          if (referralCode) {
            loginData.referralCode = referralCode
          }
          
          // 首次登录请求（不带手机号）
          const result = await api.wechatLogin(loginData, code)
          this.setData({ loading: false })

          if (result.success) {
            // 登录成功后清除邀请码
            if (referralCode) {
              wx.removeStorageSync('pendingReferralCode')
            }
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
          this.setData({ loading: false })
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
        this.setData({ loading: false })
        console.error('获取用户信息失败:', error)
        wx.showToast({
          title: '获取用户信息失败',
          icon: 'none'
        })
      }
    })
  },


  // 手机号快捷登录并重新登录
  async requestPhoneAuth(userInfo) {
    try {
      // 显示手机号快捷登录提示
      wx.showModal({
        title: '手机号快捷登录',
        content: '为了完成登录，需要获取您的手机号',
        confirmText: '确定',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户确认，显示手机号快捷登录按钮
            this.showPhoneAuthButton(userInfo)
          } else {
            // 用户取消
            wx.showToast({
              title: '需要手机号才能登录',
              icon: 'none'
            })
          }
        }
      })
    } catch (error) {
      console.error('手机号快捷登录失败:', error)
      wx.showToast({
        title: '手机号快捷登录失败',
        icon: 'none'
      })
    }
  },

  // 显示手机号快捷登录按钮
  showPhoneAuthButton(userInfo) {
    // 设置数据，显示手机号快捷登录按钮
    this.setData({
      showPhoneAuth: true,
      phoneAuthData: {
        userInfo: userInfo
      }
    })
  },

  // 处理手机号快捷登录结果
  async onPhoneNumberGet(e) {
    try {
      const { userInfo } = this.data.phoneAuthData
      
      if (e.detail.encryptedData && e.detail.iv) {
        this.setData({ loading: true, loadingText: '处理中...' })
        
        // 重新获取登录码（避免code重复使用）
        const loginRes = await wx.login()
        const freshCode = loginRes.code
        
        // 解密手机号
        const decryptResult = await api.decryptPhoneNumber(e.detail.encryptedData, e.detail.iv, freshCode)
        
        if (decryptResult.success) {
          this.setData({ loadingText: '登录中...' })
          
          // 重新获取登录码用于登录（避免code重复使用）
          const loginRes = await wx.login()
          const loginCode = loginRes.code
          
          // 获取本地存储的邀请码（如果有）
          const referralCode = this.data.referralCode || wx.getStorageSync('pendingReferralCode') || ''
          
          // 重新调用登录接口，带上手机号
          const loginData = this.buildLoginData(userInfo, decryptResult.data.phone)
          if (referralCode) {
            loginData.referralCode = referralCode
          }
          
          const result = await api.wechatLogin(loginData, loginCode)
          
          // 登录成功后清除邀请码
          if (result.success && referralCode) {
            wx.removeStorageSync('pendingReferralCode')
          }
          this.setData({ loading: false })
          
          if (result.success) {
            // 登录成功，处理结果
            this.handleLoginSuccess(result.data)
            // 隐藏手机号快捷登录按钮
            this.setData({
              showPhoneAuth: false,
              phoneAuthData: null
            })
          } else {
            console.error('重新登录失败:', result)
          }
        } else {
          this.setData({ loading: false })
          console.error('手机号解密失败:', decryptResult)
          wx.showToast({
            title: '手机号解密失败',
            icon: 'none'
          })
        }
      } else {
        console.error('获取手机号失败:', e.detail)
        // 检查是否是权限问题
        if (e.detail.errMsg && e.detail.errMsg.includes('no permission')) {
          wx.showModal({
            title: '权限未开通',
            content: '需要在微信公众平台后台开通"获取手机号"权限。\n\n路径：开发 -> 接口设置 -> 获取手机号',
            showCancel: false,
            confirmText: '知道了'
          })
        } else {
          wx.showToast({
            title: '获取手机号失败',
            icon: 'none'
          })
        }
      }
    } catch (error) {
      this.setData({ loading: false })
      console.error('手机号快捷登录处理失败:', error)
      wx.showToast({
        title: '手机号快捷登录失败',
        icon: 'none'
      })
    }
  },

  // 取消手机号快捷登录
  cancelPhoneAuth() {
    this.setData({
      showPhoneAuth: false,
      phoneAuthData: null
    })
    wx.showToast({
      title: '需要手机号才能登录',
      icon: 'none'
    })
  },

  // 绑定手机号
  bindPhone() {
    wx.navigateTo({
      url: '/pages/bind-phone/bind-phone'
    })
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

  // 登录成功处理：有 redirect 则跳转回原页，否则回首页
  loginSuccess() {
    const { redirect } = this.data
    setTimeout(() => {
      if (redirect) {
        // 若是 tabBar 页面只能使用 switchTab
        if (redirect.startsWith('/pages/index/index') || redirect.startsWith('/pages/orders/index') || redirect.startsWith('/pages/profile/index')) {
          try { wx.switchTab({ url: redirect }) } catch (_) { wx.switchTab({ url: '/pages/index/index' }) }
        } else {
          try { wx.redirectTo({ url: redirect }) } catch (_) { wx.switchTab({ url: '/pages/index/index' }) }
        }
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }, 600)
  },

  // 返回上一页或首页
  goHome() {
    // 获取当前页面栈
    const pages = getCurrentPages()
    // 如果页面栈长度大于1，说明有上一页，则返回上一页
    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1
      })
    } else {
      // 如果没有上一页，则跳转到首页
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  // 加载邀请人信息
  async loadReferrerInfo(referralCode) {
    if (!referralCode) return
    
    try {
      const res = await api.getReferrerInfoByCode(referralCode)
      if (res && res.success && res.data) {
        this.setData({
          referrerInfo: res.data,
          showReferrerInfo: true
        })
      } else {
        // 邀请码无效，清除本地存储
        wx.removeStorageSync('pendingReferralCode')
        this.setData({
          referralCode: '',
          showReferrerInfo: false
        })
      }
    } catch (e) {
      console.error('获取邀请人信息失败:', e)
      // 获取失败不影响登录流程，只隐藏邀请人信息
      this.setData({
        showReferrerInfo: false
      })
    }
  }
})
