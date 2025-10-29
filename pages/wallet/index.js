// pages/wallet/index.js
const { api } = require('../../utils/util.js')

Page({
  data:{
    balance: 0
  },
  onShow(){
    this.loadBalance()
  },
  async loadBalance(){
    try{
      // 调用后端余额接口，后端会返回401如果未登录
      const res = await api.getUserInfo()
      if (res && res.success && res.data) {
        this.setData({ balance: res.data.balance || 0 })
      } else {
        this.setData({ balance: 0 })
      }
    }catch(e){
      this.setData({ balance: 0 })
    }
  },
  goRecharge(){
    wx.navigateTo({ url: '/pages/recharge/recharge' })
  },
  goWithdraw(){
    wx.navigateTo({ url: '/pages/withdraw/index' })
  }
})
