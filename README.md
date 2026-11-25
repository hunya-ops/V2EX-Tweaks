# V2EX Tweaks

V2EX 体验增强用户脚本集合，兼容 Tampermonkey、Violentmonkey 等主流脚本管理器。

## 功能

- **每日自动签到**
  - 按 UTC 日期自动检测并领取每日登录奖励，完成后同步隐藏侧边栏领奖提示。
  - 支持通过脚本菜单随时手动检查/触发签到。
- **粘贴图片自动上传**
  - 在回复框（`#reply_content`）及发帖、附言、编辑页面（兼容原生 `textarea` 与 CodeMirror 编辑器）直接粘贴图片，自动上传并插入 Markdown 图片链接。
  - 兼容复制富文本（如 Excel/Word 表格）场景，不会误拦截普通文本粘贴。
  - 支持多图床切换：
    - **Imgur**：默认匿名上传，可选填写自己的 `Client-ID`。
    - **Catbox.moe**：免注册匿名上传，可选填写 `User Hash`。
    - **ImgURL**：支持 API v3（Bearer Token）与 API v2（UID + Token），支持自定义自建服务地址与相册 ID。
- **屏蔽 PRO 推广广告**
  - 自动隐藏 `#pro-campaign-container` 推广广告区域及其独占的外层卡片与间距，兼容动态插入内容。
- **独立开关与主题适配**
  - 通过油猴扩展菜单可单独开启或关闭各项功能，提示条与配置弹窗自动适配亮色与夜间主题。

## 安装

1. 安装浏览器脚本管理器（推荐 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)）。
2. 通过 Greasy Fork 或直接点击以下链接安装：
   - [直接安装 `v2ex-tweaks.user.js`](https://raw.githubusercontent.com/hunya-ops/V2EX-Tweaks/main/v2ex-tweaks.user.js)

## 使用说明

打开任意 V2EX 页面后，点击浏览器脚本管理器图标即可看到以下菜单：

- `✅ / ⬜ 每日自动签到`：开启或关闭自动签到。
- `🎯 立即检查 / 手动签到`：立即检查今日签到状态并尝试领取。
- `✅ / ⬜ 粘贴图片自动上传`：开启或关闭剪贴板图片上传。
- `🖼️ 图床设置`：切换图床及填写相应配置。
- `✅ / ⬜ 屏蔽 PRO 推广广告`：开启或关闭 PRO 推广广告屏蔽。

> 若默认 Imgur 图床因网络环境受限或公共配额触发 `429` 限流，请在「图床设置」中切换为 **Catbox.moe**，或填写你自己的 Imgur `Client-ID` / ImgURL 配置。

## 权限与隐私说明

- **脚本运行范围**：仅匹配 `v2ex.com` 及官方子域（`www`、`fast`、`global`、`cn`），并排除 `/api/*`。
- **网络请求（`@connect`）**：默认仅声明 `api.imgur.com`、`catbox.moe`、`imgurl.org`。如填写自建 ImgURL 域名，首次上传时脚本管理器会弹窗请求你单独授权该域名。
- **页面交互（`unsafeWindow`）**：仅用于读取发帖/编辑页的 CodeMirror 编辑器实例以插入上传后的 Markdown 链接。
- **第三方图床**：粘贴上传的图片会直接发送到你选择的第三方图床或自建服务，请勿上传敏感隐私图片；所有配置项仅保存在本地脚本管理器存储中。

## 协议

基于 [MIT License](LICENSE) 开源。
