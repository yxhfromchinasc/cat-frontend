/**
 * 统一API请求工具
 * 基于规范文档实现统一的请求格式和错误处理
 */

// 基础配置
const API_CONFIG = {
  baseURL: 'http://localhost:8080/api', // 根据API文档，使用本地开发环境
  timeout: 10000, // 请求超时时间
  retryCount: 3, // 重试次数
}

/**
 * 获取存储的token
 */
function getToken() {
  try {
    return wx.getStorageSync('token') || ''
  } catch (error) {
    console.error('获取token失败:', error)
    return ''
  }
}

/**
 * 设置token到存储
 */
function setToken(token) {
  try {
    wx.setStorageSync('token', token)
  } catch (error) {
    console.error('保存token失败:', error)
  }
}

/**
 * 清除token
 */
function clearToken() {
  try {
    wx.removeStorageSync('token')
  } catch (error) {
    console.error('清除token失败:', error)
  }
}

/**
 * 显示错误提示
 */
function showError(message) {
  wx.showToast({
    title: message || '请求失败',
    icon: 'none',
    duration: 2000
  })
}

/**
 * 显示成功提示
 */
function showSuccess(message) {
  wx.showToast({
    title: message || '操作成功',
    icon: 'success',
    duration: 1500
  })
}

/**
 * 显示加载提示
 */
function showLoadingToast(title = '加载中...') {
  wx.showLoading({
    title: title,
    mask: true
  })
}

/**
 * 隐藏加载提示
 */
function hideLoadingToast() {
  wx.hideLoading()
}

/**
 * 处理响应数据
 */
function handleResponse(response) {
  const { success, code, message, data } = response.data || {}
  
  // 根据规范文档处理不同的状态码
  switch (code) {
    case 200:
      return {
        success: true,
        data: data,
        message: message || '操作成功'
      }
    case 401:
      // Token无效，清除本地token并跳转到登录页
      clearToken()
      wx.navigateTo({
        url: '/pages/login/login'
      })
      return {
        success: false,
        error: '未授权，请重新登录',
        code: 401
      }
    case 403:
      return {
        success: false,
        error: '权限不足',
        code: 403
      }
    case 404:
      return {
        success: false,
        error: '资源不存在',
        code: 404
      }
    case 500:
      return {
        success: false,
        error: '服务器内部错误',
        code: 500
      }
    default:
      return {
        success: false,
        error: message || '请求失败',
        code: code || 400
      }
  }
}

/**
 * 统一请求方法
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const {
      url,
      method = 'GET',
      data = {},
      header = {},
      showLoading = true,
      showError = true,
      showSuccess = false,
      successMessage = '操作成功'
    } = options

    // 显示加载提示
    if (showLoading) {
      showLoadingToast('加载中...')
    }

    // 构建完整URL
    const fullUrl = url.startsWith('http') ? url : `${API_CONFIG.baseURL}${url}`
    
    // 构建请求头
    const requestHeader = {
      'Content-Type': 'application/json',
      ...header
    }

    // 添加Authorization头
    const token = getToken()
    if (token) {
      requestHeader['Authorization'] = `Bearer ${token}`
    }

    // 发起请求
    wx.request({
      url: fullUrl,
      method: method.toUpperCase(),
      data: data,
      header: requestHeader,
      timeout: API_CONFIG.timeout,
      success: (res) => {
        if (showLoading) {
          hideLoadingToast()
        }

        // 处理响应
        const result = handleResponse(res)
        
        if (result.success) {
          // 显示成功提示
          if (showSuccess) {
            wx.showToast({
              title: successMessage,
              icon: 'success',
              duration: 1500
            })
          }
          resolve(result)
        } else {
          // 显示错误提示
          if (showError) {
            wx.showToast({
              title: result.error || '请求失败',
              icon: 'none',
              duration: 2000
            })
          }
          reject(result)
        }
      },
      fail: (error) => {
        if (showLoading) {
          hideLoadingToast()
        }

        const errorMsg = '网络请求失败，请检查网络连接'
        if (showError) {
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          })
        }
        reject({
          success: false,
          error: errorMsg,
          code: -1
        })
      }
    })
  })
}

/**
 * GET请求
 */
function get(url, params = {}, options = {}) {
  return request({
    url,
    method: 'GET',
    data: params,
    ...options
  })
}

/**
 * POST请求
 */
function post(url, data = {}, options = {}) {
  return request({
    url,
    method: 'POST',
    data,
    ...options
  })
}

/**
 * PUT请求
 */
function put(url, data = {}, options = {}) {
  return request({
    url,
    method: 'PUT',
    data,
    ...options
  })
}

/**
 * DELETE请求
 */
function del(url, data = {}, options = {}) {
  return request({
    url,
    method: 'DELETE',
    data,
    ...options
  })
}

/**
 * 分页请求工具
 */
function getPageList(url, pageNum = 1, pageSize = 10, params = {}, options = {}) {
  return get(url, {
    pageNum,
    pageSize,
    ...params
  }, options)
}

/**
 * 微信小程序登录
 */
function wechatLogin(code, userInfo) {
  return post('/login/wechat-miniprogram', userInfo, {
    url: `/login/wechat-miniprogram?code=${code}`,
    showSuccess: true,
    successMessage: '微信登录成功'
  }).then(result => {
    if (result.success && result.data.accessToken) {
      setToken(result.data.accessToken)
    }
    return result
  })
}

/**
 * 手机号验证码登录
 */
function phoneSmsLogin(phone, verificationCode) {
  return post('/login/phone-sms', {}, {
    url: `/login/phone-sms?phone=${phone}&verificationCode=${verificationCode}`,
    showSuccess: true,
    successMessage: '登录成功'
  }).then(result => {
    if (result.success && result.data.accessToken) {
      setToken(result.data.accessToken)
    }
    return result
  })
}

/**
 * 手机号密码登录
 */
function phonePasswordLogin(phone, password) {
  return post('/login/phone-password', {}, {
    url: `/login/phone-password?phone=${phone}&password=${password}`
  }).then(result => {
    if (result.success && result.data.accessToken) {
      setToken(result.data.accessToken)
    }
    return result
  })
}

/**
 * 发送短信验证码
 */
function sendSmsCode(phone) {
  return post('/user/send-sms-code', { phone }, {
    showSuccess: true,
    successMessage: '验证码已发送'
  })
}

/**
 * 绑定手机号
 */
function bindPhone(phone, verificationCode) {
  return post('/user/bind/phone', {
    phone,
    verificationCode
  })
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  return get('/user/info')
}

/**
 * 获取支持的登录方式
 */
function getLoginMethods() {
  return get('/login/methods')
}

/**
 * 登出方法
 */
function logout() {
  clearToken()
  return Promise.resolve({
    success: true,
    message: '登出成功'
  })
}

/**
 * 检查登录状态
 */
function checkLogin() {
  const token = getToken()
  return !!token
}

module.exports = {
  // 基础请求方法
  request,
  get,
  post,
  put,
  delete: del,
  
  // 分页请求
  getPageList,
  
  // 认证相关
  wechatLogin,
  phoneSmsLogin,
  phonePasswordLogin,
  sendSmsCode,
  bindPhone,
  getUserInfo,
  getLoginMethods,
  logout,
  checkLogin,
  getToken,
  setToken,
  clearToken,
  
  // 提示相关
  showError,
  showSuccess,
  showLoadingToast,
  hideLoadingToast,
  
  // 配置
  API_CONFIG
}
