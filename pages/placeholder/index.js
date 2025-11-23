// pages/placeholder/index.js
Page({
  data:{
    illustration: ''
  },
  onLoad(){
    // 简洁抽象插画（内置SVG data-uri），避免外部资源依赖
    const svg = encodeURIComponent(`
      <svg width="240" height="160" viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#09ccb5"/>
            <stop offset="100%" stop-color="#8ea6ff"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="240" height="160" fill="#f7f8fa"/>
        <circle cx="60" cy="80" r="36" fill="url(#g)" opacity="0.25"/>
        <circle cx="160" cy="64" r="28" fill="url(#g)" opacity="0.35"/>
        <rect x="84" y="96" rx="8" ry="8" width="120" height="16" fill="#e7e9f2"/>
        <rect x="84" y="116" rx="8" ry="8" width="72" height="16" fill="#e7e9f2"/>
        <g transform="translate(36,40)">
          <path d="M10 40c0-16 12-28 28-28s28 12 28 28" stroke="#9aa4d6" stroke-width="4" fill="none" stroke-linecap="round"/>
          <circle cx="38" cy="14" r="6" fill="#9aa4d6"/>
        </g>
      </svg>
    `)
    this.setData({ illustration: `data:image/svg+xml;charset=UTF-8,${svg}` })
  }
})
