// pages/address/select.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    addressList: [],
    loading: true,
    selectedId: null // 当前选中的地址ID
  },

  onLoad(options) {
    // 从首页传过来的当前地址ID
    if (options.currentAddressId) {
      this.setData({ selectedId: parseInt(options.currentAddressId) })
    }
    this.loadAddressList()
  },

  async loadAddressList() {
    this.setData({ loading: true })
    try {
      const res = await api.getAddressList(1, 100)
      const list = res.success ? (res.data.list || []).filter(addr => addr.status === 1) : []
      this.setData({ addressList: list, loading: false })
    } catch (e) {
      this.setData({ addressList: [], loading: false })
    }
  },

  // 选择地址
  selectAddress(e) {
    const addressId = parseInt(e.currentTarget.dataset.id)
    
    // 从地址列表中查找选中的地址
    const address = this.data.addressList.find(addr => addr.id === addressId)
    if (!address) {
      return
    }
    
    // 更新选中状态
    this.setData({ selectedId: addressId })
    
    // 返回首页，并更新首页的地址信息
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2] // 上一页是首页
    
    if (prevPage && prevPage.route === 'pages/index/index') {
      // 更新首页的地址
      prevPage.setData({ currentAddress: address })
    }
    
    // 延迟返回，让用户看到选中效果
    setTimeout(() => {
      wx.navigateBack()
    }, 200)
  },

  // 跳转到地址管理页面
  goToAddressManage() {
    wx.navigateTo({ url: '/pages/address/index' })
  }
})

