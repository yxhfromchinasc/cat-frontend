// pages/orders/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    // 订单列表
    orderList: [],
    
    // 当前选中的状态筛选：null-全部，1-进行中，2-已完成
    currentStatus: null,
    
    // 分页相关
    pageNum: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    
    // 状态筛选选项
    statusOptions: [
      { label: '全部订单', value: null },
      { label: '进行中', value: 1 },
      { label: '已完成', value: 2 }
    ]
  },

  onLoad() {
    this.loadOrders(true)
  },

  onShow() {
    // 页面显示时刷新订单列表
    this.setData({
      pageNum: 1,
      hasMore: true,
      orderList: []
    })
    this.loadOrders(true)
  },

  // 加载订单列表
  async loadOrders(refresh = false) {
    if (this.data.loading) return
    
    // 如果没有更多数据，不再加载
    if (!refresh && !this.data.hasMore) return
    
    this.setData({ loading: true })
    
    try {
      const res = await api.getOrderList({
        status: this.data.currentStatus,
        pageNum: refresh ? 1 : this.data.pageNum,
        pageSize: this.data.pageSize
      })
      
      if (res.success && res.data) {
        const newList = res.data.list || []
        const total = res.data.total || 0
        
        // 处理订单数据，格式化时间等
        const processedList = newList.map(order => {
          // 格式化时间范围
          if (order.startTime && order.endTime) {
            order.startTimeStr = this.formatTimeRange(order.startTime, order.endTime)
          }
          if (order.recyclingStartTime && order.recyclingEndTime) {
            order.recyclingTimeStr = this.formatTimeRange(order.recyclingStartTime, order.recyclingEndTime)
          }
          // 格式化创建时间
          order.createdAtStr = this.formatTime(order.createdAt)
          return order
        })
        
        // 如果是刷新，直接替换列表；否则追加
        const orderList = refresh ? processedList : [...this.data.orderList, ...processedList]
        
        // 计算是否还有更多数据
        const hasMore = orderList.length < total
        
        this.setData({
          orderList,
          hasMore,
          pageNum: refresh ? 2 : this.data.pageNum + 1,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('加载订单列表失败:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      pageNum: 1,
      hasMore: true,
      orderList: []
    })
    this.loadOrders(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 滚动到底部加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadOrders(false)
    }
  },

  // 切换状态筛选
  onStatusChange(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const status = this.data.statusOptions[index].value
    
    if (status === this.data.currentStatus) return
    
    this.setData({
      currentStatus: status,
      pageNum: 1,
      hasMore: true,
      orderList: []
    })
    
    this.loadOrders(true)
  },

  // 格式化时间
  formatTime(timeStr) {
    if (!timeStr) return ''
    // 处理 "yyyy-MM-dd HH:mm:ss" 格式的时间字符串
    // 直接提取 MM-dd HH:mm 部分，避免 iOS 兼容性问题
    if (typeof timeStr === 'string') {
      // 格式: "2025-10-28 20:05:18"
      // 提取: "10-28 20:05"
      const match = timeStr.match(/^\d{4}-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
      if (match) {
        return `${match[1]}-${match[2]} ${match[3]}:${match[4]}`
      }
      // 如果格式不匹配，尝试其他格式
      const spaceIndex = timeStr.indexOf(' ')
      if (spaceIndex > 0) {
        const datePart = timeStr.substring(0, spaceIndex)
        const timePart = timeStr.substring(spaceIndex + 1)
        const dateMatch = datePart.match(/\d{4}-(\d{2})-(\d{2})/)
        const timeMatch = timePart.match(/(\d{2}):(\d{2})/)
        if (dateMatch && timeMatch) {
          return `${dateMatch[1]}-${dateMatch[2]} ${timeMatch[1]}:${timeMatch[2]}`
        }
      }
    }
    // 如果都解析失败，返回原字符串的一部分
    return timeStr.length > 16 ? timeStr.substring(5, 16) : timeStr
  },

  // 格式化日期时间范围
  formatTimeRange(startTime, endTime) {
    if (!startTime || !endTime) return ''
    const start = this.formatTime(startTime)
    const end = this.formatTime(endTime)
    return `${start} - ${end}`
  },

  // 点击订单项
  onOrderTap(e) {
    const orderNo = e.currentTarget.dataset.orderno
    const serviceType = e.currentTarget.dataset.servicetype
    
    // 根据订单类型跳转到不同的详情页
    if (serviceType === 2) {
      // 快递代取订单跳转到快递订单详情页
      wx.navigateTo({
        url: `/pages/express-detail/index?orderNo=${orderNo}`
      })
    } else if (serviceType === 3) {
      // 上门回收订单跳转到回收订单详情页
      wx.navigateTo({
        url: `/pages/recycling-detail/index?orderNo=${orderNo}`
      })
    } else {
      // 其他订单类型暂时不处理
      console.log('订单类型:', serviceType, '订单号:', orderNo)
    }
  }
})
