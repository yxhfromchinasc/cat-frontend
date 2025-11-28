// pages/service-point/index.js
const { api } = require('../../utils/util.js')

Page({
  data: {
    // 地图中心位置 - 只设置一次，之后不再更新
    latitude: 39.908823,
    longitude: 116.397470,
    scale: 15,
    
    // 地图标记点
    markers: [],
    
    // 服务点列表数据
    points: [],
    
    // 加载状态
    loading: true,
    
    // 位置是否已设置（确保只设置一次）
    positionSet: false,
    
    // 标记是否已加载（确保只加载一次）
    markersLoaded: false,
    
    // 固定的地图中心位置（用于重置）
    fixedLatitude: null,
    fixedLongitude: null,
    
    // 是否正在修正位置（避免循环）
    isResetting: false
  },

  onLoad() {
    console.log('[地图页面] onLoad 触发')
    
    // 拦截 setData 方法，记录所有数据更新
    const originalSetData = this.setData.bind(this)
    this.setData = (data, callback) => {
      if (data.latitude !== undefined || data.longitude !== undefined) {
        console.log('[地图页面] ⚠️⚠️⚠️ setData 更新了地图位置:', {
          latitude: data.latitude,
          longitude: data.longitude,
          oldLat: this.data.latitude,
          oldLng: this.data.longitude,
          stack: new Error().stack
        })
      }
      if (data.markers !== undefined) {
        console.log('[地图页面] setData 更新了 markers:', {
          markersCount: Array.isArray(data.markers) ? data.markers.length : 'not array',
          oldMarkersCount: this.data.markers.length
        })
      }
      return originalSetData(data, callback)
    }
    
    this.initMap()
  },

  /**
   * 初始化地图
   * 根据官方文档：地图组件的经纬度必填，如果不填经纬度则默认值是北京的经纬度
   */
  async initMap() {
    console.log('[地图页面] initMap 开始执行, positionSet:', this.data.positionSet)
    try {
      // 获取用户位置
      console.log('[地图页面] 开始获取用户位置...')
      const location = await this.getUserLocation()
      console.log('[地图页面] 获取到用户位置:', location)
      
      // 只在首次设置地图位置，之后永远不再更新
      if (!this.data.positionSet) {
        console.log('[地图页面] 设置地图初始位置:', location)
        // 保存固定位置
        const fixedLat = location.latitude
        const fixedLng = location.longitude
        this.setData({
          latitude: location.latitude,
          longitude: location.longitude,
          positionSet: true,
          fixedLatitude: fixedLat,
          fixedLongitude: fixedLng
        }, () => {
          console.log('[地图页面] setData 完成 - 位置已设置:', {
            latitude: this.data.latitude,
            longitude: this.data.longitude,
            fixedLatitude: this.data.fixedLatitude,
            fixedLongitude: this.data.fixedLongitude
          })
        })
        
        // 等待地图完全渲染后再加载标记点
        // 根据官方文档，markers 更新可能会触发地图视野调整
        // 所以延迟设置，确保地图位置已经稳定
        // 使用一次性定时器，确保只执行一次
        if (!this._loadTimer) {
          console.log('[地图页面] 设置定时器，2秒后加载标记点')
          this._loadTimer = setTimeout(() => {
            console.log('[地图页面] 定时器触发，开始加载标记点')
            this.loadRecyclingPoints(location.latitude, location.longitude)
            this._loadTimer = null
          }, 2000)
        } else {
          console.log('[地图页面] 定时器已存在，跳过设置')
        }
      } else {
        console.log('[地图页面] 位置已设置，跳过初始化')
      }
    } catch (error) {
      console.error('[地图页面] 初始化地图失败:', error)
      // 使用默认位置
      if (!this.data.positionSet) {
        console.log('[地图页面] 使用默认位置')
        this.setData({ positionSet: true }, () => {
          console.log('[地图页面] setData 完成 - 使用默认位置')
        })
        if (!this._loadTimer) {
          console.log('[地图页面] 设置定时器（默认位置），2秒后加载标记点')
          this._loadTimer = setTimeout(() => {
            console.log('[地图页面] 定时器触发（默认位置），开始加载标记点')
            this.loadRecyclingPoints(this.data.latitude, this.data.longitude)
            this._loadTimer = null
          }, 2000)
        }
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
   * 只更新 markers 和 points，不更新地图的 latitude/longitude
   * 添加防重复调用机制，避免循环触发
   */
  async loadRecyclingPoints(latitude, longitude) {
    console.log('[地图页面] loadRecyclingPoints 被调用', {
      latitude,
      longitude,
      markersLoaded: this.data.markersLoaded,
      isLoading: this._isLoading,
      currentLat: this.data.latitude,
      currentLng: this.data.longitude
    })
    
    // 如果已经加载过，不再重复加载
    if (this.data.markersLoaded) {
      console.log('[地图页面] ⚠️ 标记已加载，跳过重复加载')
      return
    }
    
    // 如果正在加载，不再重复加载
    if (this._isLoading) {
      console.log('[地图页面] ⚠️ 正在加载中，跳过重复加载')
      return
    }
    
    this._isLoading = true
    console.log('[地图页面] 开始加载回收点数据...')
    this.setData({ loading: true })
    
    try {
      const result = await api.getRecyclingPointsByLocation(latitude, longitude, 10)
      const points = (result.success && result.data) ? result.data : []
      console.log('[地图页面] 获取到回收点数量:', points.length)
      
      // 构建用户位置标记
      const userMarker = {
        id: 0,
        latitude: latitude,
        longitude: longitude,
        iconPath: '/assets/tabbar/miao.png',
        width: 30,
        height: 30,
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
      
      console.log('[地图页面] 准备设置标记点，总数:', 1 + pointMarkers.length)
      console.log('[地图页面] 当前地图位置:', {
        latitude: this.data.latitude,
        longitude: this.data.longitude
      })
      
      // 只更新标记和列表数据，不更新地图位置
      // 这是关键：不更新 latitude/longitude，避免地图自动移动
      this.setData({
        markers: [userMarker, ...pointMarkers],
        points: points,
        loading: false,
        markersLoaded: true // 标记已加载
      }, () => {
        console.log('[地图页面] setData 完成 - 标记已设置', {
          markersCount: this.data.markers.length,
          pointsCount: this.data.points.length,
          latitude: this.data.latitude,
          longitude: this.data.longitude,
          markersLoaded: this.data.markersLoaded
        })
      })
      
      this._isLoading = false
      console.log('[地图页面] ✅ 标记加载完成')
      
    } catch (error) {
      console.error('[地图页面] ❌ 加载回收点失败:', error)
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
   * 地图区域变化事件 - 用于追踪地图移动并修正
   */
  onRegionChange(e) {
    const { type, causedBy } = e.detail
    console.log('[地图页面] 🗺️ 地图区域变化:', {
      type,
      causedBy,
      timestamp: Date.now(),
      currentLat: this.data.latitude,
      currentLng: this.data.longitude,
      fixedLat: this.data.fixedLatitude,
      fixedLng: this.data.fixedLongitude,
      isResetting: this.data.isResetting
    })
    
    // 如果是数据更新导致的视野变化，且标记已加载，立即重置位置
    // 这是关键：当 markers 更新导致地图自动移动时，立即移回固定位置
    if (causedBy === 'update' && 
        type === 'end' && 
        this.data.markersLoaded && 
        this.data.positionSet && 
        this.data.fixedLatitude && 
        this.data.fixedLongitude &&
        !this.data.isResetting) {
      
      console.log('[地图页面] ⚠️ 检测到地图因数据更新而移动，立即重置位置')
      
      // 标记正在重置，避免循环
      this.setData({ isResetting: true })
      
      // 延迟重置，避免与地图更新冲突
      setTimeout(() => {
        const fixedLat = this.data.fixedLatitude
        const fixedLng = this.data.fixedLongitude
        
        console.log('[地图页面] 重置地图位置到:', { latitude: fixedLat, longitude: fixedLng })
        
        // 直接重置到固定位置
        this.setData({
          latitude: fixedLat,
          longitude: fixedLng,
          isResetting: false
        }, () => {
          console.log('[地图页面] ✅ 位置重置完成')
        })
      }, 200)
    }
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
   */
  onMarkerTap(e) {
    const markerId = e.detail.markerId
    // 用户位置标记不处理
    if (markerId === 0) return
    
    const point = this.data.points.find(p => p.id === markerId)
    if (point) {
      this.showPointDetail(point)
    }
  },

  /**
   * 列表项点击事件
   */
  onPointItemTap(e) {
    const point = e.currentTarget.dataset.point
    this.showPointDetail(point)
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
