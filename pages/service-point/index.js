// pages/service-point/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    // 地图中心位置
    latitude: 39.908823,
    longitude: 116.397470,
    scale: 15,
    
    // 地图标记点
    markers: [],
    
    // 服务点列表数据
    points: [],
    
    // 加载状态
    loading: true,
    
    // 位置是否已设置
    positionSet: false,
    
    // 标记是否已加载
    markersLoaded: false,
    
    // 用户位置（用于回到我的位置）
    userLatitude: null,
    userLongitude: null,
    
    // 用户头像
    userAvatar: '/assets/tabbar/profile.png'
  },
  
  mapCtx: null,

  onLoad() {
    this.loadUserAvatar()
    this.initMap()
  },

  onReady() {
    // 创建地图上下文
    this.mapCtx = wx.createMapContext('servicePointMap', this)
  },

  /**
   * 加载用户头像
   */
  async loadUserAvatar() {
    try {
      const result = await api.getUserInfo()
      if (result.success && result.data && result.data.avatarUrl) {
        this.setData({
          userAvatar: result.data.avatarUrl
        })
      }
    } catch (error) {
      console.error('获取用户头像失败:', error)
      // 使用默认头像
    }
  },

  /**
   * 初始化地图
   * 以用户当前位置为中心
   */
  async initMap() {
    try {
      // 获取用户位置
      const location = await this.getUserLocation()
      
      // 设置地图初始位置为用户位置
      if (!this.data.positionSet) {
        this.setData({
          latitude: location.latitude,
          longitude: location.longitude,
          userLatitude: location.latitude,
          userLongitude: location.longitude,
          positionSet: true
        })
        
        // 延迟加载标记点，确保地图完全渲染
        setTimeout(() => {
          this.loadRecyclingPoints(location.latitude, location.longitude)
        }, 1500)
      }
    } catch (error) {
      console.error('初始化地图失败:', error)
      // 使用默认位置
      if (!this.data.positionSet) {
        this.setData({
          positionSet: true,
          userLatitude: this.data.latitude,
          userLongitude: this.data.longitude
        })
        setTimeout(() => {
          this.loadRecyclingPoints(this.data.latitude, this.data.longitude)
        }, 1500)
      }
    }
  },

  /**
   * 获取用户位置
   * 根据官方文档：map 组件使用的经纬度是火星坐标系，调用 wx.getLocation 接口需要指定 type 为 gcj02
   */
  getUserLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude
          })
        },
        fail: (err) => {
          console.error('获取位置失败:', err)
          wx.showToast({
            title: '获取位置失败',
            icon: 'none'
          })
          reject(err)
        }
      })
    })
  },

  /**
   * 加载附近的回收点
   */
  async loadRecyclingPoints(latitude, longitude) {
    // 如果已经加载过，不再重复加载
    if (this.data.markersLoaded) {
      return
    }
    
    // 如果正在加载，不再重复加载
    if (this._isLoading) {
      return
    }
    
    this._isLoading = true
    this.setData({ loading: true })
    
    try {
      const result = await api.getRecyclingPointsByLocation(latitude, longitude, 10)
      const points = (result.success && result.data) ? result.data : []
      
      // 构建用户位置标记（使用用户头像）
      const userMarker = {
        id: 0,
        latitude: latitude,
        longitude: longitude,
        iconPath: this.data.userAvatar,
        width: 40,
        height: 40,
        anchor: { x: 0.5, y: 0.5 }
      }
      
      // 构建回收点标记
      const pointMarkers = points.map(point => ({
        id: point.id,
        latitude: point.latitude,
        longitude: point.longitude,
        title: point.pointName,
        iconPath: '/assets/tabbar/doorRy.png',
        width: 40,
        height: 40,
        callout: {
          content: point.pointName,
          color: '#333333',
          fontSize: 14,
          borderRadius: 5,
          bgColor: '#ffffff',
          padding: 5,
          display: 'BYCLICK'
        }
      }))
      
      // 更新标记和列表数据
      this.setData({
        markers: [userMarker, ...pointMarkers],
        points: points,
        loading: false,
        markersLoaded: true
      })
      
      this._isLoading = false
      
    } catch (error) {
      console.error('加载回收点失败:', error)
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      this.setData({
        markers: [],
        points: [],
        loading: false
      })
      
      this._isLoading = false
    }
  },

  /**
   * 地图区域变化事件
   */
  onRegionChange(e) {
    // 不做任何处理，允许用户自由拖动地图
  },

  /**
   * 页面卸载时清理定时器
   */
  onUnload() {
    console.log('[地图页面] onUnload 触发')
    if (this._loadTimer) {
      clearTimeout(this._loadTimer)
      this._loadTimer = null
      console.log('[地图页面] 清理定时器')
    }
  },

  /**
   * 标记点点击事件
   * 点击后移动地图到该标记位置
   */
  onMarkerTap(e) {
    const markerId = e.detail.markerId
    // 用户位置标记不处理
    if (markerId === 0) return
    
    const point = this.data.points.find(p => p.id === markerId)
    if (point) {
      // 移动地图到该回收点位置
      this.moveToLocation(point.latitude, point.longitude)
      // 显示详情
      this.showPointDetail(point)
    }
  },

  /**
   * 列表项点击事件
   * 点击后移动地图到该回收点位置
   */
  onPointItemTap(e) {
    const point = e.currentTarget.dataset.point
    if (point) {
      // 移动地图到该回收点位置
      this.moveToLocation(point.latitude, point.longitude)
      // 显示详情
      this.showPointDetail(point)
    }
  },

  /**
   * 移动地图到指定位置
   */
  moveToLocation(latitude, longitude) {
    this.setData({
      latitude: latitude,
      longitude: longitude
    })
    
    // 尝试使用 MapContext 移动（如果支持）
    if (this.mapCtx) {
      try {
        this.mapCtx.moveToLocation({
          latitude: latitude,
          longitude: longitude,
          success: () => {
            console.log('地图移动到位置成功')
          },
          fail: (err) => {
            console.log('moveToLocation 失败，使用 setData 方式:', err)
          }
        })
      } catch (error) {
        console.log('moveToLocation 调用异常，使用 setData 方式:', error)
      }
    }
  },

  /**
   * 回到我的位置
   */
  backToMyLocation() {
    if (this.data.userLatitude && this.data.userLongitude) {
      this.moveToLocation(this.data.userLatitude, this.data.userLongitude)
    } else {
      wx.showToast({
        title: '位置信息不可用',
        icon: 'none'
      })
    }
  },

  /**
   * 显示服务点详情
   */
  showPointDetail(point) {
    wx.showModal({
      title: point.pointName,
      content: `地址：${point.address}\n${point.contactPhone ? `电话：${point.contactPhone}` : ''}`,
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
