Component({
  properties: {
    /** 是否显示卡片（有姓名时显示） */
    name: { type: String, value: '' },
    /** 头像 URL */
    avatarUrl: { type: String, value: '' },
    /** 角色描述：业务员 / 回收员 / 清运小哥 */
    roleDesc: { type: String, value: '' },
    /** 电话（有则显示拨打按钮） */
    phone: { type: String, value: '' },
    /** 小哥 ID（有且 showContact 为 true 时显示会话按钮） */
    courierId: { type: String, value: '' },
    /** 是否显示会话按钮（订单完成后可传 false 隐藏） */
    showContact: { type: Boolean, value: true },
    /** 评分星数数组 [1,2,3,4,5]，有则显示星级 */
    ratingArray: { type: Array, value: [] }
  },

  methods: {
    onCallTap() {
      if (this.properties.phone) {
        this.triggerEvent('call', { phone: this.properties.phone })
      }
    },
    onContactTap() {
      this.triggerEvent('contact')
    }
  }
})
