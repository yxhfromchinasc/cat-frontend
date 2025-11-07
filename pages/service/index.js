// pages/service/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    servicePhone: '',
    serviceWechat: '',
    serviceEmail: '',
    workTime: '',
    loading: false
  },

  onLoad() {
    this.loadServiceInfo()
  },

  async loadServiceInfo() {
    this.setData({ loading: true })
    try {
      // 获取所有公开的配置
      const res = await api.getPublicConfigs()
      if (res && res.success && res.data) {
        const configs = res.data
        // 确保从后端获取真实数据，如果没有数据则显示空
        this.setData({
          servicePhone: configs.customer_service_phone || '',
          serviceWechat: configs.customer_service_wechat || '',
          serviceEmail: configs.customer_service_email || '',
          workTime: configs.customer_service_work_time || ''
        })
        
        // 如果没有任何客服信息，提示用户
        if (!configs.customer_service_phone && !configs.customer_service_wechat && !configs.customer_service_email) {
          console.warn('未配置客服信息')
        }
      } else {
        console.error('获取客服信息失败:', res)
        api.showError(res.message || '加载客服信息失败')
      }
    } catch (e) {
      console.error('加载客服信息失败:', e)
      api.showError('加载客服信息失败，请稍后重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 拨打电话
  makePhoneCall(e) {
    const phone = e.currentTarget.dataset.phone
    if (!phone) {
      api.showError('电话号码不能为空')
      return
    }
    
    // 先询问用户是否拨打
    wx.showModal({
      title: '拨打客服电话',
      content: `确定要拨打 ${phone} 吗？`,
      confirmText: '拨打',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 用户确认后拨打
          wx.makePhoneCall({
            phoneNumber: phone,
            success: () => {
              console.log('拨打电话成功')
            },
            fail: (err) => {
              console.error('拨打电话失败:', err)
              if (err.errMsg && err.errMsg.includes('cancel')) {
                // 用户取消拨打，不显示错误
                return
              }
              api.showError('拨打电话失败，请稍后重试')
            }
          })
        }
      }
    })
  },

  // 复制微信
  copyWechat(e) {
    const wechat = e.currentTarget.dataset.wechat
    if (!wechat) {
      api.showError('微信号不能为空')
      return
    }
    wx.setClipboardData({
      data: wechat,
      success: () => {
        api.showSuccess('微信号已复制到剪贴板')
      },
      fail: (err) => {
        console.error('复制失败:', err)
        api.showError('复制失败，请稍后重试')
      }
    })
  },

  // 复制邮箱
  copyEmail(e) {
    const email = e.currentTarget.dataset.email
    if (!email) {
      api.showError('邮箱地址不能为空')
      return
    }
    wx.setClipboardData({
      data: email,
      success: () => {
        api.showSuccess('邮箱地址已复制到剪贴板')
      },
      fail: (err) => {
        console.error('复制失败:', err)
        api.showError('复制失败，请稍后重试')
      }
    })
  }
})

