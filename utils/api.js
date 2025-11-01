/**
 * 统一API请求工具
 * 基于规范文档实现统一的请求格式和错误处理
 */

// 基础配置
const API_CONFIG = {
  baseURL: 'http://localhost:8080/api/user', // 后端对外统一前缀
  timeout: 10000, // 请求超时时间
  retryCount: 3, // 重试次数
}

// 401 弹窗节流标记
let isLoginPromptShown = false

function getCurrentFullPath() {
  try {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1]
    if (!current || !current.route) return '/pages/index/index'
    const route = `/${current.route}`
    const query = current.options || {}
    const queryStr = Object.keys(query).length
      ? '?' + Object.keys(query).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join('&')
      : ''
    return route + queryStr
  } catch (_) {
    return '/pages/index/index'
  }
}

function goLoginWithRedirect() {
  if (isLoginPromptShown) return
  isLoginPromptShown = true
  const redirect = encodeURIComponent(getCurrentFullPath())
  wx.showModal({
    title: '未登录',
    content: '当前操作需要登录，是否前往登录？',
    confirmText: '去登录',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        try {
          wx.navigateTo({ url: `/pages/login/login?redirect=${redirect}` })
        } catch (_) {
          wx.navigateTo({ url: '/pages/login/login' })
        }
      }
    },
    complete: () => { isLoginPromptShown = false }
  })
}

/** 逆地理编码：调用后端接口 */
function reverseGeocode(latitude, longitude) {
  return get('/map/reverse-geocode', { latitude, longitude }, { showSuccess: false })
}

/**
 * 获取存储的token
 */
function getToken() {
  try {
    return wx.getStorageSync('accessToken') || ''
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
    wx.setStorageSync('accessToken', token)
  } catch (error) {
    console.error('保存token失败:', error)
  }
}

/**
 * 清除token
 */
function clearToken() {
  try {
    wx.removeStorageSync('accessToken')
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
  console.log('API响应原始数据:', response.data)
  console.log('HTTP状态码:', response.statusCode)
  const { success, code, message, data } = response.data || {}
  console.log('解析后的数据:', { success, code, message, data })
  
  // 根据规范文档处理不同的状态码
  switch (code) {
    case 200:
      return {
        success: true,
        data: data,
        message: message || '操作成功'
      }
    case 401:
      // Token无效，清理并统一弹窗引导登录
      clearToken()
      return {
        success: false,
        error: '未授权',
        code: 401,
        _needLogin: true
      }
    case 403:
      return {
        success: false,
        error: '无权限',
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
        error: message || '服务器内部错误',
        code: 500,
        message: message  // 保留原始message，方便后续使用
      }
    case 3002:
      // 微信小程序登录需要手机号授权
      console.log('处理3002错误码')
      return {
        success: false,
        code: 3002,
        message: message || '需要手机号授权',
        data: data
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
        console.log('handleResponse返回的结果:', result)
        
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
          // 401 未登录弹窗引导
          if (result.code === 401) {
            goLoginWithRedirect()
          } else if (result.code === 403) {
            wx.showToast({ title: '无权限访问', icon: 'none' })
          } else if (showError && result.code !== 3002) {
            // 其他错误（排除3002手机号授权）
            // 优先使用 message，然后是 error，最后是默认提示
            const errorMsg = result.message || result.error || '请求失败'
            wx.showToast({
              title: errorMsg,
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
function wechatLogin(loginData, code) {
  // 将 code 和用户信息都放在 body 中发送
  const requestData = {
    loginMethod: '1', // 微信小程序登录方式
    wechatCode: code,
    wechatUserInfo: loginData
  }
  
  return post('/login/wechat-miniprogram', requestData, {
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
 * 解密手机号
 */
function decryptPhoneNumber(encryptedData, iv, code) {
  return post('/user/decrypt-phone', {
    encryptedData: encryptedData,
    iv: iv,
    code: code
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
 * 地址管理 API
 */
function getAddressList(pageNum = 1, pageSize = 100) {
  return post('/address/list', { pageNum, pageSize }, { showSuccess: false })
}

function getAddressDetail(addressId) {
  return get('/address/detail', { addressId }, { showSuccess: false })
}

function createAddress(data) {
  return post('/address/create', data, { showSuccess: true, successMessage: '保存成功' })
}

function updateAddress(addressId, data) {
  return post('/address/update', { addressId, ...data }, { showSuccess: true, successMessage: '保存成功' })
}

function deleteAddress(addressId) {
  return get('/address/delete', { addressId }, { showSuccess: true, successMessage: '删除成功' })
}

function setDefaultAddress(addressId) {
  return post('/address/set-default', {}, { url: `/address/set-default?addressId=${addressId}`, showSuccess: true, successMessage: '设置成功' })
}

function getDefaultAddress() {
  return get('/address/default', {}, { showSuccess: false })
}

function getNearestAddress(latitude, longitude) {
  const params = {}
  if (latitude != null) params.latitude = latitude
  if (longitude != null) params.longitude = longitude
  return get('/address/nearest', params, { showSuccess: false })
}

/**
 * 创建充值订单
 * 返回包含 orderNo、formData、expireTime 的结构
 */
function createRecharge(amount) {
  console.log('创建充值订单，金额:', amount, '支付方式: 2 (微信小程序支付)')
  return post('/recharge/create', {
    amount: amount,
    paymentMethod: 2  // 微信小程序支付
  }, {
    showSuccess: false,
    showError: true
  })
}

/**
 * 查询充值状态
 */
function getRechargeStatus(orderNo) {
  return get(`/recharge/status`, { orderNo }, { showSuccess: false })
}

/**
 * 创建第三方支付订单，获取小程序支付参数
 */
function createPayment(orderNo, paymentMethod = 2) {
  return post('/pay/create', {
    orderNo,
    paymentMethod
  }, { showSuccess: false })
}

/**
 * 取消充值订单（可选）
 */
function cancelRecharge(orderNo) {
  return post(`/recharge/cancel`, {}, { url: `/recharge/cancel?orderNo=${orderNo}`, showSuccess: false })
}

/**
 * 创建提现订单（仅创建本地订单，不扣除余额）
 */
function createWithdraw(amount, withdrawMethod) {
  console.log('创建提现订单，金额:', amount, '提现方式:', withdrawMethod)
  return post('/withdraw/create', {
    amount: amount,
    withdrawMethod: withdrawMethod || 1  // 默认微信零钱
  }, {
    showSuccess: false,
    showError: false  // 不在通用请求中显示错误，让页面自己处理错误信息
  })
}

/**
 * 发起提现转账（扣除余额、调用第三方API）
 */
function initiateWithdraw(orderNo) {
  console.log('发起提现转账，订单号:', orderNo)
  return post('/withdraw/initiate', {
    orderNo: orderNo
  }, {
    showSuccess: false,
    showError: false  // 不在通用请求中显示错误，让页面自己处理错误信息
  })
}

/**
 * 获取代金券模板列表
 */
function getCouponTemplates(page = 1, pageSize = 10) {
  return post('/coupon/templates', {
    page,
    pageSize
  }, { showSuccess: false })
}

/**
 * 领取代金券
 */
function receiveCoupon(couponTemplateId) {
  return post('/coupon/receive', {
    couponTemplateId: String(couponTemplateId)
  }, { showSuccess: true, successMessage: '领取成功' })
}

/**
 * 获取用户代金券列表
 */
function getUserCoupons(status = 1, page = 1, pageSize = 10) {
  return post('/coupon/user-coupons', {
    status: String(status),
    page,
    pageSize
  }, { showSuccess: false })
}

/**
 * 获取可用代金券列表
 */
function getAvailableCoupons(orderAmount) {
  return get('/coupon/available', { orderAmount }, { showSuccess: false })
}

/**
 * 计算代金券优惠金额（根据模板ID和订单金额）
 */
function calculateCouponDiscount(couponTemplateId, orderAmount) {
  return get('/coupon/calculate', { couponTemplateId, orderAmount }, { showSuccess: false })
}

/**
 * 根据订单号和用户代金券ID计算优惠金额
 */
function calculateCouponDiscountByOrder(orderNo, userCouponId) {
  return get('/coupon/calculate-by-order', { orderNo, userCouponId }, { showSuccess: false })
}

/**
 * 获取用户对指定代金券的领取次数
 */
function getUserCouponReceiveCount(couponTemplateId) {
  return get('/coupon/user-receive-count', { couponTemplateId }, { showSuccess: false })
}

/**
 * 获取用户订单列表
 * @param {Object} params 查询参数
 * @param {number} params.status 订单状态：1-进行中，2-已完成，3-已取消，null-全部
 * @param {number} params.pageNum 页码，从1开始
 * @param {number} params.pageSize 页大小
 */
function getOrderList(params) {
  return post('/order/list', params, { showSuccess: false })
}

/**
 * 获取快递订单详情
 * @param {string} orderNo 订单号
 */
function getExpressOrderDetail(orderNo) {
  return get('/express/detail', { orderNo }, { showSuccess: false })
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
 * 根据地址ID获取驿站列表
 */
function getStationsByAddress(addressId) {
  return get('/station/stations-by-address', { addressId }, { showSuccess: false })
}

/**
 * 根据驿站ID获取地址列表（带服务范围标识）
 */
function getAddressesByStation(stationId) {
  return get('/station/addresses-by-station', { stationId }, { showSuccess: false })
}

/**
 * 获取附近驿站
 */
function getNearbyStations(latitude, longitude, radius = 3) {
  return post('/station/nearby', { latitude, longitude, radius }, { showSuccess: false })
}

/**
 * 创建快递代取订单
 */
function createExpressOrder(payload) {
  return post('/express/create', payload, { showSuccess: true, successMessage: '提交成功' })
}

/**
 * 取消快递代取订单
 */
function cancelExpressOrder(orderNo) {
  return post('/express/cancel', {}, { url: `/express/cancel?orderNo=${orderNo}`, showSuccess: true, successMessage: '已取消' })
}

/**
 * 根据地址ID获取回收点列表
 */
function getRecyclingPointsByAddress(addressId) {
  return get('/recycling-point/points-by-address', { addressId }, { showSuccess: false })
}

/**
 * 创建上门回收订单
 */
function createRecyclingOrder(payload) {
  return post('/recycling/create', payload, { showSuccess: true, successMessage: '提交成功' })
}

/**
 * 取消上门回收订单
 */
function cancelRecyclingOrder(orderNo) {
  return post('/recycling/cancel', {}, { url: `/recycling/cancel?orderNo=${orderNo}`, showSuccess: true, successMessage: '已取消' })
}

/**
 * 获取回收订单详情
 */
function getRecyclingOrderDetail(orderNo) {
  return get('/recycling/detail', { orderNo }, { showSuccess: false })
}

/**
 * 获取订单支付详情
 * @param {string} orderNo 订单号
 */
function getPaymentDetail(orderNo) {
  return get('/pay/detail', { orderNo }, { showSuccess: false })
}

/**
 * 上传图片
 * @param {string} filePath 图片临时路径
 * @param {string} category 图片分类，默认为 'express'
 * @returns {Promise} 返回上传结果，包含图片URL
 */
function uploadImage(filePath, category = 'express') {
  return new Promise((resolve, reject) => {
    const token = getToken()
    
    wx.uploadFile({
      url: `${API_CONFIG.baseURL}/media/upload/image`,
      filePath: filePath,
      name: 'file',
      formData: {
        category: category
      },
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          if (data.code === 200) {
            resolve({
              success: true,
              data: data.data,
              message: '上传成功'
            })
          } else if (data.code === 401) {
            clearToken()
            goLoginWithRedirect()
            reject({
              success: false,
              error: '未授权',
              code: 401
            })
          } else {
            reject({
              success: false,
              error: data.message || '上传失败',
              code: data.code
            })
          }
        } catch (e) {
          reject({
            success: false,
            error: '解析响应失败',
            code: -1
          })
        }
      },
      fail: (error) => {
        reject({
          success: false,
          error: '上传失败，请检查网络',
          code: -1
        })
      }
    })
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
  decryptPhoneNumber,
  logout,
  checkLogin,
  getToken,
  setToken,
  clearToken,

  // 地图相关
  reverseGeocode,
  
  // 图片上传
  uploadImage,
  
  // 驿站/取件相关
  getStationsByAddress,
  getAddressesByStation,
  getNearbyStations,
  createExpressOrder,
  cancelExpressOrder,
  
  // 回收相关
  getRecyclingPointsByAddress,
  createRecyclingOrder,
  cancelRecyclingOrder,
  getRecyclingOrderDetail,
  
  // 地址管理
  getAddressList,
  getAddressDetail,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getDefaultAddress,
  getNearestAddress,
  
  // 支付相关（充值）
  createRecharge,
  getRechargeStatus,
  cancelRecharge,
  createPayment,
  
  // 提现相关
  createWithdraw,
  initiateWithdraw,
  
  // 代金券相关
  getCouponTemplates,
  receiveCoupon,
  getUserCoupons,
  getAvailableCoupons,
  calculateCouponDiscount,
  calculateCouponDiscountByOrder,
  getUserCouponReceiveCount,
  
  // 订单相关
  getOrderList,
  getExpressOrderDetail,
  getRecyclingOrderDetail,
  
  // 支付相关
  getPaymentDetail,
  
  // 提示相关
  showError,
  showSuccess,
  showLoadingToast,
  hideLoadingToast,
  
  // 配置
  API_CONFIG
}
