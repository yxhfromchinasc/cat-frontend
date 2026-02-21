/**
 * 全局单例轮询管理器
 * 使用引用计数：多个页面调用 start 时只运行一个定时器，所有页面都 stop 后才真正停止
 */
const constants = require('./constants.js')

let timer = null
let refCount = 0
let currentCallback = null
let currentInterval = 0

/**
 * 启动轮询
 * @param {Function} callback - 每次轮询执行的回调
 * @param {number} [interval=3000] - 轮询间隔（毫秒）
 */
function start(callback, interval = constants.POLL_INTERVAL_UNREAD_MESSAGES) {
  if (typeof callback !== 'function') return

  refCount++
  currentCallback = callback
  currentInterval = interval

  // 已在运行，不重复启动定时器
  if (timer) return

  // 立即执行一次
  try {
    callback()
  } catch (e) {
    console.error('轮询回调执行失败')
  }

  timer = setInterval(() => {
    try {
      currentCallback && currentCallback()
    } catch (e) {
      console.error('轮询回调执行失败')
    }
  }, currentInterval)
}

/**
 * 停止轮询（引用计数减一，当计数为 0 时真正停止）
 */
function stop() {
  if (refCount <= 0) return
  refCount--
  if (refCount > 0) return

  // 所有调用方都已 stop，真正停止
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  currentCallback = null
  currentInterval = 0
}

/**
 * 检查轮询是否在运行
 * @returns {boolean}
 */
function isRunning() {
  return timer != null
}

module.exports = {
  start,
  stop,
  isRunning
}
