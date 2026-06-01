# AGENTS.md — guide for AI coding agents

本文件给在这个 repo 工作的 AI agent 用，省去每次重复介绍项目背景。

## 项目是什么

Obsidian 插件（id `note-to-public`），一键把笔记发布到微信公众号等平台。当前只支持微信公众号。

- 入口：`src/main.ts`（`NoteToPublicPlugin extends Plugin`）
- 打包产物：`main.js`（**不要手编**，esbuild 每次构建覆盖）
- Obsidian 最低版本：`0.15.0`（`manifest.json`）

## 技术栈

- TypeScript 5（`tsconfig.json`：`strict: true`、`target: ES2022`、`jsx: react` with `createEl` factory）
- esbuild 打包（`esbuild.config.mjs`）：`src/main.ts` → `main.js`，external 包含 `obsidian` / `electron` / `@codemirror/*` / `lezer` / `@lezer/*`
- markdown-it 渲染
- highlight.js 代码高亮
- juice 把 CSS 内联到 inline style（**关键，见下**）
- mermaid 流程图（异步渲染成图再上传）
- jest + ts-jest + jsdom 测

## 常用命令

```bash
pnpm install            # 安装依赖（项目用 pnpm，提交的是 pnpm-lock.yaml）
pnpm run dev            # esbuild watch 模式，src/ 改了自动重打 main.js
pnpm run build          # 生产构建，产 main.js
pnpm test               # jest 全量
npx jest <path>         # 跑单个测试文件（也可以用 pnpm exec）
```

## 目录结构

```
src/
  main.ts                       # 插件入口、命令注册、视图挂载
  settings.ts                   # 插件设置
  markdown/
    obsidian-parser.ts          # frontmatter / Obsidian 语法预处理
    markdown-renderer.ts        # markdown-it 渲染，CSS 模板在 getWechatCss()
    wechat-formatter.ts         # 给微信 API 用的 HTML 改造（关键文件）
    mermaid-renderer.ts         # mermaid → 图片
    *.test.ts
  ui/
    preview-view.ts             # 右侧栏预览
    publish-modal.ts            # 发布弹窗 + 进度
  platforms/
    wechat/
      auth.ts                   # AppID/AppSecret，存 Obsidian SecretStorage
      api.ts                    # requestUrl 封装
      publisher.ts              # 草稿/文章发布
  __mocks__/
    obsidian.ts                 # 测试时把整个 obsidian 包替成 stub
    juice.ts                    # 真正的 juice 在 jsdom 下跑不动，见下
```

## ⚠️ 测试时的 juice mock 坑

**`src/__mocks__/juice.ts` 把 juice 简化成原样返回 HTML**——不做任何 CSS 内联。原因：真的 juice 依赖 cheerio，在 jest 的 jsdom 环境加载会报错。

后果：测试里 `<code>` / `<pre>` 等元素**没有 inline style**。如果想测"经过 juice 内联后白空间是否被正确设置"这类逻辑，不能直接断言产物里的 `style="..."`，得自己往 `<code>` 上注入 `style` 模拟 juice 的输出。

参考写法（来自 `wechat-formatter.test.ts` 的 ASCII art 测试）：

```ts
const f = new WechatFormatter();
// 把 inlineStyles 桩成"给 <code> 加 inline style"，模拟 juice 真在跑的效果
(f as any).inlineStyles = (html: string) =>
  html.replace(
    /<code([^>]*)>/g,
    '<code$1 style="white-space:something;overflow-x:auto;">'
  );

const result = f.format(markdown, new Map());
// 现在 finalCodeBlockFix 才能找到 white-space 来替换
expect(result).toContain('white-space:pre');
```

如果新加的测试需要 juice 真实内联，**不要硬来**（前面试过 `jest.requireActual('juice')` 会在 cheerio 那一步挂）。正确做法：扩展 `src/__mocks__/juice.ts`，或像上面那样只桩一个最小集合。

## ⚠️ 代码块的 white-space 必须是 `pre`，不能是 `nowrap` 也不能是 `pre-wrap`

**两条路径都要修，只修 wechat-formatter 不够：**

1. **微信 API 路径**（`src/markdown/wechat-formatter.ts` 的 `finalCodeBlockFix`）—— 在 `<code>` 的 inline style 末尾追加 `white-space:pre;`
   - 之前是用 regex 在 style 值里找到 `white-space:旧值` 替换成 `white-space:pre`，但万一 style 属性内容被 reorder 就匹配不到
   - 现在直接在 style 末尾追加 `white-space:pre;`（CSS cascade 以最后的值为准，即使前面有 `pre-wrap` 也被覆盖）
   - 改成 `nowrap` → ASCII art 的多空格被折叠
   - 改成 `pre-wrap` → 长行会折行，同样破坏 ASCII art
   - 配合 `overflow-x:auto` 让长行横向滚动

2. **复制富文本路径**（`src/ui/preview-view.ts` 的 `copyRichText`）—— Obsidian 自带的 `MarkdownRenderer.render` 会给 `<code>` 加 `white-space: pre-wrap` 的 inline style。要在它渲染完之后手动把 `pre > code` 的 `style.whiteSpace` 改成 `"pre"`，否则复制出去的富文本也是折行的

`fixCodeBlockStyles` 里把行首空格转 `&nbsp;`、`\n` 转 `<br>`、`</span> <span>` 之间的空格转 `&nbsp;` —— 这些是 `white-space:nowrap` 历史遗留的兜底，改 white-space 时不要顺手删了

## wechat-formatter 的几个坑

`format()` 流水线：

1. `markdown-it` 渲染
2. 图片占位符替换
3. `sanitizeForWechat` 去掉 `<script>` / `<style>` / `on*` 事件
4. **juice 内联 CSS**（测试里被 mock 掉）
5. `fixCodeBlockStyles` 正则保护空格（字符串层操作，刻意不用 DOM）
6. `convertListsToSection` — **用 `innerHTML` 走 DOM**，把 `<ul>/<ol>` 替换成 `<section>` 模拟微信里列表的展示
7. `styleCallouts` — 同上，DOM 操作给 `blockquote` 加图标背景
8. `finalCodeBlockFix` — 兜底 white-space + overflow-x

注意：第 6/7 步是 DOM 操作。`tmp.innerHTML = html; ... return tmp.innerHTML;` 这种写法会被浏览器解析器规范化空白。如果改这两步，发现代码块里的空格被吃了，先怀疑这里。

`formatForCopy()`（剪贴板复制场景）走的是另一条路径：保留 `<ul>/<ol>/<li>`、不做列表转 section、不调用 `finalCodeBlockFix`、最后 `class="..."` 全清掉。改一处时记得两条路径一起看。

## Obsidian API 调试

测试里 `obsidian` 整个包被 mock 了（`src/__mocks__/obsidian.ts`）。所有用到的类（`App`, `Plugin`, `ItemView`, `Modal`, `Notice`, `Setting`, `TFile`, `WorkspaceLeaf`, `Component` 等）都有 stub。想看 mock 提供了什么就直接读那个文件。

如果你新加的代码用了 mock 里没覆盖的 obsidian API：
- 优先在 `src/__mocks__/obsidian.ts` 里加 stub
- 不要在测试里写 `jest.mock('obsidian', () => ...)` 局部 mock，跟现有风格不一致

## 命名 / 风格

- 注释和用户面向的字符串混用中英文（README 有中英两版，UI 文案中文为主，代码注释看作者心情）
- TypeScript 用 `interface` 还是 `type` 看具体文件，没强约束
- 内部类成员方法常用 `private`，需要测试时考虑放宽或拆函数
- 路径用 `src/...`，shell 用 bash 风格（项目是 Windows + bash，提交里都是正斜杠）

## 发布前自查清单

改动涉及 `wechat-formatter.ts` / `markdown-renderer.ts` 时：

1. `pnpm test` 全过
2. `pnpm run build` 成功
3. 如果改动了 CSS 内联相关逻辑，手动在 Obsidian 里跑一遍：
   - 一段普通代码（看高亮、缩进、横向滚动）
   - 一段 ASCII art 代码块（**核心**：多空格不能被吞）
   - 一个有序 / 无序列表
   - 一个 callout（`> [!note]` 等）
   - 一个 mermaid 图
4. 如果改了 `manifest.json` 的 `version`，发版时打 tag
