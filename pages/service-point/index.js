// pages/service-point/index.js
const { api } = require('../../utils/util.js');

Page({
  data: {
    // 地图中心默认位置（北京天安门）
    latitude: 39.908823,
    longitude: 116.397470,
    scale: 15,
    
    markers: [],
    points: [],
    
    loading: true,
    
    // 地址相关
    addressList: [],
    selectedAddress: null,
    selectedAddressText: '', // 用于显示在UI上的完整地址文本
  },
  
  mapCtx: null,

  onLoad() {
    this.initPage();
  },

  onShow() {
    // 监听地址从编辑/新增页面返回后的刷新
    if (this.data.pageLoaded) {
      this.initPage();
    } else {
      this.data.pageLoaded = true;
    }
  },

  onReady() {
    this.mapCtx = wx.createMapContext('servicePointMap', this);
  },

  /**
   * 将地址对象格式化为可读字符串
   * @param {object} address 地址对象
   */
  _getFullAddressText(address) {
    if (!address) return '';
    return `${address.province || ''}${address.city || ''}${address.district || ''}${address.detailAddress || ''}`;
  },

  /**
   * 页面初始化
   */
  async initPage() {
    this.setData({ loading: true });
    try {
      let addressResult = await api.getDefaultAddress();
      let addresses = [];

      if (addressResult.success && addressResult.data) {
        addresses = [addressResult.data];
        await this.loadAllAddresses(); 
      } else {
        addressResult = await api.getAddressList(1, 100);
        if (addressResult.success && addressResult.data.list.length > 0) {
          addresses = addressResult.data.list;
          this.setData({ addressList: addresses });
        }
      }

      if (addresses.length > 0) {
        const addressToUse = addresses[0];
        await this.updateMapWithAddress(addressToUse);
      } else {
        this.setData({
          loading: false,
          addressList: [],
          selectedAddress: null,
          selectedAddressText: '',
          points: [],
          markers: []
        });
        this.moveToLocation(this.data.latitude, this.data.longitude);
      }
    } catch (error) {
      console.error('初始化页面失败');
      this.setData({ loading: false });
      wx.showToast({ title: '加载地址失败', icon: 'none' });
    }
  },

  /**
   * 加载所有地址到 addressList 供选择
   */
  async loadAllAddresses() {
    try {
      const res = await api.getAddressList(1, 100);
      if (res.success && res.data.list) {
        this.setData({ addressList: res.data.list });
      }
    } catch (error) {
      console.error('加载完整地址列表失败');
    }
  },

  /**
   * 根据地址更新地图和回收点
   * @param {object} address 地址对象
   */
  async updateMapWithAddress(address) {
    this.setData({ 
      loading: true,
      selectedAddress: address,
      selectedAddressText: this._getFullAddressText(address)
    });

    try {
      let lat = address.latitude;
      let lon = address.longitude;

      if (!lat || !lon) {
        const fullAddressText = this.data.selectedAddressText;
        const geocodeResult = await api.geocode(fullAddressText);
        if (geocodeResult.success && geocodeResult.data) {
          lat = geocodeResult.data.latitude;
          lon = geocodeResult.data.longitude;
        } else {
          throw new Error('地址解析失败');
        }
      }
      
      this.moveToLocation(lat, lon);
      await this.loadRecyclingPoints(lat, lon);

    } catch (error) {
      console.error('更新地图失败');
      wx.showToast({ title: error.message || '更新地图失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },
  
  /**
   * 加载附近的回收点
   */
  async loadRecyclingPoints(latitude, longitude) {
    this.setData({ loading: true });
    try {
      const result = await api.getRecyclingPointsByLocation(latitude, longitude, 10);
      const points = (result.success && result.data) ? result.data : [];
      
      const pointMarkers = points.map(point => ({
        id: point.id,
        latitude: point.latitude,
        longitude: point.longitude,
        title: point.pointName,
        iconPath: '/assets/tabbar/doorRy.png',
        width: 35,
        height: 35,
        callout: {
          content: point.pointName,
          color: '#333333',
          fontSize: 14,
          borderRadius: 5,
          bgColor: '#ffffff',
          padding: 5,
          display: 'BYCLICK'
        }
      }));
      
      this.setData({
        markers: pointMarkers,
        points: points,
        loading: false
      });
      
    } catch (error) {
      console.error('加载回收点失败');
      wx.showToast({ title: '加载回收点失败', icon: 'none' });
      this.setData({ markers: [], points: [], loading: false });
    }
  },

  /**
   * 点击“去添加地址”
   */
  onAddAddressTap() {
    wx.navigateTo({
      url: '/pages/address/edit',
    });
  },

  /**
   * 点击地址选择器
   */
  onSelectAddressTap() {
    const { addressList } = this.data;
    if (!addressList || addressList.length === 0) return;

    const itemList = addressList.map(addr => {
      const addressText = this._getFullAddressText(addr); // 移除截断
      return `${addr.contactName} - ${addressText}`;
    });
    
    wx.showActionSheet({
      itemList: itemList,
      success: async (res) => {
        const selected = addressList[res.tapIndex];
        await this.updateMapWithAddress(selected);
      },
      fail(res) {
      }
    });
  },

  /**
   * 移动地图到指定位置
   */
  moveToLocation(latitude, longitude) {
    this.setData({ latitude, longitude });
    if (this.mapCtx) {
      this.mapCtx.moveToLocation({ latitude, longitude });
    }
  },

  /**
   * 标记点点击事件
   */
  onMarkerTap(e) {
    const markerId = e.detail.markerId;
    const point = this.data.points.find(p => p.id === markerId);
    if (point) {
      this.moveToLocation(point.latitude, point.longitude);
      this.showPointDetail(point);
    }
  },

  /**
   * 列表项点击事件
   */
  onPointItemTap(e) {
    const point = e.currentTarget.dataset.point;
    if (point) {
      this.moveToLocation(point.latitude, point.longitude);
      this.showPointDetail(point);
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
    });
  },

  onRegionChange(e) {},
  onUnload() {},
});

