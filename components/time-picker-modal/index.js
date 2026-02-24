Component({
  properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean,
      value: false
    },
    // 日期选项列表 [{ label, isToday }]
    dateOptions: {
      type: Array,
      value: []
    },
    // 当前展示的时间段列表
    timeSlotOptions: {
      type: Array,
      value: []
    },
    // 选中的日期索引
    selectedDateIndex: {
      type: Number,
      value: -1
    },
    // 选中的时间段索引
    selectedTimeSlotIndex: {
      type: Number,
      value: -1
    }
  },

  methods: {
    onMaskTap() {
      this.triggerEvent('close')
    },

    onContentTap() {
      // 阻止冒泡，不做任何处理
    },

    onCancelTap() {
      this.triggerEvent('close')
    },

    onConfirmTap() {
      this.triggerEvent('confirm')
    },

    onSelectDate(e) {
      const index = parseInt(e.currentTarget.dataset.index, 10)
      this.triggerEvent('selectdate', { index })
    },

    onSelectTimeSlot(e) {
      const index = parseInt(e.currentTarget.dataset.index, 10)
      this.triggerEvent('selecttimeslot', { index })
    }
  }
})

