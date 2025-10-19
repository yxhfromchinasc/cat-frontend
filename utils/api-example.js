/**
 * API工具使用示例
 * 展示如何使用统一的API请求工具
 */

const api = require('./api.js')

// 使用示例
const examples = {
  
  // 1. 用户登录
  async loginExample() {
    try {
      const result = await api.login({
        username: 'user001',
        password: 'password123'
      })
      
      if (result.success) {
        console.log('登录成功:', result.data)
        // token已自动保存到本地存储
      }
    } catch (error) {
      console.error('登录失败:', error)
    }
  },

  // 2. 获取用户信息
  async getUserInfo() {
    try {
      const result = await api.get('/user/info')
      if (result.success) {
        console.log('用户信息:', result.data)
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  },

  // 3. 分页获取数据列表
  async getDataList() {
    try {
      const result = await api.getPageList('/data/list', 1, 10, {
        status: 'active'
      })
      
      if (result.success) {
        console.log('数据列表:', result.data)
        // result.data 包含: { list: [], total: 100, page: 1, pageSize: 10 }
      }
    } catch (error) {
      console.error('获取数据列表失败:', error)
    }
  },

  // 4. 创建数据
  async createData() {
    try {
      const result = await api.post('/data/create', {
        name: '新数据',
        description: '这是描述'
      })
      
      if (result.success) {
        console.log('创建成功:', result.data)
      }
    } catch (error) {
      console.error('创建失败:', error)
    }
  },

  // 5. 更新数据
  async updateData(id, updateData) {
    try {
      const result = await api.put(`/data/update/${id}`, updateData)
      
      if (result.success) {
        console.log('更新成功:', result.data)
      }
    } catch (error) {
      console.error('更新失败:', error)
    }
  },

  // 6. 删除数据
  async deleteData(id) {
    try {
      const result = await api.delete(`/data/delete/${id}`)
      
      if (result.success) {
        console.log('删除成功')
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  },

  // 7. 不显示加载提示的请求
  async silentRequest() {
    try {
      const result = await api.get('/data/check', {}, {
        showLoading: false,
        showError: false
      })
      
      if (result.success) {
        console.log('静默请求成功:', result.data)
      }
    } catch (error) {
      console.log('静默请求失败:', error)
    }
  },

  // 8. 检查登录状态
  checkLoginStatus() {
    const isLoggedIn = api.checkLogin()
    console.log('登录状态:', isLoggedIn ? '已登录' : '未登录')
    return isLoggedIn
  },

  // 9. 登出
  async logoutExample() {
    try {
      await api.logout()
      console.log('登出成功')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }
}

module.exports = examples
