/**
 * 统一API请求工具
 * 基于规范文档实现统一的请求格式和错误处理
 */

// 基础配置
const API_CONFIG = {
  baseURL: 'https://bd-miaow.tech/api/user', // 后端对外统一前缀
  // baseURL: 'http://localhost:8080/api/user', // 后端对外统一前缀

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
    content: '当前操作需要登录，前往登录？',
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
 * 地理编码：根据地址文本获取经纬度
 * @param {string} address 地址文本（完整地址）
 * @returns {Promise} 返回经纬度信息，包含 latitude, longitude
 */
function geocode(address) {
  return get('/map/geocode', { address }, { showLoading: false, showError: false })
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
    case 2003:
      // 存在进行中的充值订单
      return {
        success: false,
        code: 2003,
        message: message || '存在进行中的充值订单',
        data: data
      }
    case 2004:
      // 存在进行中的提现订单
      return {
        success: false,
        code: 2004,
        message: message || '存在进行中的提现订单',
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
          } else if (showError && result.code !== 3002 && result.code !== 2003 && result.code !== 2004) {
            // 其他错误（排除3002手机号授权、2003充值订单进行中、2004提现订单进行中）
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
  
  // 如果有邀请码，添加到请求数据中
  if (loginData.referralCode) {
    requestData.referralCode = loginData.referralCode
    // 从wechatUserInfo中移除referralCode，避免重复
    delete loginData.referralCode
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
function phoneSmsLogin(phone, verificationCode, referralCode) {
  // 获取本地存储的邀请码（如果有）
  const pendingReferralCode = referralCode || wx.getStorageSync('pendingReferralCode') || ''
  
  const requestData = {}
  if (pendingReferralCode) {
    requestData.referralCode = pendingReferralCode
  }
  
  return post('/login/phone-sms', requestData, {
    url: `/login/phone-sms?phone=${phone}&verificationCode=${verificationCode}`,
    showSuccess: true,
    successMessage: '登录成功'
  }).then(result => {
    if (result.success && result.data.accessToken) {
      setToken(result.data.accessToken)
      // 登录成功后清除邀请码
      if (pendingReferralCode) {
        wx.removeStorageSync('pendingReferralCode')
      }
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

  // 意见反馈相关
  function submitFeedback(data) {
    return post('/feedback/create', data, { showSuccess: true, successMessage: '提交成功' })
  }

  // 系统配置相关
  function getPublicConfigs() {
    return get('/config/public', {}, { showLoading: false, showError: false })
  }

  function getCustomerServicePhone() {
    return get('/config/customer-service-phone', {}, { showLoading: false, showError: false })
  }

  // 获取提现金额配置列表
  function getWithdrawAmounts() {
    return get('/config/withdraw-amounts', {}, { showLoading: false, showError: false })
  }

  // 获取是否允许全部提现配置
  function getAllowFullWithdraw() {
    return get('/config/allow-full-withdraw', {}, { showLoading: false, showError: false })
  }

  // 获取充值金额配置列表
  function getRechargeAmounts() {
    return get('/config/recharge-amounts', {}, { showLoading: false, showError: false })
  }

  // 获取分享图片配置
  function getShareImage() {
    return get('/config/value', { configKey: 'share_image' }, { showLoading: false, showError: false })
  }

  // 获取分享路径配置
  function getSharePath() {
    return get('/config/value', { configKey: 'share_path' }, { showLoading: false, showError: false })
  }

  // 获取分享标题配置
  function getShareTitle() {
    return get('/config/value', { configKey: 'share_title' }, { showLoading: false, showError: false })
  }

  // 获取配置值（通用方法）
  function getConfigValue(configKey) {
    return get('/config/value', { configKey }, { showLoading: false, showError: false })
  }

/**
 * 创建充值订单
 * 返回包含 orderNo、formData 的结构
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
 * 查询充值状态（已废弃，请使用 getPaymentProgress）
 * @deprecated 请使用 getPaymentProgress 替代
 */
function getRechargeStatus(orderNo) {
  return get(`/recharge/status`, { orderNo }, { showSuccess: false })
}

/**
 * 查询订单支付进度
 * @param {string} orderNo 订单号
 * @returns {Promise} 返回支付进度信息，包含 paymentStatus: success/failed/paying/pending
 */
function getPaymentProgress(orderNo) {
  return get(`/pay/progress`, { orderNo }, { showSuccess: false })
}

/**
 * 主动刷新三方支付状态（后端将直查三方并回补本地状态）
 * 若后端暂未实现，该请求可能返回404/400，前端需容错忽略
 */
function refreshPaymentStatus(orderNo) {
  return get(`/pay/progress/refresh`, { orderNo }, { showSuccess: false })
}

/**
 * 创建第三方支付订单，获取小程序支付参数
 * @param {string} orderNo 订单号
 * @param {number} paymentMethod 支付方式（2=微信小程序支付, 4=钱包支付）
 * @param {number} couponId 优惠券ID（可选）
 */
function createPayment(orderNo, paymentMethod = 2, couponId = null) {
  const params = {
    orderNo,
    paymentMethod
  }
  // 如果提供了优惠券ID，添加到请求参数中
  if (couponId) {
    params.couponId = couponId
  }
  return post('/pay/create', params, { showSuccess: false })
}

/**
 * 取消充值订单（可选）
 */
function cancelRecharge(orderNo) {
  return post(`/recharge/cancel`, {}, { url: `/recharge/cancel?orderNo=${orderNo}`, showSuccess: false })
}

/**
 * 取消第三方支付订单
 * 当用户从支付页面退出时调用，用于取消第三方支付订单并更新本地订单状态
 * @param {string} orderNo 订单号
 */
function cancelThirdPartyPayment(orderNo) {
  return post(`/pay/cancel`, {}, { url: `/pay/cancel?orderNo=${orderNo}`, showSuccess: false })
}

/**
 * 继续支付
 * 从订单详情页继续支付，如果订单处于支付中状态且有保存的支付参数且未过期，直接返回支付参数
 * 如果已过期或没有支付参数，重新创建支付订单
 * @param {string} orderNo 订单号
 */
function continuePayment(orderNo) {
  return post(`/pay/continue`, {}, { url: `/pay/continue?orderNo=${orderNo}`, showSuccess: false })
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
 * 仅限待提现状态
 */
function initiateWithdraw(orderNo, withdrawMethod) {
  return post('/withdraw/initiate', {
    orderNo: orderNo,
    withdrawMethod: withdrawMethod || 1  // 默认微信零钱
  }, {
    showSuccess: false,
    showError: false  // 不在通用请求中显示错误，让页面自己处理错误信息
  })
}

/**
 * 继续提现
 * 从订单详情页继续提现，如果订单处于提现中状态且有保存的转账参数且未过期，直接返回转账参数
 * 如果已过期或没有转账参数，重新创建转账订单
 * @param {string} orderNo 订单号
 */
function continueWithdraw(orderNo) {
  return post(`/withdraw/continue`, {}, { url: `/withdraw/continue?orderNo=${orderNo}`, showSuccess: false })
}

/**
 * 获取提现订单详情
 */
function getWithdrawDetail(orderNo) {
  return get('/withdraw/detail', { orderNo }, { showSuccess: false })
}

function getWithdrawOperateDetail(orderNo) {
  return get('/withdraw/operate-detail', { orderNo }, { showSuccess: false })
}

/**
 * 主动刷新订单转账状态
 * 直查第三方转账订单状态并按回调成功逻辑回补本地状态
 * @param {string} orderNo 订单号
 */
function refreshTransferStatus(orderNo) {
  return get('/withdraw/progress/refresh', { orderNo }, { showSuccess: false })
}

/**
 * 查询订单提现进度
 * 查询订单的提现进度，返回提现状态（成功/失败/提现中/待提现）
 * @param {string} orderNo 订单号
 */
function getWithdrawProgress(orderNo) {
  return get('/withdraw/progress', { orderNo }, { showSuccess: false })
}

/**
 * 取消当次提现
 * 清除保存的转账参数，允许用户重新发起提现
 * @param {string} orderNo 订单号
 */
function cancelTransfer(orderNo) {
  return post(`/withdraw/cancel-transfer`, {}, { url: `/withdraw/cancel-transfer?orderNo=${orderNo}`, showSuccess: false })
}

/**
 * 取消提现订单
 * 取消整个提现订单（仅限待提现状态）
 * @param {string} orderNo 订单号
 */
function cancelWithdrawOrder(orderNo) {
  return post(`/withdraw/cancel`, {}, { url: `/withdraw/cancel?orderNo=${orderNo}`, showSuccess: false })
}

/**
 * 取消充值订单
 * 取消整个充值订单（仅限待支付状态）
 * @param {string} orderNo 订单号
 */
function cancelRechargeOrder(orderNo) {
  return post(`/recharge/cancel`, {}, { url: `/recharge/cancel?orderNo=${orderNo}`, showSuccess: false })
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
 * @param {number} status 代金券状态（1=未使用，2=已使用，3=已过期）
 * @param {number} pageNum 页码（从1开始）
 * @param {number} pageSize 页大小
 */
function getUserCoupons(status = 1, pageNum = 1, pageSize = 10) {
  return post('/coupon/user-coupons', {
    status: status,
    pageNum,
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
 * 获取用户钱包余额
 */
function getWalletBalance() {
  return get('/wallet/balance', {}, { showSuccess: false })
}

/**
 * 获取待入账金额（打款中的回收订单金额总和）
 */
function getPendingAmount() {
  return get('/wallet/pending-amount', {}, { showSuccess: false })
}

/**
 * 获取钱包交易记录
 * @param {Object} params 分页参数 { pageNum: 1, pageSize: 10, transactionType: null, startTime: null, endTime: null }
 */
function getWalletTransactions(params = {}) {
  const { pageNum = 1, pageSize = 10, transactionType = null, startTime = null, endTime = null } = params
  return post('/wallet/transactions', {
    pageNum,
    pageSize,
    transactionType,
    startTime,
    endTime
  }, { showSuccess: false })
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
 * 查询未支付的快递订单
 * @returns {Promise} 返回未支付的订单号，如果没有则返回null
 */
function getPendingExpressOrder() {
  return get('/express/pending-order', {}, { showSuccess: false })
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
 * 根据经纬度获取附近的回收点
 * @param {Number} latitude 纬度
 * @param {Number} longitude 经度
 * @param {Number} radius 搜索半径（公里），可选
 */
function getRecyclingPointsByLocation(latitude, longitude, radius) {
  const params = { latitude, longitude }
  if (radius) {
    params.radius = radius
  }
  return get('/recycling-point/points-by-location', params, { showSuccess: false })
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
 * 获取订单支付详情（用于支付页面）
 * @param {string} orderNo 订单号
 */
function getPaymentDetail(orderNo) {
  return get('/pay/detail', { orderNo }, { showSuccess: false })
}

/**
 * 获取充值订单详情
 * @param {string} orderNo 订单号
 */
function getRechargeOrderDetail(orderNo) {
  return get('/recharge/detail', { orderNo }, { showSuccess: false })
}

/**
 * 压缩图片（小程序端）
 * @param {string} filePath 图片临时路径
 * @returns {Promise<string>} 压缩后的图片路径
 */
function compressImage(filePath) {
  return new Promise((resolve, reject) => {
    // 先获取原图大小
    wx.getFileInfo({
      filePath: filePath,
      success: (fileInfo) => {
        const originalSize = fileInfo.size
        const originalSizeMB = (originalSize / 1024 / 1024).toFixed(2)
        
        // 压缩图片
        wx.compressImage({
          src: filePath,
          quality: 80, // 压缩质量 0-100，80 是较好的平衡点
          success: (res) => {
            // 获取压缩后图片大小
            wx.getFileInfo({
              filePath: res.tempFilePath,
              success: (compressedInfo) => {
                const compressedSize = compressedInfo.size
                const compressedSizeMB = (compressedSize / 1024 / 1024).toFixed(2)
                const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
                
                console.log('图片压缩完成:', {
                  原始大小: `${originalSizeMB}MB (${originalSize} bytes)`,
                  压缩后大小: `${compressedSizeMB}MB (${compressedSize} bytes)`,
                  压缩率: `${compressionRatio}%`
                })
                
                resolve(res.tempFilePath)
              },
              fail: () => {
                // 获取压缩后大小失败，但压缩成功，仍然返回压缩后的路径
                console.log('图片压缩完成，但无法获取压缩后大小')
                resolve(res.tempFilePath)
              }
            })
          },
          fail: (error) => {
            console.warn('图片压缩失败，使用原图:', error)
            // 压缩失败时使用原图
            resolve(filePath)
          }
        })
      },
      fail: () => {
        // 获取原图大小失败，仍然尝试压缩
        wx.compressImage({
          src: filePath,
          quality: 80,
          success: (res) => {
            console.log('图片压缩完成（无法获取原图大小）')
            resolve(res.tempFilePath)
          },
          fail: (error) => {
            console.warn('图片压缩失败，使用原图:', error)
            resolve(filePath)
          }
        })
      }
    })
  })
}

/**
 * 上传图片（自动压缩）
 * @param {string} filePath 图片临时路径
 * @param {string} category 图片分类，默认为 'express'
 * @param {boolean} enableCompress 是否启用压缩，默认 true
 * @returns {Promise} 返回上传结果，包含图片URL
 */
function uploadImage(filePath, category = 'express', enableCompress = true) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    
    // 先压缩图片（如果启用）
    const processUpload = (finalFilePath) => {
      wx.uploadFile({
        url: `${API_CONFIG.baseURL}/media/upload/image`,
        filePath: finalFilePath,
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
    }
    
    // 如果需要压缩，先压缩再上传
    if (enableCompress) {
      compressImage(filePath).then(compressedPath => {
        processUpload(compressedPath)
      }).catch(error => {
        // 压缩失败时使用原图
        console.warn('图片压缩失败，使用原图:', error)
        processUpload(filePath)
      })
    } else {
      processUpload(filePath)
    }
  })
}

/**
 * 检查登录状态
 */
function checkLogin() {
  const token = getToken()
  return !!token
}

/**
 * 更新用户头像
 * @param {string} avatarUrl 头像URL
 */
function updateAvatar(avatarUrl) {
  return post('/user/profile/avatar', { avatarUrl }, { showSuccess: false })
}

/**
 * 更新个人资料（昵称）
 * @param {string} nickname 昵称
 */
function updateProfile(nickname) {
  return post('/user/profile/update', { nickname }, { showSuccess: false })
}

function getCouponDetail(id) {
  return get('/coupon/detail', { id }, { showSuccess: false })
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
  updateAvatar,
  updateProfile,

  // 地图相关
  reverseGeocode,
  geocode,
  
  // 图片上传
  uploadImage,
  
  // 驿站/取件相关
  getStationsByAddress,
  getAddressesByStation,
  getNearbyStations,
  getPendingExpressOrder,
  createExpressOrder,
  cancelExpressOrder,
  
  // 回收相关
  getRecyclingPointsByAddress,
  getRecyclingPointsByLocation,
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
  
  // 意见反馈相关
  submitFeedback,
  getPublicConfigs,
  getCustomerServicePhone,
  getWithdrawAmounts,
  getAllowFullWithdraw,
  getRechargeAmounts,
  getShareImage,
  getSharePath,
  getShareTitle,
  getConfigValue,
  
  // 支付相关（充值）
  createRecharge,
  getRechargeStatus,
  getRechargeOrderDetail,
  getPaymentProgress,
  refreshPaymentStatus,
  cancelRecharge,
  cancelRechargeOrder,
  createPayment,
  cancelThirdPartyPayment,
  continuePayment,
  
  // 钱包相关
  getWalletBalance,
  getPendingAmount,
  getWalletTransactions,
  
  // 提现相关
  createWithdraw,
  initiateWithdraw,
  continueWithdraw,
  getWithdrawDetail,
  getWithdrawOperateDetail,
  refreshTransferStatus,
  getWithdrawProgress,
  cancelTransfer,
  cancelWithdrawOrder,
  
  // 代金券相关
  getCouponTemplates,
  receiveCoupon,
  getUserCoupons,
  getAvailableCoupons,
  calculateCouponDiscount,
  calculateCouponDiscountByOrder,
  getUserCouponReceiveCount,
  getCouponDetail,
  
  // 邀请相关
  getMyReferralCode() {
    return get('/referral/my-code', {}, { showLoading: false, showError: false })
  },
  getReferralRecords(params) {
    return post('/referral/records', params, { showLoading: false, showError: false })
  },
  getReferrerInfoByCode(referralCode) {
    return get('/referral/referrer-info', { referralCode }, { showLoading: false, showError: false })
  },
  
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
  API_CONFIG,
  
  // 时间段可用性检查（单个时间段）
  checkTimeSlotAvailability(serviceType, startTime, endTime, stationId, recyclingPointId) {
    const params = {
      serviceType,
      startTime,
      endTime
    }
    if (stationId) {
      params.stationId = stationId
    }
    if (recyclingPointId) {
      params.recyclingPointId = recyclingPointId
    }
    return get('/schedule/check-availability', params, { showLoading: false, showError: false })
  },

  // 批量获取时间段列表（包含可用性信息）
  getTimeSlotList(serviceType, date, stationId, recyclingPointId) {
    const params = {
      serviceType,
      date // 格式：yyyy-MM-dd
    }
    if (stationId) {
      params.stationId = stationId
    }
    if (recyclingPointId) {
      params.recyclingPointId = recyclingPointId
    }
    return get('/schedule/time-slots', params, { showLoading: false, showError: false })
  },

  // 获取快递代取可预约时间范围
  getExpressAppointmentTime() {
    return get('/config/appointment-time/express', {}, { showLoading: false, showError: false })
  },

  // 获取上门回收可预约时间范围
  getRecyclingAppointmentTime() {
    return get('/config/appointment-time/recycling', {}, { showLoading: false, showError: false })
  },

  // 获取快递订单备注快捷选项
  getExpressRemarkOptions() {
    return get('/config/express-remark-options', {}, { showLoading: false, showError: false })
  },

  // 获取回收订单备注快捷选项
  getRecyclingRemarkOptions() {
    return get('/config/recycling-remark-options', {}, { showLoading: false, showError: false })
  },

  // ========== 公告相关 ==========
  /**
   * 获取当前用户应显示的公告（优先级最高的一个）
   */
  getCurrentAnnouncement() {
    return get('/announcement/current', {}, { showLoading: false, showError: false })
  },

  /**
   * 获取下一个公告
   * @param {number} currentPriority 当前公告的优先级
   * @param {number} currentAnnouncementId 当前公告ID（用于隐藏）
   * @param {boolean} hideToday 是否隐藏当前公告
   */
  getNextAnnouncement(currentPriority, currentAnnouncementId, hideToday = false) {
    return post('/announcement/next', {
      currentPriority,
      currentAnnouncementId,
      hideToday
    }, { showLoading: false, showError: false })
  },

  /**
   * 获取当前公告（忽略隐藏限制）
   */
  getCurrentAnnouncementIgnoreHide() {
    return get('/announcement/current/ignore-hide', {}, { showLoading: false, showError: false })
  },

  /**
   * 获取下一个公告（忽略隐藏限制）
   * @param {number} currentPriority 当前公告的优先级
   */
  getNextAnnouncementIgnoreHide(currentPriority) {
    return post('/announcement/next/ignore-hide', {
      currentPriority
    }, { showLoading: false, showError: false })
  },

  /**
   * 隐藏今日公告
   * @param {number} announcementId 公告ID
   */
  hideAnnouncementToday(announcementId) {
    return post('/announcement/hide', { announcementId }, { showLoading: false, showError: false })
  },

  // ========== 聊天相关 ==========
  /**
   * 获取用户会话列表
   * @param {Object} [params]
   * @param {number} [params.orderStatus] 1-进行中 2-已完成，不传默认进行中
   */
  getConversationList(params = {}) {
    return post('/conversation/list', params, { showLoading: false, showError: false })
  },

  /**
   * 获取会话详情
   * @param {number} conversationId 会话ID
   */
  getConversationDetail(conversationId) {
    return get('/conversation/detail', { conversationId }, { showLoading: false, showError: false })
  },

  /**
   * 创建会话（根据订单号）
   * @param {string} orderNo 订单号
   */
  createConversation(orderNo) {
    return post('/conversation/create', { orderNo }, { showLoading: false, showError: false })
  },

  /**
   * 发送消息
   * @param {Object} data 消息数据
   * @param {number} data.conversationId 会话ID
   * @param {number} data.messageType 消息类型（1-文本，2-图片，3-位置）
   * @param {string} data.content 文本内容（文本消息）
   * @param {string} data.imageUrl 图片URL（图片消息）
   * @param {number} data.locationLatitude 位置纬度（位置消息）
   * @param {number} data.locationLongitude 位置经度（位置消息）
   * @param {string} data.locationAddress 位置地址（位置消息）
   */
  sendMessage(data) {
    return post('/message/send', data, { showLoading: false, showError: false })
  },

  /**
   * 获取消息列表
   * @param {Object} params 查询参数
   * @param {number} params.conversationId 会话ID
   * @param {number} params.pageNum 页码（从1开始）
   * @param {number} params.pageSize 页大小
   */
  getMessageList(params) {
    return post('/message/list', params, { showLoading: false, showError: false })
  },

  /**
   * 获取未读消息统计（新接口）
   * 返回 { totalCount: 5, details: { "101": 2 } }
   */
  getUnreadStats() {
    return get('/message/unread/stats', {}, { showLoading: false, showError: false })
  },

  /**
   * 获取未读消息总数
   * 兼容旧调用，直接返回数字
   */
  async getUnreadMessageCount() {
    try {
      const res = await get('/message/unread/stats', {}, { showLoading: false, showError: false })
      if (res && res.success && res.data) {
        return {
          success: true,
          data: res.data.totalCount || 0
        }
      }
      return { success: false, data: 0 }
    } catch (e) {
      return { success: false, data: 0 }
    }
  },

  /**
   * 标记消息已读
   * @param {number} conversationId 会话ID
   */
  markAsRead(conversationId) {
    return post('/message/read', { conversationId }, { showLoading: false, showError: false })
  }
}
