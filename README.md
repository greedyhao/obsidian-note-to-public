# Note to Public for Obsidian

一键发布 Obsidian 笔记到多个平台的插件。目前已支持微信公众号。

## 功能特性

- ✅ **微信公众号发布**: 通过官方 API 一键发布草稿或直接发布
- 📝 **Obsidian 语法支持**: 支持 WikiLink、高亮 `==text==`、删除线 `~~text~~`、Callout 等
- 📊 **Mermaid 图表**: 自动将 Mermaid 图表渲染为图片并上传
- 🖼️ **图片自动上传**: 本地图片自动上传至微信素材库
- 🎨 **适配微信排版**: 生成微信图文消息兼容的 HTML
- 👁️ **实时预览**: 侧边栏预览发布效果，切换文件自动更新

## 安装

### 手动安装

1. 下载最新版本：[Releases](https://github.com/yourusername/obsidian-note-to-public/releases)
2. 解压到 Obsidian 插件目录：`<vault>/.obsidian/plugins/obsidian-note-to-public/`
3. 重启 Obsidian
4. 在设置中启用插件

### 开发安装

```bash
git clone https://github.com/greedyhao/obsidian-note-to-public.git
cd obsidian-note-to-public
pnpm install
pnpm run build
```

然后将项目文件夹复制到 Obsidian 插件目录。

## 配置

1. 打开 Obsidian 设置 -> 第三方插件 -> Note to Public
2. 填写微信公众号的 **AppID** 和 **AppSecret**
   - 获取方式：微信公众平台 -> 设置与开发 -> 基本配置
3. 可选：设置默认作者名称

## 使用

### 预览发布效果

**方式一：命令面板**
1. 按 `Ctrl/Cmd + P` 打开命令面板
2. 输入"打开发布预览"并执行

**方式二：右键菜单**
1. 在文件列表中右键点击 Markdown 文件
2. 选择"👁️ 打开发布预览"

**预览功能说明：**
- 预览面板会显示在右侧边栏
- 切换文件时预览内容会自动更新
- 显示文章标题、作者、摘要等信息
- 标注 Mermaid 图表和本地图片数量（发布时自动处理）
- 模拟微信图文的渲染效果

### 发布到微信公众号

**方式一：命令面板**
1. 打开要发布的笔记
2. 按 `Ctrl/Cmd + P` 打开命令面板
3. 输入"发布到微信公众号"并执行

**方式二：右键菜单**
1. 在文件列表中右键点击 Markdown 文件
2. 选择"📤 发布到微信公众号"

**方式三：编辑器右键**
1. 在编辑器中右键
2. 选择"📤 发布到微信公众号"

### Frontmatter 支持

在笔记顶部添加 YAML Frontmatter，发布时会自动读取：

```yaml
---
title: 文章标题
description: 文章摘要（最多54字符）
author: 作者名
date: 2024-01-01
tags: [标签1, 标签2]
---
```

### 支持的 Obsidian 语法

| 语法 | 转换效果 |
|------|---------|
| `[[WikiLink]]` | 纯文本（显示别名） |
| `![[Embed]]` | 待实现（标记为嵌入） |
| `==高亮==` | 黄色背景高亮 |
| `~~删除线~~` | 带删除线的文字 |
| `> [!note] ...` | 引用块带图标前缀 |
| `%%注释%%` | 移除 |
| ```mermaid ... ``` | 渲染为图片 |

## 注意事项

### 微信公众号限制

- 需要**已认证**的微信公众号（订阅号或服务号）
- 每个公众号每天调用 API 有次数限制
- 图片大小不能超过 2MB
- 文章内容需要符合微信公众平台规范

### Mermaid 图表

- Mermaid 图表会被渲染为 PNG 图片上传
- 复杂的图表可能需要更长的处理时间
- 确保你的网络连接正常以便上传图片

## 开发

### 项目结构

```
src/
├── main.ts                      # 插件入口
├── settings.ts                  # 配置管理
├── ui/
│   ├── publish-modal.ts         # 发布界面
│   └── preview-view.ts          # 预览侧边栏视图
├── markdown/
│   ├── obsidian-parser.ts       # Obsidian 语法解析
│   ├── mermaid-renderer.ts      # Mermaid 渲染
│   └── wechat-formatter.ts      # 微信 HTML 格式化
└── platforms/
    └── wechat/
        ├── auth.ts              # 微信认证
        ├── api.ts               # 微信 API
        └── publisher.ts         # 发布流程
```

### 构建

```bash
pnpm run dev      # 开发模式（热重载）
pnpm run build    # 生产构建
```

## 路线图

- [ ] 支持更多平台（知乎、掘金、CSDN 等）
- [ ] 支持文章模板
- [ ] 支持定时发布
- [ ] 支持文章历史记录
- [ ] 批量发布功能

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 参考项目

- [obsidian-mp-publisher](https://github.com/sunbooshi/obsidian-mp-publisher) — Obsidian 公众号发布插件，参考了其 DOM 处理、图片上传、素材库管理等实现
- [note-to-mp](https://github.com/nicekwell/note-to-mp) — 公众号发布插件，参考了其 Mermaid SVG → PNG 转换、封面图上传、代码块换行处理
- [WeMD](https://github.com/nicekwell/WeMD) — 公众号编辑器，参考了其 markdown-it + juice 渲染方案、CSS 内联策略、代码块样式处理
