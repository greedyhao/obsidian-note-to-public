import juice from "juice";
import { MarkdownRenderer } from "./markdown-renderer";

export class WechatFormatter {
    private renderer: MarkdownRenderer;

    constructor() {
        this.renderer = new MarkdownRenderer();
    }

    // 微信 API 发布专用（列表转 section，代码换行转 <br>）
    format(markdownContent: string, imageMap: Map<string, string>): string {
        let html = this.renderer.render(markdownContent);

        for (const [placeholder, url] of imageMap) {
            html = html.replace(`<!-- ${placeholder} -->`, `<img src="${url}" style="max-width:100%;border-radius:4px;margin:16px 0;" />`);
        }

        html = this.sanitizeForWechat(html);

        const css = this.renderer.getWechatCss();
        html = this.inlineStyles(html, css);

        // 代码块处理（正则，不用 DOM，防止丢失空格）
        html = this.fixCodeBlockStyles(html);

        html = this.convertListsToSection(html);
        html = this.styleCallouts(html);
        html = this.finalCodeBlockFix(html);

        return html;
    }

    // 复制专用（保留 <ul>/<ol>/<li>，内联 CSS）
    formatForCopy(markdownContent: string, imageMap: Map<string, string>): string {
        let html = this.renderer.render(markdownContent);

        for (const [placeholder, url] of imageMap) {
            html = html.replace(`<!-- ${placeholder} -->`, `<img src="${url}" style="max-width:100%;border-radius:4px;margin:16px 0;" />`);
        }

        html = this.sanitizeForWechat(html);

        const css = this.renderer.getWechatCss();
        html = this.inlineStyles(html, css);

        html = this.fixCodeBlockStyles(html);

        // 清理 class（内联后不需要）
        html = html.replace(/ class="[^"]*"/g, "");

        html = this.styleCallouts(html);

        return html;
    }

    private sanitizeForWechat(html: string): string {
        html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
        html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
        html = html.replace(/\s*on\w+="[^"]*"/gi, "");
        return html;
    }

    private inlineStyles(html: string, css: string): string {
        try {
            return juice.inlineContent(html, css, {
                inlinePseudoElements: false,
                preserveImportant: true,
            });
        } catch (e) {
            console.error("Juice inline error:", e);
            return html;
        }
    }

    // 代码块样式处理（正则方式，参考 WeMD ThemeProcessor）
    // 不用 DOM，防止 span 间的空格被浏览器吃掉
    private fixCodeBlockStyles(html: string): string {
        return html.replace(
            /<code([^>]*)>([\s\S]*?)<\/code>/g,
            (match, attrs, inner) => {
                let protected_ = inner;

                // 1. 保护行首空格（缩进）—— 参考 WeMD ThemeProcessor
                protected_ = protected_.replace(/\n( +)/g, (m: string, spaces: string) => {
                    return "\n" + "&nbsp;".repeat(spaces.length);
                });
                protected_ = protected_.replace(/^( +)/, (m: string, spaces: string) => {
                    return "&nbsp;".repeat(spaces.length);
                });

                // 2. tab -> 4个 &nbsp;
                protected_ = protected_.replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");

                // 3. \n -> <br>（防止微信 API 吃掉换行）
                protected_ = protected_.replace(/\n/g, "<br>");

                // 4. span 间的空格保护 —— 只替换 `>text</span> <span>text<` 形式的空格
                //    注意：必须在字符串层面操作，不涉及 DOM，防止空格丢失
                protected_ = protected_.replace(/<\/span> +<span/g, function(m) {
                    return m.replace(/ /g, "&nbsp;");
                });

                return `<code${attrs}>${protected_}</code>`;
            }
        );
    }

    // 列表转 section（DOM 方式）
    private convertListsToSection(html: string): string {
        const tmp = document.createElement("div");
        tmp.innerHTML = html;

        const convertList = (listEl: HTMLElement, depth: number = 0) => {
            const isOl = listEl.tagName.toLowerCase() === "ol";
            const items = Array.from(listEl.children).filter(
                (c) => c.tagName.toLowerCase() === "li"
            ) as HTMLElement[];

            const container = document.createElement("section");
            container.style.cssText = "display:block;margin:16px 0;padding:0;";

            items.forEach((li, idx) => {
                const itemSection = document.createElement("section");
                itemSection.style.cssText = `display:block;margin:6px 0;padding-left:${depth > 0 ? 1.5 : 0}em;line-height:1.8;`;

                const marker = document.createElement("section");
                marker.style.cssText = "display:inline;margin-right:0.25em;color:#333;";
                marker.textContent = isOl ? `${idx + 1}. ` : "• ";
                itemSection.appendChild(marker);

                const content = document.createElement("section");
                content.style.cssText = "display:inline;";

                const nestedLists: HTMLElement[] = [];
                while (li.childNodes.length > 0) {
                    const child = li.childNodes[0] as HTMLElement;
                    if (child.nodeType === 1 && (child.tagName === "UL" || child.tagName === "OL")) {
                        nestedLists.push(child);
                        li.removeChild(child);
                    } else {
                        content.appendChild(child);
                    }
                }

                content.querySelectorAll("p").forEach((p) => {
                    (p as HTMLElement).style.display = "inline";
                    (p as HTMLElement).style.margin = "0";
                });

                itemSection.appendChild(content);
                container.appendChild(itemSection);

                nestedLists.forEach((nested) => {
                    convertList(nested, depth + 1);
                    container.appendChild(nested);
                });
            });

            listEl.parentNode?.replaceChild(container, listEl);
        };

        tmp.querySelectorAll("ul, ol").forEach((list) => convertList(list as HTMLElement));
        return tmp.innerHTML;
    }

    // Callout 样式
    private styleCallouts(html: string): string {
        const tmp = document.createElement("div");
        tmp.innerHTML = html;

        tmp.querySelectorAll("blockquote").forEach((bq) => {
            const firstP = bq.querySelector("p");
            if (!firstP) return;
            const text = firstP.textContent || "";

            const calloutTypes: Record<string, { bg: string; border: string; color: string }> = {
                "💡": { bg: "#e8f0fe", border: "#448aff", color: "#448aff" },
                "⚠️": { bg: "#fff8e1", border: "#ff9100", color: "#ff9100" },
                "⛔": { bg: "#ffeef0", border: "#ff1744", color: "#ff1744" },
                "ℹ️": { bg: "#e8f0fe", border: "#448aff", color: "#448aff" },
                "✅": { bg: "#e8f5e9", border: "#00c853", color: "#00c853" },
                "❓": { bg: "#fff8e1", border: "#ff9100", color: "#ff9100" },
                "🐛": { bg: "#ffeef0", border: "#ff1744", color: "#ff1744" },
                "📝": { bg: "#f3e8fd", border: "#7c4dff", color: "#7c4dff" },
                "💬": { bg: "#f5f5f5", border: "#9e9e9e", color: "#757575" },
            };

            for (const [icon, style] of Object.entries(calloutTypes)) {
                if (text.includes(icon)) {
                    (bq as HTMLElement).style.backgroundColor = style.bg;
                    (bq as HTMLElement).style.borderLeft = `4px solid ${style.border}`;
                    (bq as HTMLElement).style.borderRadius = "0 6px 6px 0";
                    (bq as HTMLElement).style.padding = "12px 16px";
                    (bq as HTMLElement).style.margin = "16px 0";
                    (firstP as HTMLElement).style.color = style.color;
                    (firstP as HTMLElement).style.fontWeight = "600";
                    (firstP as HTMLElement).style.margin = "0 0 8px 0";
                    break;
                }
            }
        });

        return tmp.innerHTML;
    }

    // 最后兜底：确保代码块可横向滚动
    private finalCodeBlockFix(html: string): string {
        html = html.replace(
            /(<code[^>]*style="[^"]*)white-space:\s*[^;"'`]+/g,
            '$1white-space:nowrap'
        );
        html = html.replace(
            /(<pre[^>]*style="[^"]*)(")/g,
            (match, before, quote) => {
                if (before.includes('overflow-x')) return match;
                return `${before}overflow-x:auto;${quote}`;
            }
        );
        return html;
    }

    generateDigest(content: string, maxLength: number = 54): string {
        const plainText = content.replace(/<[^>]+>/g, "");
        const cleaned = plainText.replace(/\s+/g, " ").trim();
        if (cleaned.length <= maxLength) return cleaned;
        return cleaned.substring(0, maxLength) + "...";
    }
}
