import { App, ItemView, WorkspaceLeaf, TFile, Notice, MarkdownRenderer, Component } from "obsidian";
import { ObsidianParser } from "../markdown/obsidian-parser";
import { WechatFormatter } from "../markdown/wechat-formatter";
import { MermaidRenderer } from "../markdown/mermaid-renderer";
import { NoteToPublicSettings } from "../settings";

export const VIEW_TYPE_PREVIEW = "note-to-public-preview";

export class PreviewView extends ItemView {
    private currentFile: TFile | null = null;
    private settings: NoteToPublicSettings;
    private contentEl!: HTMLElement;
    private markdownRenderer: import("../markdown/markdown-renderer").MarkdownRenderer;
    private mermaidRenderer: MermaidRenderer;
    private app: App;

    constructor(leaf: WorkspaceLeaf, settings: NoteToPublicSettings, app?: App) {
        super(leaf);
        this.settings = settings;
        this.app = app || leaf.view.app;
        this.markdownRenderer = new (require("../markdown/markdown-renderer").MarkdownRenderer)();
        this.mermaidRenderer = new MermaidRenderer(this.app);
    }

    getViewType() { return VIEW_TYPE_PREVIEW; }
    getDisplayText() { return "发布预览"; }
    getIcon() { return "eye"; }

    async onOpen() {
        const viewContent = this.containerEl.querySelector(".view-content") as HTMLElement;
        if (viewContent) {
            this.contentEl = viewContent;
            this.contentEl.className = "view-content note-to-public-preview";
        } else {
            this.contentEl = this.containerEl.createDiv({ cls: "note-to-public-preview" });
        }
        this.addStyles();
        this.showEmptyState();
    }

    async onClose() {}

    setSettings(settings: NoteToPublicSettings) { this.settings = settings; }

    // 工具栏
    private createToolbar() {
        const toolbar = this.contentEl.createDiv({ cls: "preview-toolbar" });
        toolbar.innerHTML = `
            <span class="preview-toolbar-title">发布预览</span>
            <div class="preview-toolbar-actions">
                <button class="copy-html-btn" title="复制为富文本（base64 图片）">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    复制富文本
                </button>
                <button class="copy-md-btn" title="复制为 Markdown">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    复制 Markdown
                </button>
            </div>`;
        toolbar.querySelector(".copy-html-btn")?.addEventListener("click", () => this.copyRichText());
        toolbar.querySelector(".copy-md-btn")?.addEventListener("click", () => this.copyMarkdown());
    }

    private createPreviewArea() { this.contentEl.createDiv({ cls: "preview-scroll-area" }); }

    private get previewArea() {
        return this.contentEl.querySelector(".preview-scroll-area") as HTMLElement;
    }

    // 复制 Markdown 原文
    private async copyMarkdown() {
        if (!this.currentFile) return;
        const content = await this.app.vault.read(this.currentFile);
        await navigator.clipboard.writeText(content);
        new Notice("已复制 Markdown 到剪贴板");
    }

    // 复制富文本（base64 图片）
    private async copyRichText() {
        if (!this.currentFile) return;
        try {
            const content = await this.app.vault.read(this.currentFile);
            const parser = new ObsidianParser(content, this.currentFile.path);
            const parsed = parser.parse();

            // 渲染 Mermaid 为 base64 PNG
            const imageMap = new Map<string, string>();
            const mermaidRe = /```mermaid\n([\s\S]*?)```/g;
            let m: RegExpExecArray | null;
            let idx = 0;
            while ((m = mermaidRe.exec(parsed.content)) !== null) {
                const placeholder = `<<<MERMAID_${idx++}>>>`;
                try {
                    const svg = await this.mermaidRenderer.renderToSVG(m[1]);
                    const svgEl = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("svg");
                    if (!svgEl) continue;
                    let w = 800, h = 600;
                    const vb = svgEl.getAttribute("viewBox");
                    if (vb) { const p = vb.split(/[\s,]+/).map(Number); if (p.length >= 4) { w = p[2]; h = p[3]; } }
                    const tw = 800, th = Math.round((h / w) * tw);
                    svgEl.setAttribute("width", `${tw}`);
                    svgEl.setAttribute("height", `${th}`);
                    const c = document.createElement("canvas");
                    c.width = tw * 2; c.height = th * 2;
                    const cx = c.getContext("2d")!;
                    cx.fillStyle = "white"; cx.fillRect(0, 0, c.width, c.height); cx.scale(2, 2);
                    const blob = new Blob([new XMLSerializer().serializeToString(svgEl)], { type: "image/svg+xml;charset=utf-8" });
                    const burl = URL.createObjectURL(blob);
                    const dataUrl: string = await new Promise((res, rej) => {
                        const img = new Image();
                        img.onload = () => { cx.drawImage(img, 0, 0, tw, th); URL.revokeObjectURL(burl); res(c.toDataURL("image/png")); };
                        img.onerror = () => { URL.revokeObjectURL(burl); rej(new Error("fail")); };
                        img.src = burl;
                    });
                    imageMap.set(placeholder, dataUrl);
                } catch (e) { console.error("Mermaid:", e); }
            }

            // 本地图片转 base64
            const localImgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
            let imgMatch: RegExpExecArray | null;
            while ((imgMatch = localImgRe.exec(parsed.content)) !== null) {
                const path = imgMatch[2];
                if (path.startsWith("http") || path.startsWith("data:")) continue;
                const placeholder = `<<<IMG_${idx++}>>>`;
                try {
                    const full = this.resolvePath(path);
                    const f = full ? this.app.vault.getAbstractFileByPath(full) : null;
                    if (f && f instanceof TFile) {
                        const bin = await this.app.vault.readBinary(f);
                        const b = this.arrayBufferToBase64(bin);
                        imageMap.set(placeholder, `data:image/${f.extension || "png"};base64,${b}`);
                    }
                } catch { /* skip */ }
            }

            // 渲染 Markdown 为 HTML（用 Obsidian 自带渲染器）
            const tempDiv = document.createElement("div");
            tempDiv.style.position = "fixed";
            tempDiv.style.left = "-9999px";
            document.body.appendChild(tempDiv);
            const comp = new Component();
            comp.load();
            await MarkdownRenderer.render(this.app, parsed.content, tempDiv, this.currentFile.path, comp);
            await new Promise(r => setTimeout(r, 500));

            // 修掉 Obsidian 默认给 <code> 加的 white-space: pre-wrap
            // 否则 ASCII 艺术里的多空格会在被复制/粘贴的目标里折行
            // 改为 pre 配合父级 <pre> 的 overflow-x:auto 横向滚动
            for (const codeEl of Array.from(tempDiv.querySelectorAll("pre > code"))) {
                const htmlEl = codeEl as HTMLElement;
                htmlEl.style.whiteSpace = "pre";
            }

            // Mermaid SVG → PNG
            for (const mermaidEl of Array.from(tempDiv.querySelectorAll(".mermaid, pre.mermaid"))) {
                const svgEl = mermaidEl.querySelector("svg");
                if (!svgEl) continue;
                const vb = svgEl.getAttribute("viewBox");
                let w = 800, h = 600;
                if (vb) { const p = vb.split(/[\s,]+/).map(Number); if (p.length >= 4) { w = p[2]; h = p[3]; } }
                const tw = 800, th = Math.round((h / w) * tw);
                svgEl.setAttribute("width", `${tw}`); svgEl.setAttribute("height", `${th}`);
                const c = document.createElement("canvas");
                c.width = tw * 2; c.height = th * 2;
                const cx = c.getContext("2d")!;
                cx.fillStyle = "white"; cx.fillRect(0, 0, c.width, c.height); cx.scale(2, 2);
                const blob = new Blob([new XMLSerializer().serializeToString(svgEl)], { type: "image/svg+xml;charset=utf-8" });
                const burl = URL.createObjectURL(blob);
                const dataUrl: string = await new Promise((res, rej) => {
                    const img = new Image();
                    img.onload = () => { cx.drawImage(img, 0, 0, tw, th); URL.revokeObjectURL(burl); res(c.toDataURL("image/png")); };
                    img.onerror = () => { URL.revokeObjectURL(burl); rej(new Error("fail")); };
                    img.src = burl;
                });
                const pngImg = document.createElement("img");
                pngImg.src = dataUrl;
                pngImg.style.cssText = "display:block;max-width:100%;margin:1em auto;";
                mermaidEl.parentNode?.replaceChild(pngImg, mermaidEl);
            }

            // 本地图片转 base64
            for (const imgEl of Array.from(tempDiv.querySelectorAll("img"))) {
                const src = imgEl.getAttribute("src") || "";
                if (src.startsWith("http") || src.startsWith("data:")) continue;
                const full = this.resolvePath(src.split("?")[0].split("#")[0]);
                const f = full ? this.app.vault.getAbstractFileByPath(full) : null;
                if (f && f instanceof TFile) {
                    const bin = await this.app.vault.readBinary(f);
                    const b = this.arrayBufferToBase64(bin);
                    imgEl.src = `data:image/${f.extension || "png"};base64,${b}`;
                }
            }

            // 等待所有图片加载完成
            for (const img of Array.from(tempDiv.querySelectorAll("img[src^='data:image/']"))) {
                if (!img.complete) {
                    try { await img.decode(); } catch {}
                }
            }

            comp.unload();

            // 检查图片尺寸
            for (const img of Array.from(tempDiv.querySelectorAll("img[src^='data:image/']"))) {
                console.log(`[NoteToPublic] 复制前图片尺寸: ${img.naturalWidth}x${img.naturalHeight}`,
                    `complete=${img.complete}`, `src.prefix=${img.getAttribute("src")?.slice(0, 40)}`);
            }

            // 调试：打印复制内容的图片信息
            console.group("[NoteToPublic] 复制调试");
            const allImgs = Array.from(tempDiv.querySelectorAll("img"));
            console.log(`共 ${allImgs.length} 张图片`);
            for (let i = 0; i < allImgs.length; i++) {
                const img = allImgs[i];
                const src = img.getAttribute("src") || "";
                console.log(`图片 ${i}: src.length=${src.length}, src.prefix=${src.substring(0, 40)}, complete=${img.complete}`);
                if (!img.complete) {
                    try { await img.decode(); console.log(`图片 ${i} decode 完成`); }
                    catch (e) { console.warn(`图片 ${i} decode 失败:`, e); }
                }
            }
            console.log(`HTML 长度: ${tempDiv.innerHTML.length}`);
            console.groupEnd();

            const html = tempDiv.innerHTML;

            // 从 data URL 提取第一张图片作为 image/png 写入剪贴板
            let pngBlob: Blob | null = null;
            const firstImg = tempDiv.querySelector("img[src^='data:image/']");
            if (firstImg) {
                const src = firstImg.getAttribute("src") || "";
                const match = src.match(/^data:image\/\w+;base64,(.+)$/);
                if (match) {
                    const bstr = atob(match[1]);
                    const arr = new Uint8Array(bstr.length);
                    for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
                    pngBlob = new Blob([arr], { type: "image/png" });
                    console.log(`[NoteToPublic] PNG blob: ${pngBlob.size} bytes, type=${pngBlob.type}`);

                    // 验证 PNG 有效性
                    const testImg = new Image();
                    const testUrl = URL.createObjectURL(pngBlob);
                    try {
                        await new Promise<void>((res, rej) => {
                            testImg.onload = () => { console.log(`[NoteToPublic] PNG 验证: 有效, ${testImg.naturalWidth}x${testImg.naturalHeight}`); res(); };
                            testImg.onerror = () => { console.warn("[NoteToPublic] PNG 验证: 无效"); res(); };
                            testImg.src = testUrl;
                        });
                    } finally {
                        URL.revokeObjectURL(testUrl);
                    }
                }
            }
            console.log(`HTML 长度: ${tempDiv.innerHTML.length}`);
            console.groupEnd();

            document.body.removeChild(tempDiv);

            // 用 ClipboardItem 写入 text/html + text/plain
            try {
                const plainText = html.replace(/<[^>]+>/g, '').replace(/\n\s+/g, '\n').trim();
                const item = new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([plainText], { type: 'text/plain' }),
                });
                await navigator.clipboard.write([item]);
                console.log("[NoteToPublic] ClipboardItem 写入成功");

                // 验证：读回剪贴板看看
                try {
                    const readHtml = await navigator.clipboard.readText();
                    console.log(`[NoteToPublic] 读回调文本前 100 字: ${readHtml.slice(0, 100).replace(/\n/g, ' ')}`);
                    // 读 HTML 格式（Clipboard API 有限制，只读得到 text/plain）
                    const items = await navigator.clipboard.read();
                    if (items.length > 0) {
                        const types = items[0].types;
                        console.log(`[NoteToPublic] 剪贴板中类型: ${types.join(', ')}`);
                    }
                } catch (readErr) {
                    console.warn("[NoteToPublic] 读取剪贴板验证失败:", readErr);
                }

                new Notice("已复制富文本到剪贴板");
            } catch (e) {
                console.error("[NoteToPublic] 复制失败:", e);
                new Notice("复制失败");
            }
        } catch (e) {
            console.error("复制失败:", e);
            new Notice("复制失败: " + (e instanceof Error ? e.message : String(e)));
        }
    }

    private resolvePath(path: string): string {
        if (!this.currentFile) return path;
        const dir = this.currentFile.parent?.path || "";
        if (path.startsWith("./") || path.startsWith("../")) {
            const parts = dir.split("/");
            for (const p of path.split("/")) {
                if (p === "..") parts.pop();
                else if (p !== "." && p !== "") parts.push(p);
            }
            return parts.join("/");
        }
        return path.startsWith("/") ? path.slice(1) : path;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    async previewFile(file: TFile | null) {
        if (!file || file.extension !== "md") { this.showEmptyState(); return; }
        this.currentFile = file;
        try {
            const content = await this.app.vault.read(file);
            const parser = new ObsidianParser(content, file.path);
            const parsed = parser.parse();
            const { content: c, mermaidBlocks, images } = this.parseContent(parsed.content);
            await this.renderPreview({ title: parsed.metadata.title, author: parsed.metadata.author || this.settings.wechat.defaultAuthor || "作者", digest: parsed.metadata.description || "", content: c, mermaidBlocks, images });
        } catch (e) {
            console.error("预览失败:", e);
            this.showError("预览失败: " + (e instanceof Error ? e.message : String(e)));
        }
    }

    private parseContent(content: string) {
        const mermaidBlocks = new Map<string, string>();
        const images = new Map<string, { alt: string; path: string }>();
        this.tempCodeBlocks = new Map();
        let processed = content, blockIndex = 0;
        processed = processed.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
            const id = blockIndex++;
            if (lang === "mermaid") mermaidBlocks.set(`MERMAID_${id}`, code.trim());
            else this.tempCodeBlocks.set(`<<<CODE_${id}>>>`, { content: code, lang });
            return `<<<CODE_${id}>>>`;
        });
        processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, path) => {
            if (!path.startsWith("http") && !path.startsWith("data:")) {
                const id = `IMAGE_${blockIndex++}`;
                images.set(id, { alt, path });
                return `<<<IMG_${id}>>>`;
            }
            return _;
        });
        return { content: processed, mermaidBlocks, images };
    }

    private tempCodeBlocks = new Map<string, { content: string; lang?: string }>();

    private restoreCodeBlocks(content: string, mermaidBlocks: Map<string, string>): string {
        this.tempCodeBlocks.forEach(({ content: code, lang }, ph) => {
            content = content.replace(ph, `\`\`\`${lang || ""}\n${code}\n\`\`\``);
        });
        mermaidBlocks.forEach((code, id) => {
            content = content.replace(`<<<CODE_${id.replace("MERMAID_", "")}>>>`, `\`\`\`mermaid\n${code}\n\`\`\``);
        });
        return content;
    }

    private async renderMermaidChart(code: string, container: HTMLElement) {
        try {
            const svg = await this.mermaidRenderer.renderToSVG(code);
            container.innerHTML = svg;
            container.style.cssText = "text-align:center;margin:16px 0;padding:16px;background:var(--background-secondary);border-radius:8px;";
            // 设置 SVG 自适应
            const svgEl = container.querySelector("svg");
            if (svgEl) {
                svgEl.style.maxWidth = "100%";
                svgEl.style.height = "auto";
            }
        } catch (error) {
            console.error("Mermaid 渲染失败:", error);
            container.innerHTML = `<div style="color:var(--text-error);padding:16px;text-align:center;background:var(--background-secondary);border-radius:8px;">Mermaid 渲染失败</div>`;
        }
    }

    private async renderPreview(data: { title: string; author: string; digest: string; content: string; mermaidBlocks: Map<string, string>; images: Map<string, { alt: string; path: string }> }) {
        this.contentEl.empty();
        this.contentEl.className = "view-content note-to-public-preview";
        this.createToolbar();
        this.createPreviewArea();

        const area = this.previewArea;

        // 头部
        const header = area.createDiv({ cls: "preview-header" });
        header.createEl("h3", { text: data.title || "无标题", cls: "preview-title" });
        const meta = header.createDiv({ cls: "preview-meta-row" });
        if (data.author) meta.createSpan({ cls: "preview-author", text: `👤 ${data.author}` });
        if (data.digest) header.createDiv({ cls: "preview-digest" }).createEl("em", { text: data.digest });

        const restored = this.restoreCodeBlocks(data.content, data.mermaidBlocks);
        const html = this.markdownRenderer.render(restored);

        const contentDiv = area.createDiv({ cls: "preview-content" });
        contentDiv.innerHTML = html;

        // Mermaid
        for (const el of Array.from(contentDiv.querySelectorAll("pre.mermaid"))) {
            const code = el.textContent || "";
            const wrapper = document.createElement("div");
            wrapper.className = "mermaid-container";
            el.parentNode?.replaceChild(wrapper, el);
            await this.renderMermaidChart(code, wrapper);
        }

        // 图片占位符
        data.images.forEach(({ alt, path }, imageId) => {
            const ph = `<<<IMG_${imageId}>>>`;
            const nodes = this.findTextNodes(contentDiv);
            for (const node of nodes) {
                if (node.textContent?.includes(ph)) {
                    const span = document.createElement("span");
                    span.innerHTML = `<div class="image-placeholder-preview"><span class="placeholder-icon">🖼️</span><span class="placeholder-text">${alt || path}</span></div>`;
                    node.parentNode?.replaceChild(span, node);
                    break;
                }
            }
        });

        area.createDiv({ cls: "preview-footer" }).innerHTML = `<span class="footer-hint">💡 使用「发布到微信公众号」命令发布</span>`;
    }

    private findTextNodes(el: HTMLElement): Node[] {
        const nodes: Node[] = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        let n; while ((n = walker.nextNode())) nodes.push(n);
        return nodes;
    }

    private showEmptyState() {
        this.contentEl.empty();
        this.contentEl.className = "view-content note-to-public-preview";
        this.createToolbar();
        this.createPreviewArea();
        const es = this.previewArea.createDiv({ cls: "preview-empty" });
        es.createEl("div", { text: "👁️", cls: "preview-empty-icon" });
        es.createEl("h4", { text: "点击 Markdown 文件查看发布预览" });
        es.createEl("p", { text: "预览将显示文章在微信中的渲染效果", cls: "preview-empty-hint" });
    }

    private showError(msg: string) {
        this.previewArea.empty();
        this.previewArea.createDiv({ cls: "preview-error" }).setText(msg);
    }

    private addStyles() {
        const s = document.createElement("style");
        s.textContent = `
            .note-to-public-preview { display:flex;flex-direction:column;height:100%;overflow:hidden;font-size:16px;line-height:1.6;color:var(--text-normal); }
            .preview-toolbar { display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--background-secondary);border-bottom:1px solid var(--background-modifier-border);flex-shrink:0; }
            .preview-toolbar-title { font-weight:600;font-size:14px; }
            .preview-toolbar-actions { display:flex;gap:8px; }
            .copy-html-btn,.copy-md-btn { display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--interactive-accent);color:var(--text-on-accent);border:none;border-radius:6px;font-size:12px;cursor:pointer; }
            .copy-html-btn:hover,.copy-md-btn:hover { opacity:0.9; }
            .preview-scroll-area { flex:1;overflow-y:auto;overflow-x:hidden;padding:20px; }
            .preview-header { margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--background-modifier-border); }
            .preview-title { margin:0 0 12px 0;font-size:24px;font-weight:600;line-height:1.3; }
            .preview-meta-row { display:flex;gap:16px;margin-bottom:8px;color:var(--text-muted);font-size:13px; }
            .preview-author { display:flex;align-items:center;gap:4px; }
            .preview-digest { margin-top:12px;padding:12px;background:var(--background-secondary);border-radius:6px;font-size:14px;color:var(--text-muted);line-height:1.5; }
            .preview-stats { margin-top:12px;padding:8px 12px;background:var(--background-primary-alt);border-radius:6px;font-size:12px;color:var(--text-accent); }
            .preview-content { margin-top:20px; }
            .preview-content h1,.preview-content h2,.preview-content h3,.preview-content h4,.preview-content h5,.preview-content h6 { margin:24px 0 16px;font-weight:600;line-height:1.4;color:var(--text-normal); }
            .preview-content h1 { font-size:24px; } .preview-content h2 { font-size:22px; } .preview-content h3 { font-size:20px; }
            .preview-content p { margin:16px 0; }
            .preview-content strong { font-weight:600; }
            .preview-content a { color:var(--text-accent);text-decoration:none; }
            .preview-content ul,.preview-content ol { margin:16px 0;padding-left:24px; }
            .preview-content li { margin:8px 0; }
            .preview-content blockquote { margin:16px 0;padding:12px 16px;border-left:4px solid var(--text-accent);background:var(--background-secondary);border-radius:0 6px 6px 0; }
            .preview-content blockquote p { margin:0; }
            .preview-content pre { margin:16px 0;padding:16px;background:var(--background-secondary-alt);border-radius:8px;overflow-x:auto;border:1px solid var(--background-modifier-border); }
            .preview-content code { font-family:"SF Mono",Monaco,Consolas,"Courier New",monospace;font-size:14px;line-height:1.6; }
            .preview-content :not(pre)>code { background:var(--background-secondary-alt);padding:2px 6px;border-radius:3px;font-size:0.9em; }
            .preview-content pre code { display:block;background:none;padding:0;white-space:pre;word-wrap:normal;overflow-x:auto; }
            .preview-content .hljs-keyword { color:#c586c0;font-weight:bold; }
            .preview-content .hljs-string { color:#ce9178; }
            .preview-content .hljs-number { color:#b5cea8; }
            .preview-content .hljs-comment { color:#6a9955;font-style:italic; }
            .preview-content .hljs-function { color:#dcdcaa; }
            .preview-content .hljs-variable { color:#9cdcfe; }
            .preview-content .mermaid-container { margin:16px 0;padding:16px;background:var(--background-secondary);border-radius:8px; }
            .preview-content .mermaid-container svg { max-width:100%;height:auto; }
            .preview-content .image-placeholder-preview { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;margin:16px 0;background:var(--background-secondary);border:2px dashed var(--background-modifier-border);border-radius:8px;color:var(--text-muted);text-align:center; }
            .preview-content .image-placeholder-preview .placeholder-icon { font-size:24px;margin-bottom:8px; }
            .preview-content .image-placeholder-preview .placeholder-text { font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
            .preview-empty { display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:60px;text-align:center;color:var(--text-muted); }
            .preview-empty-icon { font-size:48px;margin-bottom:16px; }
            .preview-empty h4 { margin:0 0 8px 0;color:var(--text-normal); }
            .preview-empty-hint { font-size:13px;opacity:0.7; }
            .preview-error { color:var(--text-error);padding:20px;text-align:center; }
            .preview-footer { margin-top:32px;padding-top:16px;border-top:1px solid var(--background-modifier-border);text-align:center; }
            .preview-footer .footer-hint { font-size:12px;color:var(--text-muted); }
        `;
        this.containerEl.appendChild(s);
    }
}
