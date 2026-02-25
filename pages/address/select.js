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
    
    // 获取上一页（可能是首页、订单发起页等）
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    
    if (prevPage) {
      // 如果是首页，更新首页的地址
      if (prevPage.route === 'pages/index/index') {
        prevPage.setData({ currentAddress: address })
      }
      // 如果是订单发起页面（快递、回收、大件清运），更新其地址
      else if (prevPage.route === 'pages/pickup/index' || prevPage.route === 'pages/recycle/index' || prevPage.route === 'pages/removal/index') {
        prevPage.setData({
          defaultAddress: address,
          selectedAddressId: addressId,
          fromAddressSelect: true // 标记从地址选择页面返回
        })
        if (prevPage.route === 'pages/pickup/index' && typeof prevPage.loadStationsByAddress === 'function') {
          prevPage.loadStationsByAddress(addressId)
        } else if (prevPage.route === 'pages/recycle/index' && typeof prevPage.loadRecyclingPointsByAddress === 'function') {
          prevPage.loadRecyclingPointsByAddress(addressId)
        } else if (prevPage.route === 'pages/removal/index' && typeof prevPage.loadRemovalPointsByAddress === 'function') {
          prevPage.loadRemovalPointsByAddress(addressId)
        }
      }
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

