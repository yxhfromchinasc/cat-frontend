/**
 * 全局常量
 */

// 支付方式代码（与后端 PaymentMethod 枚举一致）
// 1=WECHAT_NATIVE, 2=WECHAT_MINIPROGRAM, 4=WALLET
const PAYMENT_METHOD_WECHAT = 2   // 微信支付
const PAYMENT_METHOD_WALLET = 4  // 钱包支付

// 轮询间隔（毫秒）
const POLL_INTERVAL_UNREAD_MESSAGES = 3000  // 未读消息轮询

// 分页默认值
const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_CHAT = 20       // 聊天消息分页
const PAGE_SIZE_WALLET = 20     // 钱包流水分页

module.exports = {
  PAYMENT_METHOD_WECHAT,
  PAYMENT_METHOD_WALLET,
  POLL_INTERVAL_UNREAD_MESSAGES,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_CHAT,
  PAGE_SIZE_WALLET
}
