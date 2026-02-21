// pages/wallet/index.js
const { api } = require('../../utils/util.js')
const amount = require('../../utils/amount.js')

Page({
  data:{
    balance: 0,
    balanceStr: '0.00',
    pendingAmount: 0,
    pendingAmountStr: '0.00',
    transactions: [], // 交易记录列表
    loading: false,
    pageNum: 1, // 当前页码（从1开始）
    pageSize: 20,
    hasMore: true // 是否还有更多数据
  },
  onShow(){
    this.loadBalance()
    this.loadPendingAmount()
    this.loadTransactions(true) // 刷新交易记录
  },
  async loadBalance(){
    try{
      // 调用后端钱包余额接口
      const res = await api.getWalletBalance()
      if (res && res.success && res.data != null) {
        const bal = amount.parseBigDecimalLike(res.data, 0)
        this.setData({ balance: bal, balanceStr: amount.formatAmount(bal) })
      } else {
        this.setData({ balance: 0, balanceStr: '0.00' })
      }
    }catch(e){
      console.error('加载余额失败')
      this.setData({ balance: 0, balanceStr: '0.00' })
    }
  },
  async loadPendingAmount(){
    try{
      // 调用后端待入账金额接口
      const res = await api.getPendingAmount()
      if (res && res.success && res.data != null) {
        const pending = amount.parseBigDecimalLike(res.data, 0)
        this.setData({ 
          pendingAmount: pending, 
          pendingAmountStr: amount.formatAmount(pending) 
        })
      } else {
        this.setData({ pendingAmount: 0, pendingAmountStr: '0.00' })
      }
    }catch(e){
      console.error('加载待入账金额失败')
      this.setData({ pendingAmount: 0, pendingAmountStr: '0.00' })
    }
  },
  goRecharge(){
    wx.navigateTo({ url: '/pages/recharge/recharge' })
  },
  goWithdraw(){
    wx.navigateTo({ url: '/pages/withdraw/index' })
  },

  // 加载交易记录
  async loadTransactions(refresh = false) {
    if (this.data.loading) return
    
    // 如果是刷新，重置页码和数据
    if (refresh) {
      this.setData({
        pageNum: 1,
        transactions: [],
        hasMore: true
      })
    }

    // 如果没有更多数据，不加载
    if (!this.data.hasMore && !refresh) {
      return
    }

    try {
      this.setData({ loading: true })
      
      const res = await api.getWalletTransactions({
        pageNum: this.data.pageNum,
        pageSize: this.data.pageSize
      })
      
      if (res && res.success && res.data) {
        const pageResult = res.data
        
        // 后端返回的是 PageResult 格式：{ list: [], total: 0, page: 1, pageSize: 20 }
        let transactions = []
        if (pageResult.list && Array.isArray(pageResult.list)) {
          transactions = pageResult.list
        } else if (Array.isArray(pageResult)) {
          // 兼容直接返回数组的情况
          transactions = pageResult
        }

        // 处理交易记录数据
        const formattedTransactions = transactions.map(tx => this.formatTransaction(tx))
        
        // 合并或替换交易记录
        const newTransactions = refresh 
          ? formattedTransactions 
          : [...this.data.transactions, ...formattedTransactions]
        
        // 判断是否还有更多数据（基于总数和已加载数量）
        const total = pageResult.total || 0
        const loadedCount = newTransactions.length
        const hasMore = loadedCount < total
        
        this.setData({
          transactions: newTransactions,
          hasMore: hasMore,
          pageNum: refresh ? 2 : this.data.pageNum + 1,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('加载交易记录失败')
      this.setData({ loading: false })
    }
  },

  // 格式化交易记录
  formatTransaction(tx) {
    // 处理交易类型
    const typeMap = {
      1: { name: '充值', icon: '/assets/tabbar/充值--.png', iconType: 'image', color: '#4CAF50' },
      2: { name: '消费', icon: '/assets/tabbar/高消费.png', iconType: 'image', color: '#F44336' },
      4: { name: '冻结', icon: '/assets/tabbar/锁定.png', iconType: 'image', color: '#FF9800' },
      5: { name: '解冻', icon: '/assets/tabbar/解冻.png', iconType: 'image', color: '#2196F3' },
      6: { name: '推荐奖励', icon: '/assets/tabbar/奖励.png', iconType: 'image', color: '#9C27B0' },
      7: { name: '提现', icon: '/assets/tabbar/提现-+.png', iconType: 'image', color: '#F44336' }
    }
    let typeInfo = typeMap[tx.transactionType] || { name: '未知', icon: '❓', iconType: 'emoji', color: '#757575' }
    
    // 对于提现类型（类型7），根据金额和描述判断是提现还是提现退款
    if (tx.transactionType === 7) {
      const description = tx.description || ''
      const amt = amount.parseBigDecimalLike(tx.amount, 0)
      // 如果金额为正数（退款）或描述包含"退款"，显示为"提现退款"
      if (amt > 0 || description.includes('退款')) {
        typeInfo = { name: '提现退款', icon: '/assets/tabbar/充值--.png', iconType: 'image', color: '#4CAF50' }
      }
    }
    
    // 处理交易金额
    const amt = amount.parseBigDecimalLike(tx.amount, 0)
    
    // 判断是收入还是支出（金额为正数是收入，负数是支出）
    const isIncome = amt > 0
    const amountStr = isIncome ? `+¥${amount.formatAmount(Math.abs(amt))}` : `-¥${amount.formatAmount(Math.abs(amt))}`
    
    // 格式化时间
    let timeStr = ''
    if (tx.createdAt) {
      try {
        const date = new Date(tx.createdAt)
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const day = date.getDate().toString().padStart(2, '0')
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        timeStr = `${year}-${month}-${day} ${hours}:${minutes}`
      } catch (e) {
        // 如果解析失败，尝试直接使用原始字符串
        timeStr = tx.createdAt.substring(0, 16) || tx.createdAt
      }
    }
    
    return {
      ...tx,
      typeName: typeInfo.name,
      typeIcon: typeInfo.icon,
      typeIconType: typeInfo.iconType,
      typeColor: typeInfo.color,
      amount: amt,
      amountStr: amountStr,
      isIncome: isIncome,
      timeStr: timeStr
    }
  },

  // 加载更多交易记录
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.loadTransactions(false)
  },

  // 分享给好友
  onShareAppMessage() {
    const app = getApp()
    const shareImageUrl = app.getShareImageUrl()
    const sharePath = app.getSharePath()
    const shareTitle = app.getShareTitle()
    const shareConfig = {
      title: shareTitle, // 使用配置的分享标题
      path: sharePath // 使用配置的分享路径
    }
    // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
    if (shareImageUrl) {
      shareConfig.imageUrl = shareImageUrl
    }
    return shareConfig
  },

})
