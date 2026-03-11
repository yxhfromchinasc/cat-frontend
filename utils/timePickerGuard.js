// 统一的时间选择器打开前校验逻辑
// 各业务线（快递代取 / 上门回收 / 大件清运 / 杂货铺）在 showTimePicker 时调用
//
// 参数：
// - hasAddress: 是否已选择地址
// - hasPoint: 是否已选择业务点（驿站/回收点/清运点/杂货铺）
// - hasSlots: 是否已经初始化了时间段数据（dateOptions + timeSlotsByDay）
// - messages: 提示文案 { noAddress, noPoint, noSlots }
//
// 返回：
// - true  可以打开时间选择器
// - false 不应打开（内部已提示）

function canOpenTimePicker({ hasAddress, hasPoint, hasSlots, messages = {} }) {
  const noAddressMsg = messages.noAddress || '请先选择收货地址'
  const noPointMsg = messages.noPoint || '请先选择服务点'
  const noSlotsMsg = messages.noSlots || '当前暂无可预约时间，请稍后再试'

  if (!hasAddress) {
    wx.showToast({ title: noAddressMsg, icon: 'none' })
    return false
  }
  if (!hasPoint) {
    wx.showToast({ title: noPointMsg, icon: 'none' })
    return false
  }
  if (!hasSlots) {
    wx.showToast({ title: noSlotsMsg, icon: 'none' })
    return false
  }
  return true
}

module.exports = {
  canOpenTimePicker
}

