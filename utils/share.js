/**
 * 小程序分享配置工具
 * 统一获取分享标题、路径、图片等配置
 */
function getShareConfig() {
  const app = getApp()
  const shareImageUrl = app.getShareImageUrl()
  const sharePath = app.getSharePath()
  const shareTitle = app.getShareTitle()
  const shareConfig = {
    title: shareTitle,
    path: sharePath
  }
  // 只有在配置了有效的分享图片URL时才设置，否则不设置imageUrl（不使用默认截图）
  if (shareImageUrl) {
    shareConfig.imageUrl = shareImageUrl
  }
  return shareConfig
}

module.exports = {
  getShareConfig
}
