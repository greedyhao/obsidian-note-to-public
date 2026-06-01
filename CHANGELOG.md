# Changelog

## 0.1.6 (2026-06-01)

### Fixed
- 代码块 ASCII art 多空格被折叠 & 微信内自动折行
  - `finalCodeBlockFix`: `white-space:nowrap` → `pre` + `min-width:max-content`，保留多空格并按最长行撑开宽度
  - `copyRichText`: 修掉 Obsidian `MarkdownRenderer.render` 默认给 `<code>` 加的 `pre-wrap`
- 补充 ASCII art 空格保留的测试用例

### Changed
- 更新 release workflow 文件

### Added
- `agents.md`: AI 协作指南，记录 juice mock、white-space 规则、format 流水线等技术债和注意事项

## 0.1.5 (2026-05-24)

### Fixed
- 修复 release workflow 中 `main.js` 路径校验失效问题

## 0.1.4 (2026-05-23)

### Changed
- 升级到 Node.js 24，替换已废弃的依赖

## 0.1.3 (2026-05-22)

### Performance
- 插件体积从 11MB 减少到 1.3MB

## 0.1.2

### Changed
- 添加 pnpm-lock.yaml 以支持 CI

## 0.1.1

### Fixed
- 修复 release workflow

## 0.1.0

### Added
- 添加测试用例（首次发布版本）

### Fixed
- 修复嵌入图片丢失问题
- AppSecret 安全存储与 Mermaid 图表渲染修复
- 英文 README 修正
