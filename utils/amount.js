// 统一金额/BigDecimal 解析与格式化工具

function isNumber(val) {
  return typeof val === 'number' && isFinite(val);
}

function parseBigDecimalLike(input, defaultValue = 0) {
  try {
    if (input == null) return defaultValue;
    if (isNumber(input)) return input;
    if (typeof input === 'string') {
      const n = parseFloat(input);
      return isFinite(n) ? n : defaultValue;
    }
    // 兼容 BigDecimal 序列化或后端对象包装 { value: "12.34" }
    if (typeof input === 'object') {
      if (isNumber(input.value)) return input.value;
      if (typeof input.value === 'string') {
        const n = parseFloat(input.value);
        return isFinite(n) ? n : defaultValue;
      }
      // 有些后端会直接把数字放在对象里
      const maybeNumber = Number(input);
      if (isFinite(maybeNumber)) return maybeNumber;
    }
  } catch (_) {}
  return defaultValue;
}

function clampToTwoDecimals(num) {
  const n = isNumber(num) ? num : 0;
  return Math.round(n * 100) / 100;
}

function formatAmount(num, digits = 2) {
  const n = clampToTwoDecimals(parseBigDecimalLike(num, 0));
  try {
    return n.toFixed(digits);
  } catch (_) {
    return '0.00';
  }
}

function safeSubtract(a, b) {
  const x = clampToTwoDecimals(parseBigDecimalLike(a, 0));
  const y = clampToTwoDecimals(parseBigDecimalLike(b, 0));
  return clampToTwoDecimals(x - y);
}

function nonNegative(num) {
  const n = clampToTwoDecimals(parseBigDecimalLike(num, 0));
  return n < 0 ? 0 : n;
}

module.exports = {
  parseBigDecimalLike,
  formatAmount,
  clampToTwoDecimals,
  safeSubtract,
  nonNegative,
};


