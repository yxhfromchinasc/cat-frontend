// pages/withdraw-operate/index.js - 提现操作页（类似支付页，支持发起提现和继续提现）
const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')
const withdrawUtils = require('../../utils/withdraw.js')

Page({
  data: {
    orderNo: '',
    withdrawDetail: null, // 提现详情（从后端获取）
    
    // 金额信息
    amount: 0,
    amountStr: '0.00',
    actualAmount: 0,
    actualAmountStr: '0.00',
    feeStr: '0.00',
    
    // 转账过期时间倒计时
    transferExpireTime: null,
    transferRemainSeconds: 0,
    transferRemainStr: '',
    
    // 允许的操作按钮列表
    allowedActions: [],
    
    submitting: false,
    loading: true,
    // 自定义倒计时加载UI
    showWithdrawLoading: false,
    withdrawLoadingCountdown: 0
  },

  onLoad(options) {
    const orderNo = options?.orderNo || ''
    if (!orderNo) {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    this.setData({ orderNo })
    this.loadWithdrawDetail()
  },

  onShow() {
    // 每次显示时刷新订单详情
    if (this.data.orderNo) {
      this.loadWithdrawDetail()
    }
  },

  onUnload() {
    // 清理倒计时
    this.clearTransferRemainCountdown()
  },

  // 加载提现详情
  async loadWithdrawDetail() {
    const { orderNo } = this.data
    try {
      wx.showLoading({ title: '加载中...' })
      const res = await api.getWithdrawOperateDetail(orderNo)
      
      if (res && res.success && res.data) {
        const detail = res.data
        const amt = amount.parseBigDecimalLike(detail.amount, 0)
        const actAmt = amount.parseBigDecimalLike(detail.actualAmount != null ? detail.actualAmount : detail.amount, 0)
        const fee = amount.parseBigDecimalLike(detail.fee, 0)
        
        // 从后端获取 transferExpireTime
        const transferExpireTime = detail.transferExpireTime || null
        
        // 判断是否为提现中状态（withdrawStatus === 2 表示提现中）
        const isWithdrawing = detail.withdrawStatus === 2
        
        // 操作页只显示操作相关的按钮，过滤掉取消订单相关的按钮
        const allActions = detail.allowedActions || []
        const operateActions = allActions.filter(action => 
          action === 'WITHDRAW' || 
          action === 'CONTINUE_WITHDRAW' || 
          action === 'CANCEL_TRANSFER'
        )
        
        this.setData({
          withdrawDetail: detail,
          transferExpireTime,
          amount: amt,
          amountStr: amount.formatAmount(amt),
          actualAmount: actAmt,
          actualAmountStr: amount.formatAmount(actAmt),
          feeStr: amount.formatAmount(fee),
          allowedActions: operateActions, // 操作页只显示操作相关的按钮
          loading: false
        })
        
        // 如果是提现中状态且有转账过期时间，启动倒计时
        if (isWithdrawing && transferExpireTime) {
          this.startTransferRemainCountdown(transferExpireTime)
        }
      } else {
        wx.showToast({ title: res?.message || '加载失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('获取提现订单详情失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    } finally {
      wx.hideLoading()
    }
  },

  // 启动转账剩余时间倒计时
  startTransferRemainCountdown(expireTimeStr) {
    this.clearTransferRemainCountdown()
    
    const updateCountdown = () => {
      try {
        const expireTime = new Date(expireTimeStr.replace(/-/g, '/'))
        const now = new Date()
        const diff = Math.floor((expireTime - now) / 1000)
        
        if (diff <= 0) {
          this.setData({ transferRemainSeconds: 0, transferRemainStr: '已过期' })
          this.clearTransferRemainCountdown()
          return
        }
        
        const minutes = Math.floor(diff / 60)
        const seconds = diff % 60
        const remainStr = `${minutes}分${seconds}秒`
        
        this.setData({ transferRemainSeconds: diff, transferRemainStr: remainStr })
      } catch (e) {
        console.error('计算剩余时间失败', e)
        this.clearTransferRemainCountdown()
      }
    }
    
    updateCountdown()
    this._transferRemainTimer = setInterval(updateCountdown, 1000)
  },

  // 清理转账剩余时间倒计时
  clearTransferRemainCountdown() {
    if (this._transferRemainTimer) {
      clearInterval(this._transferRemainTimer)
      this._transferRemainTimer = null
    }
  },

  // 调起确认收款页面（商家转账升级版）
  // 参考文档: https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/miniapp/api/miniapp/openBusinessView.html
  async requestUserConfirmReceipt(packageInfoStr) {
    return new Promise((resolve, reject) => {
      try {
        if (!packageInfoStr || typeof packageInfoStr !== 'string') {
          console.error('packageInfo 参数无效:', packageInfoStr)
          reject(new Error('确认收款参数无效'))
          return
        }

        // 检查 packageInfo 是否为空或格式不正确
        if (packageInfoStr.trim().length === 0) {
          console.error('packageInfo 为空字符串')
          reject(new Error('确认收款参数为空'))
          return
        }

        // 记录 packageInfo 长度（不打印完整内容，避免敏感信息）
        console.log('调起确认收款，packageInfo 长度:', packageInfoStr.length)
        console.log('packageInfo 前50个字符:', packageInfoStr.substring(0, 50))

        // 检查 packageInfo 是否包含特殊字符（base64 编码应该只包含 A-Z, a-z, 0-9, +, /, =）
        const base64Pattern = /^[A-Za-z0-9+/=]+$/
        if (!base64Pattern.test(packageInfoStr)) {
          console.error('packageInfo 格式不正确，不是有效的 base64 编码')
          reject(new Error('确认收款参数格式错误'))
          return
        }

        // 根据官方文档：https://pay.weixin.qq.com/doc/v3/merchant/4012716430
        // 使用 wx.requestMerchantTransfer 调起用户确认收款
        // 参数说明：
        // - mchId: 商户号，和发起转账传入的mchid必须是同一个
        // - appId: 商户绑定的AppID，和发起转账传入的appid必须是同一个
        // - package: package_info，从发起转账接口返回
        
        // 获取商户号和AppID（从配置中获取，或从后端返回）
        const mchId = '1731392706' // 商户号
        // 获取小程序 AppID（推荐使用动态获取）
        let appId = 'wxd4ebe905e33c7b07' // 默认AppID
        try {
          const accountInfo = wx.getAccountInfoSync()
          if (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.appId) {
            appId = accountInfo.miniProgram.appId
          }
        } catch (e) {
          console.warn('获取小程序AppID失败，使用默认值:', e)
        }
        
        console.log('准备调用 wx.requestMerchantTransfer')
        console.log('参数 - mchId:', mchId)
        console.log('参数 - appId:', appId)
        console.log('参数 - package 长度:', packageInfoStr.length)
        
        // 检查 API 是否支持
        if (!wx.canIUse('requestMerchantTransfer')) {
          console.error('wx.requestMerchantTransfer API 不可用，请检查微信版本')
          wx.showModal({
            title: '提示',
            content: '你的微信版本过低，请更新至最新版本。',
            showCancel: false,
            success: () => {
              reject(new Error('微信版本不支持此功能'))
            }
          })
          return
        }
        
        // 调用 wx.requestMerchantTransfer
        wx.requestMerchantTransfer({
          mchId: mchId,
          appId: appId,
          package: packageInfoStr, // package_info 已经是 base64 编码的字符串
          success: (res) => {
            console.log('调起确认收款成功:', res)
            // res.err_msg 将在页面展示成功后返回应用时返回 ok，并不代表付款成功
            resolve(res)
          },
          fail: (err) => {
            console.error('调起确认收款失败:', err)
            console.error('失败详情 - errMsg:', err?.errMsg)
            console.error('失败详情 - 完整错误对象:', JSON.stringify(err))
            
            // 根据错误类型提供更友好的提示
            let errorMsg = '调起确认收款失败'
            if (err?.errMsg) {
              errorMsg = err.errMsg
              
              // 针对常见错误提供更友好的提示
              if (err.errMsg.includes('cancel') || err.errMsg.includes('取消')) {
                // 用户取消操作
                reject({ cancelled: true, errMsg: err.errMsg })
                return
              } else if (err.errMsg.includes('fail') || err.errMsg.includes('internal')) {
                errorMsg = '调起确认收款失败，可能是配置问题，请联系客服'
              }
            } else if (err?.message) {
              errorMsg = err.message
            }
            
            reject(new Error(errorMsg))
          }
        })
      } catch (e) {
        console.error('调起确认收款异常:', e)
        reject(e)
      }
    })
  },


  // 发起提现：发起转账申请
  async handleInitiateWithdraw() {
    if (this.data.submitting) return
    
    const { orderNo } = this.data
    
    if (!orderNo) {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      api.showLoadingToast('发起转账...')
      
      // 发起转账申请（调用第三方API获取packageInfo）
      // 从订单详情中获取提现方式，默认为微信零钱（1）
      const withdrawMethod = (this.data.withdrawDetail && this.data.withdrawDetail.withdrawMethod) || 1
      const initiateRes = await api.initiateWithdraw(orderNo, withdrawMethod)
      
      if (!initiateRes.success || !initiateRes.data) {
        throw new Error(initiateRes.message || initiateRes.error || '发起转账申请失败')
      }
      
      const { packageInfo } = initiateRes.data
      
      if (!packageInfo) {
        console.error('后端返回的 packageInfo 为空:', initiateRes.data)
        throw new Error('未获取到确认收款参数')
      }
      
      // 检查 packageInfo 格式
      if (typeof packageInfo !== 'string') {
        console.error('packageInfo 类型错误，应为字符串，实际为:', typeof packageInfo, packageInfo)
        throw new Error('确认收款参数格式错误')
      }
      
      console.log('获取到 packageInfo，长度:', packageInfo.length)
      
      api.hideLoadingToast()
      
      // 调起确认收款页面
      try {
        await this.requestUserConfirmReceipt(packageInfo)
        
        // 确认收款调起成功，进入5秒短轮询（自定义倒计时加载，不使用系统Loading）
        // 快速确认：先触发一次直查回补，再查进度；若已得出结论则不进入倒计时
        try {
          try { await api.refreshTransferStatus(orderNo) } catch (_) {}
          const quick = await api.getWithdrawProgress(orderNo)
          if (quick && quick.success && quick.data) {
            const st = quick.data.withdrawStatus
            if (st === 'success') {
              wx.showToast({ title: '提现成功', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 1200)
              return
            } else if (st === 'failed') {
              wx.showToast({ title: '提现失败', icon: 'none' })
              return
            }
          }
        } catch (_) { /* 忽略，进入倒计时兜底 */ }

        // 进入5秒短轮询确认（展示自定义倒计时 UI）
        try {
          const result = await withdrawUtils.pollWithdrawProgress(orderNo, 5, this)
          if (result.withdrawStatus === 'success') {
            wx.showToast({ title: '提现成功', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1200)
          } else if (result.withdrawStatus === 'failed') {
            wx.showToast({ title: '提现失败', icon: 'none' })
          } else {
            wx.showToast({ title: '提现处理中，请稍后在订单查看', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '确认提现结果失败', icon: 'none' })
        }
        
      } catch (receiptError) {
        // 用户取消确认收款
        if (receiptError.cancelled) {
          wx.showToast({ title: '已取消确认收款', icon: 'none' })
        } else {
          wx.showToast({ 
            title: receiptError.message || '确认收款失败', 
            icon: 'none',
            duration: 3000
          })
        }
      }
    } catch (error) {
      api.hideLoadingToast()
      console.error('发起提现失败:', error)
      const errorMessage = error.message || error.error || '发起提现失败，请稍后重试'
      wx.showToast({ 
        title: errorMessage, 
        icon: 'none',
        duration: 3000
      })
      this.setData({ submitting: false })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 继续提现：调起确认收款页面
  async handleContinueWithdraw() {
    if (this.data.submitting) return
    
    const { orderNo } = this.data
    
    if (!orderNo) {
      wx.showToast({ title: '订单号不能为空', icon: 'none' })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      api.showLoadingToast('继续提现...')
      
      // 继续提现（如果有保存的参数且未过期，会直接返回；否则重新创建）
      const continueRes = await api.continueWithdraw(orderNo)
      
      if (!continueRes.success || !continueRes.data) {
        throw new Error(continueRes.message || continueRes.error || '继续提现失败')
      }
      
      const { packageInfo } = continueRes.data
      
      if (!packageInfo) {
        console.error('后端返回的 packageInfo 为空:', continueRes.data)
        throw new Error('未获取到确认收款参数')
      }
      
      // 检查 packageInfo 格式
      if (typeof packageInfo !== 'string') {
        console.error('packageInfo 类型错误，应为字符串，实际为:', typeof packageInfo, packageInfo)
        throw new Error('确认收款参数格式错误')
      }
      
      console.log('获取到 packageInfo，长度:', packageInfo.length)
      
      api.hideLoadingToast()
      
      // 调起确认收款页面
      try {
        await this.requestUserConfirmReceipt(packageInfo)
        
        // 确认收款调起成功，进入5秒短轮询（自定义倒计时加载，不使用系统Loading）
        // 快速确认：先触发一次直查回补，再查进度；若已得出结论则不进入倒计时
        try {
          try { await api.refreshTransferStatus(orderNo) } catch (_) {}
          const quick = await api.getWithdrawProgress(orderNo)
          if (quick && quick.success && quick.data) {
            const st = quick.data.withdrawStatus
            if (st === 'success') {
              wx.showToast({ title: '提现成功', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 1200)
              return
            } else if (st === 'failed') {
              wx.showToast({ title: '提现失败', icon: 'none' })
              return
            }
          }
        } catch (_) { /* 忽略，进入倒计时兜底 */ }

        // 进入5秒短轮询确认（展示自定义倒计时 UI）
        try {
          const result = await withdrawUtils.pollWithdrawProgress(orderNo, 5, this)
          if (result.withdrawStatus === 'success') {
            wx.showToast({ title: '提现成功', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1200)
          } else if (result.withdrawStatus === 'failed') {
            wx.showToast({ title: '提现失败', icon: 'none' })
          } else {
            wx.showToast({ title: '提现处理中，请稍后在订单查看', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '确认提现结果失败', icon: 'none' })
        }
        
      } catch (receiptError) {
        // 用户取消确认收款
        if (receiptError.cancelled) {
          wx.showToast({ title: '已取消确认收款', icon: 'none' })
        } else {
          wx.showToast({ 
            title: receiptError.message || '确认收款失败', 
            icon: 'none',
            duration: 3000
          })
        }
      }
    } catch (error) {
      api.hideLoadingToast()
      console.error('继续提现失败:', error)
      const errorMessage = error.message || error.error || '继续提现失败，请稍后重试'
      wx.showToast({ 
        title: errorMessage, 
        icon: 'none',
        duration: 3000
      })
      this.setData({ submitting: false })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 处理操作按钮点击
  async handleAction(e) {
    const action = e.currentTarget.dataset.action
    if (action === 'WITHDRAW') {
      // 发起提现
      await this.handleInitiateWithdraw()
    } else if (action === 'CONTINUE_WITHDRAW') {
      // 继续提现
      await this.handleContinueWithdraw()
    } else if (action === 'CANCEL_TRANSFER') {
      // 取消本次提现
      await this.onCancel()
    }
  },

  // 取消当次提现
  async onCancel() {
    const { orderNo } = this.data
    if (!orderNo) {
      wx.navigateBack()
      return
    }
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消本次提现吗？取消后可稍后重新提现。',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '取消中...' })
          const cancelRes = await api.cancelTransfer(orderNo)
          wx.hideLoading()
          if (cancelRes && cancelRes.success) {
            wx.showToast({ title: '已取消本次提现', icon: 'success' })
            // 刷新订单详情
            this.loadWithdrawDetail()
          } else {
            wx.showToast({ title: cancelRes?.message || '取消失败', icon: 'none' })
          }
        } catch (e) {
          wx.hideLoading()
          console.error('取消当次提现失败', e)
          wx.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    })
  }
})

