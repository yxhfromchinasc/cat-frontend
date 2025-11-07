// pages/feedback/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    name: '',
    gender: '',
    phone: '',
    content: '',
    submitting: false
  },

  onLoad() {
    // 如果已登录，尝试填充用户信息
    if (api.checkLogin()) {
      this.loadUserInfo()
    }
  },

  async loadUserInfo() {
    try {
      const res = await api.getUserInfo()
      if (res && res.success && res.data) {
        const user = res.data
        this.setData({
          name: user.nickname || user.username || '',
          phone: user.phone || ''
        })
      }
    } catch (e) {
      console.error('加载用户信息失败:', e)
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  selectGender(e) {
    const gender = e.currentTarget.dataset.gender
    this.setData({ gender })
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  async submitFeedback() {
    const { name, gender, phone, content, submitting } = this.data

    if (submitting) return

    // 表单验证
    if (!name || !name.trim()) {
      wx.showToast({ title: '请输入您的称呼', icon: 'none' })
      return
    }

    if (!gender) {
      wx.showToast({ title: '请选择您的性别', icon: 'none' })
      return
    }

    if (!phone || !phone.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }

    // 手机号格式验证
    const phoneReg = /^1[3-9]\d{9}$/
    if (!phoneReg.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }

    if (!content || !content.trim()) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' })
      return
    }

    if (content.trim().length < 5) {
      wx.showToast({ title: '反馈内容至少5个字符', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const res = await api.submitFeedback({
        name: name.trim(),
        gender: gender === 'male' ? 1 : 2, // 1-男，2-女
        phone: phone.trim(),
        content: content.trim()
      })

      if (res && res.success) {
        wx.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' })
        this.setData({ submitting: false })
      }
    } catch (e) {
      console.error('提交反馈失败:', e)
      wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  }
})

