import { App } from "obsidian";

// Obsidian 内部加载了 mermaid，通过 window 暴露
declare global {
    interface Window {
        mermaid?: {
            render: (id: string, code: string) => Promise<{ svg: string }>;
            initialize: (config: object) => void;
        };
    }
}

export class MermaidRenderer {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * 使用 Obsidian 内置的 mermaid 渲染
     */
    async renderToSVG(code: string): Promise<string> {
        // 等待 mermaid 加载完成
        await this.waitForMermaid();

        const mermaid = window.mermaid;
        if (!mermaid) {
            throw new Error("Mermaid 不可用，请确保 Obsidian 版本支持 Mermaid 渲染");
        }

        // 重新初始化，禁用 HTML 标签以确保 SVG 是纯 XML
        mermaid.initialize({
            startOnLoad: false,
            theme: "default",
            securityLevel: "strict",
            fontFamily: "sans-serif",
            htmlLabels: false,
            flowchart: {
                curve: "basis",
                padding: 15,
                htmlLabels: false,
            },
        });

        try {
            const { svg } = await mermaid.render("mermaid-" + Date.now(), code);
            return svg;
        } catch (error) {
            console.error("Mermaid 渲染失败:", error);
            throw new Error(`Mermaid 渲染失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async waitForMermaid(timeout: number = 5000): Promise<void> {
        const start = Date.now();
        while (!window.mermaid) {
            if (Date.now() - start > timeout) {
                throw new Error("等待 Mermaid 加载超时");
            }
            await new Promise(r => setTimeout(r, 100));
        }
    }

    async renderToArrayBuffer(code: string): Promise<ArrayBuffer> {
        const svg = await this.renderToSVG(code);
        return await this.svgToPngArrayBuffer(svg);
    }

    private async svgToPngArrayBuffer(svg: string): Promise<ArrayBuffer> {
        // 确保 xmlns 存在
        if (!svg.includes('xmlns=')) {
            svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        // 获取尺寸
        const viewBoxMatch = svg.match(/viewBox="([\d\s.]+)"/);
        let width = 800, height = 600;
        if (viewBoxMatch) {
            const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number);
            if (parts.length >= 4) {
                width = parts[2];
                height = parts[3];
            }
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("无法创建 canvas context");
        }

        // 2x 缩放提高清晰度
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);

        const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as ArrayBuffer);
                        reader.readAsArrayBuffer(blob);
                    } else {
                        reject(new Error("Canvas toBlob 失败"));
                    }
                }, "image/png");
            };
            img.onerror = () => reject(new Error("SVG 图片加载失败"));
            img.src = svgDataUrl;
        });
    }
}