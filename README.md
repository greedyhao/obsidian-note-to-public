# Note to Public for Obsidian

A plugin to publish Obsidian notes to multiple platforms with one click. Currently supports WeChat Official Account (微信公众号).

## Features

- ✅ **WeChat Official Account Publishing**: Publish drafts or articles directly via official API
- 📝 **Obsidian Syntax Support**: Supports WikiLink, highlight `==text==`, strikethrough `~~text~~`, Callout, etc.
- 📊 **Mermaid Diagrams**: Automatically render Mermaid diagrams as images and upload them
- 🖼️ **Auto Image Upload**: Local images are automatically uploaded to WeChat media library
- 🎨 **WeChat Formatting**: Generate WeChat-compatible HTML for articles
- 👁️ **Live Preview**: Sidebar preview with automatic updates when switching files

## Installation

### Manual Installation

1. Download the latest release: [Releases](https://github.com/greedyhao/obsidian-note-to-public/releases)
2. Extract to your Obsidian plugins folder: `<vault>/.obsidian/plugins/obsidian-note-to-public/`
3. Restart Obsidian
4. Enable the plugin in settings

### Development Installation

```bash
git clone https://github.com/greedyhao/obsidian-note-to-public.git
cd obsidian-note-to-public
pnpm install
pnpm run build
```

Then copy the project folder to your Obsidian plugins directory.

## Configuration

1. Open Obsidian Settings -> Community plugins -> Note to Public
2. Enter your WeChat Official Account **AppID** and **AppSecret**
   - Get them from: WeChat Public Platform -> Settings & Development -> Basic Configuration
   - **AppSecret is encrypted and stored in Obsidian SecretStorage, manageable in Settings -> Security -> Key Storage**
3. Optional: Set default author name

## Usage

### Preview Before Publishing

**Method 1: Command Palette**
1. Press `Ctrl/Cmd + P` to open command palette
2. Type "打开发布预览" (Open Publish Preview) and execute

**Method 2: Context Menu**
1. Right-click on a Markdown file in the file list
2. Select "👁️ 打开发布预览" (Open Publish Preview)

**Preview Features:**
- Preview panel appears in the right sidebar
- Content updates automatically when switching files
- Displays article title, author, summary, etc.
- Shows count of Mermaid diagrams and local images
- Simulates WeChat article rendering

### Publish to WeChat Official Account

**Method 1: Command Palette**
1. Open the note you want to publish
2. Press `Ctrl/Cmd + P` to open command palette
3. Type "发布到微信公众号" (Publish to WeChat) and execute

**Method 2: File Context Menu**
1. Right-click on a Markdown file in the file list
2. Select "📤 发布到微信公众号" (Publish to WeChat)

**Method 3: Editor Context Menu**
1. Right-click in the editor
2. Select "📤 发布到微信公众号" (Publish to WeChat)

### Frontmatter Support

Add YAML frontmatter at the top of your note:

```yaml
---
title: Article Title
description: Article summary (max 54 characters)
author: Author Name
date: 2024-01-01
tags: [tag1, tag2]
---
```

### Supported Obsidian Syntax

| Syntax | Conversion |
|--------|-----------|
| `[[WikiLink]]` | Plain text (displays alias) |
| `![[Embed]]` | To be implemented (marked as embed) |
| `==highlight==` | Yellow background highlight |
| `~~strikethrough~~` | Strikethrough text |
| `> [!note] ...` | Blockquote with icon prefix |
| `%%comment%%` | Removed |
| ```mermaid ... ``` | Rendered as image |

## Important Notes

### WeChat Official Account Limitations

- Requires a **verified** WeChat Official Account (subscription or service account)
- Daily API call limits apply
- Images cannot exceed 2MB
- Article content must comply with WeChat Public Platform guidelines

### Mermaid Diagrams

- Mermaid diagrams are rendered as PNG images and uploaded
- Complex diagrams may take longer to process
- Ensure stable internet connection for image uploads
- **Note**: HTML labels are disabled to ensure complete diagram rendering using pure SVG

## Development

### Project Structure

```
src/
├── main.ts                      # Plugin entry point
├── settings.ts                  # Configuration management
├── ui/
│   ├── publish-modal.ts         # Publish interface
│   └── preview-view.ts          # Preview sidebar view
├── markdown/
│   ├── obsidian-parser.ts       # Obsidian syntax parsing
│   ├── mermaid-renderer.ts      # Mermaid rendering
│   └── wechat-formatter.ts      # WeChat HTML formatting
└── platforms/
    └── wechat/
        ├── auth.ts              # WeChat authentication
        ├── api.ts               # WeChat API
        └── publisher.ts         # Publishing workflow
```

### Build

```bash
pnpm run dev      # Development mode (hot reload)
pnpm run build    # Production build
```

## Roadmap

- [ ] Support more platforms (Zhihu, Juejin, CSDN, etc.)
- [ ] Article templates
- [ ] Scheduled publishing
- [ ] Article history
- [ ] Batch publishing

## Contributing

Issues and Pull Requests are welcome!

## License

MIT License

## Acknowledgments

- [obsidian-mp-publisher](https://github.com/sunbooshi/obsidian-mp-publisher) — Referenced DOM processing, image upload, and media library management
- [note-to-mp](https://github.com/nicekwell/note-to-mp) — Referenced Mermaid SVG→PNG conversion, cover upload, and code block handling
- [WeMD](https://github.com/nicekwell/WeMD) — Referenced markdown-it + juice rendering, CSS inline strategy, and code block styling
