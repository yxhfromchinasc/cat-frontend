// pages/feedback/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    name: '',
    phone: '',
    content: '',
    submitting: false
  },

  onLoad() {
    // 不预填充任何信息，让用户自己填写
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  async submitFeedback() {
    const { name, phone, content, submitting } = this.data

    if (submitting) return

    // 表单验证
    if (!name || !name.trim()) {
      wx.showToast({ title: '请输入您的称呼', icon: 'none' })
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

