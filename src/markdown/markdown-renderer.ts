import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

export interface RenderOptions {
    showLineNumbers?: boolean;
}

const WECHAT_CSS = `
#wemd {
    font-size: 16px;
    line-height: 1.8;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

#wemd h1, #wemd h2, #wemd h3, #wemd h4, #wemd h5, #wemd h6 {
    margin: 24px 0 16px;
    font-weight: 600;
    line-height: 1.4;
    color: #1a1a1a;
}

#wemd h1 { font-size: 24px; }
#wemd h2 { font-size: 22px; }
#wemd h3 { font-size: 20px; }
#wemd h4 { font-size: 18px; }
#wemd h5 { font-size: 16px; }
#wemd h6 { font-size: 14px; }

#wemd p {
    margin: 16px 0;
    text-align: justify;
    word-break: break-word;
}

#wemd strong {
    font-weight: 600;
    color: #1a1a1a;
}

#wemd em {
    font-style: italic;
}

#wemd del {
    text-decoration: line-through;
    opacity: 0.7;
}

#wemd mark {
    background-color: #fff3cd;
    padding: 2px 4px;
    border-radius: 3px;
}

#wemd a {
    color: #576b95;
    text-decoration: none;
}

#wemd ul, #wemd ol {
    margin: 16px 0;
    padding-left: 24px;
}

#wemd li {
    margin: 8px 0;
}

#wemd blockquote {
    margin: 16px 0;
    padding: 12px 16px;
    border-left: 4px solid #576b95;
    background-color: #f8f9fa;
    border-radius: 0 4px 4px 0;
    color: #666;
}

#wemd blockquote p {
    margin: 0;
}

#wemd pre {
    margin: 16px 0;
    padding: 16px;
    background-color: #f6f8fa;
    border-radius: 6px;
    overflow-x: auto;
    border: 1px solid #e1e4e8;
}

#wemd code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    font-size: 14px;
    line-height: 1.6;
}

#wemd :not(pre) > code {
    background-color: rgba(175, 184, 193, 0.2);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
}

#wemd pre code {
    display: block;
    background: none;
    padding: 0;
    white-space: pre;
    word-wrap: normal;
    overflow-x: auto;
    tab-size: 4;
}

#wemd img {
    max-width: 100%;
    border-radius: 4px;
    margin: 16px 0;
}

#wemd table {
    width: 100%;
    margin: 16px 0;
    border-collapse: collapse;
    border-spacing: 0;
}

#wemd th, #wemd td {
    padding: 12px;
    border: 1px solid #e1e4e8;
    text-align: left;
}

#wemd th {
    background-color: #f6f8fa;
    font-weight: 600;
}

#wemd tr:nth-child(2n) {
    background-color: #f8f9fa;
}

#wemd hr {
    margin: 24px 0;
    border: none;
    border-top: 1px solid #e1e4e8;
}

/* Highlight.js 样式模拟 */
#wemd .hljs-keyword { color: #d73a49; font-weight: bold; }
#wemd .hljs-string { color: #032f62; }
#wemd .hljs-number { color: #005cc5; }
#wemd .hljs-comment { color: #6a737d; font-style: italic; }
#wemd .hljs-function { color: #6f42c1; }
#wemd .hljs-variable { color: #e36209; }
#wemd .hljs-operator { color: #d73a49; }
#wemd .hljs-punctuation { color: #24292e; }
#wemd .hljs-property { color: #005cc5; }
#wemd .hljs-tag { color: #22863a; }
#wemd .hljs-attr { color: #6f42c1; }
#wemd .hljs-built_in { color: #e36209; }
`;

export class MarkdownRenderer {
    private md: MarkdownIt;

    constructor(options: RenderOptions = {}) {
        this.md = new MarkdownIt({
            html: true,
            breaks: true,
            linkify: true,
            highlight: (str, lang) => {
                if (lang === "mermaid") {
                    return `<pre class="mermaid">${this.md.utils.escapeHtml(str)}</pre>`;
                }

                if (lang && hljs.getLanguage(lang)) {
                    try {
                        const highlighted = hljs.highlight(str, { language: lang }).value;
                        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
                    } catch {
                        // ignore
                    }
                }

                return `<pre><code class="hljs">${this.md.utils.escapeHtml(str)}</code></pre>`;
            },
        });
    }

    render(markdown: string): string {
        // 处理 Obsidian 特有语法
        markdown = this.processObsidianSyntax(markdown);

        // 使用 markdown-it 渲染
        const html = this.md.render(markdown);

        // 包裹微信容器
        return `<section id="wemd">${html}</section>`;
    }

    private processObsidianSyntax(content: string): string {
        let processed = content;

        // 高亮 ==text==
        processed = processed.replace(/==(.*?)==/g, "<mark>$1</mark>");

        // 删除线 ~~text~~
        processed = processed.replace(/~~(.*?)~~/g, "<del>$1</del>");

        // WikiLink [[text]] -> text
        processed = processed.replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (match, p1, p2) => {
            return p2 || p1;
        });

        // Embed ![[file]] -> 保留标记
        processed = processed.replace(/!\[\[(.*?)\]\]/g, "![嵌入文件]($1)");

        // Callout > [!type]
        processed = processed.replace(
            /^>(\s*)\[!([\w-]+)\](.*)$/gim,
            (match, spaces, type, title) => {
                const labels: Record<string, string> = {
                    note: "💡 注意",
                    tip: "💡 提示",
                    warning: "⚠️ 警告",
                    danger: "⛔ 危险",
                    info: "ℹ️ 信息",
                    success: "✅ 成功",
                    question: "❓ 问题",
                    bug: "🐛 Bug",
                    example: "📝 示例",
                    quote: "💬 引用",
                };
                const label = labels[type.toLowerCase()] || type;
                const cleanTitle = title.trim() || label;
                return `> **${cleanTitle}**`;
            }
        );

        // 注释 %%comment%%
        processed = processed.replace(/%%.*?%%/gs, "");

        return processed;
    }

    getWechatCss(): string {
        return WECHAT_CSS;
    }
}
