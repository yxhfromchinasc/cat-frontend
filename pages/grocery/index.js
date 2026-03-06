const { api } = require('../../utils/util.js')

Page({
  data: {
    defaultAddress: null,
    selectedAddressId: null,
    fromAddressSelect: false,
    groceryPoint: null,
    categoryList: [],
    selectedCategoryId: null,
    productList: [],
    cartMap: {}, // { productCode: quantity }
    cartCount: 0,
    cartItems: [],
    loadingGrocery: false,
    loadingProducts: false,
    showCartModal: false
  },

  async onShow() {
    // 再次进入选货页时也做待支付校验，避免有未支付订单时继续选货
    const hasPendingOrder = await this.checkUnpaidPayableOrder()
    if (hasPendingOrder) {
      return
    }
    if (this.data.fromAddressSelect && this.data.defaultAddress) {
      this.setData({ fromAddressSelect: false })
      this.loadGroceryPointsByAddress(this.data.selectedAddressId)
      return
    }
    if (!this.data.selectedAddressId) {
      this.loadDefaultAddress()
    }
  },

  onLoad() {
    // 待支付校验统一在 onShow 中执行，兼顾首次进入与再次进入选货页
  },

  // 检查是否有未支付的需要支付订单（快递代取 + 大件清运 + 杂货铺）
  async checkUnpaidPayableOrder() {
    try {
      const res = await api.getPendingExpressOrder()
      if (res.success && res.data && res.data.orderNo) {
        const { orderNo, serviceType } = res.data
        wx.showModal({
          title: '提示',
          content: '当前有订单未支付，请前往详情页支付',
          confirmText: '前往支付',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              let url = ''
              if (serviceType === 2) {
                url = `/pages/express-detail/index?orderNo=${orderNo}`
              } else if (serviceType === 5) {
                url = `/pages/removal-detail/index?orderNo=${orderNo}`
              } else if (serviceType === 6) {
                url = `/pages/grocery-detail/index?orderNo=${orderNo}`
              }
              if (url) {
                wx.redirectTo({ url })
              }
            } else {
              wx.navigateBack()
            }
          }
        })
        return true
      }
      return false
    } catch (e) {
      console.error('检查未支付订单失败', e)
      return false
    }
  },

  async loadDefaultAddress() {
    try {
      const res = await api.getDefaultAddress()
      if (res.success && res.data) {
        const addr = res.data
        this.setData({
          defaultAddress: addr,
          selectedAddressId: addr.id
        })
        await this.loadGroceryPointsByAddress(addr.id)
      }
    } catch (e) {
      console.error('加载默认地址失败', e)
    }
  },

  async loadGroceryPointsByAddress(addressId) {
    if (!addressId) {
      this.setData({
        groceryPoint: null,
        productList: [],
        loadingGrocery: false
      })
      return
    }
    this.setData({ loadingGrocery: true })
    try {
      const res = await api.getGroceryPointsByAddress(addressId)
      if (res.success && res.data && res.data.length > 0) {
        const point = res.data[0]
        this.setData({
          groceryPoint: point,
          loadingGrocery: false,
          selectedCategoryId: null
        })
        this.loadCategories(point.id)
        this.loadProducts(point.id, null)
      } else {
        this.setData({
          groceryPoint: null,
          productList: [],
          loadingGrocery: false
        })
      }
    } catch (e) {
      console.error('加载杂货铺失败', e)
      this.setData({
        groceryPoint: null,
        productList: [],
        loadingGrocery: false
      })
    }
  },

  async loadCategories(groceryPointId) {
    if (!groceryPointId) return
    try {
      const res = await api.getGroceryCategories(groceryPointId)
      if (res.success && res.data) {
        this.setData({ categoryList: res.data })
      } else {
        this.setData({ categoryList: [] })
      }
    } catch (e) {
      console.error('加载分类失败', e)
      this.setData({ categoryList: [] })
    }
  },

  selectCategory(e) {
    const raw = e.currentTarget.dataset.id
    const id = (raw === 'all' || raw === '' || raw === undefined) ? null : raw
    const groceryPointId = this.data.groceryPoint && this.data.groceryPoint.id
    if (!groceryPointId) return
    this.setData({ selectedCategoryId: id })
    this.loadProducts(groceryPointId, id)
  },

  async loadProducts(groceryPointId, categoryId) {
    if (!groceryPointId) return
    this.setData({ loadingProducts: true })
    try {
      const res = await api.getGroceryProducts(groceryPointId, categoryId)
      if (res.success && res.data) {
        this.setData({
          productList: res.data,
          loadingProducts: false
        })
      } else {
        this.setData({ productList: [], loadingProducts: false })
      }
    } catch (e) {
      console.error('加载商品失败', e)
      this.setData({ productList: [], loadingProducts: false })
    }
  },

  selectAddress() {
    if (!this.data.defaultAddress) {
      wx.navigateTo({ url: '/pages/address/index' })
    } else {
      wx.navigateTo({
        url: `/pages/address/select?currentAddressId=${this.data.selectedAddressId}`
      })
    }
  },

  updateCartDisplay() {
    const cartCount = this.getCartCount()
    const cartItems = this.getCartItems()
    this.setData({ cartCount, cartItems })
  },

  onPlus(e) {
    const code = e.currentTarget.dataset.code
    const stock = parseInt(e.currentTarget.dataset.stock, 10) || 0
    const cartMap = { ...this.data.cartMap }
    const cur = cartMap[code] || 0
    if (stock <= 0 || cur >= stock) return
    cartMap[code] = cur + 1
    this.setData({ cartMap }, () => this.updateCartDisplay())
  },

  onMinus(e) {
    const code = e.currentTarget.dataset.code
    const cartMap = { ...this.data.cartMap }
    const cur = cartMap[code] || 0
    if (cur <= 0) return
    cartMap[code] = cur - 1
    if (cartMap[code] === 0) delete cartMap[code]
    this.setData({ cartMap }, () => this.updateCartDisplay())
  },

  onCartPlus(e) {
    this.onPlus(e)
  },

  onCartMinus(e) {
    this.onMinus(e)
  },

  showCartModal() {
    this.setData({ showCartModal: true })
  },

  hideCartModal() {
    this.setData({ showCartModal: false })
  },

  async goToConfirm() {
    const cartCount = this.getCartCount()
    if (cartCount <= 0) {
      wx.showToast({ title: '请先选择商品', icon: 'none' })
      return
    }
    if (!this.data.defaultAddress) {
      wx.showToast({ title: '请先选择配送地址', icon: 'none' })
      return
    }
    if (!this.data.groceryPoint) {
      wx.showToast({ title: '该地址暂无杂货铺', icon: 'none' })
      return
    }
    // 若当前在分类视图，先加载全部商品以获取完整购物车（含库存）
    let productList = this.data.productList
    if (this.data.selectedCategoryId != null) {
      const res = await api.getGroceryProducts(this.data.groceryPoint.id, null)
      if (res.success && res.data) {
        productList = res.data
        this.setData({ productList })
      }
    }
    const cartItems = this.getCartItemsFromList(productList)
    const overStock = cartItems.find(i => (i.stock != null ? i.stock : 0) < (i.quantity || 0))
    if (overStock) {
      wx.showToast({ title: `「${overStock.name}」库存不足，请调整数量`, icon: 'none', duration: 2500 })
      return
    }
    const items = cartItems.map(item => ({
      productCode: item.productCode,
      productId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotalAmount: item.price * item.quantity
    }))
    const amount = items.reduce((sum, i) => sum + i.subtotalAmount, 0)
    const priceDetail = items.map(i => `${i.productCode} x${i.quantity} ￥${i.subtotalAmount}`).join('; ')
    getApp().globalData.groceryConfirmData = {
      address: this.data.defaultAddress,
      groceryPoint: this.data.groceryPoint,
      items,
      amount,
      priceDetail
    }
    wx.navigateTo({ url: '/pages/grocery/confirm' })
  },

  getCartCount() {
    const cartMap = this.data.cartMap || {}
    return Object.values(cartMap).reduce((a, b) => a + b, 0)
  },

  getCartItems() {
    return this.getCartItemsFromList(this.data.productList || [])
  },

  getCartItemsFromList(productList) {
    const cartMap = this.data.cartMap || {}
    return (productList || [])
      .filter(p => (cartMap[p.productCode] || 0) > 0)
      .map(p => ({
        ...p,
        quantity: cartMap[p.productCode] || 0
      }))
  }
})
