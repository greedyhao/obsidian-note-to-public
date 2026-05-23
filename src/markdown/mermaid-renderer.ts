import mermaid from "mermaid";

export class MermaidRenderer {
    private initialized = false;

    constructor() {
        this.init();
    }

    private async init() {
        if (this.initialized) return;

        mermaid.initialize({
            startOnLoad: false,
            theme: "default",
            securityLevel: "strict",
            fontFamily: "sans-serif",
            // 禁用 HTML 标签，强制使用纯 SVG 渲染文本，确保 100% 兼容 XML 规范
            htmlLabels: false,
            flowchart: {
                curve: "basis",
                padding: 15,
                // 针对 flowchart 明确禁用 HTML 标签
                htmlLabels: false,
            },
        });

        this.initialized = true;
    }

    async renderToSVG(code: string): Promise<string> {
        await this.init();

        try {
            const { svg } = await mermaid.render("mermaid-" + Date.now(), code);
            return svg;
        } catch (error) {
            console.error("Mermaid 渲染失败:", error);
            throw new Error(`Mermaid 渲染失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async renderToArrayBuffer(code: string): Promise<ArrayBuffer> {
        const svg = await this.renderToSVG(code);
        return await this.svgToPngArrayBuffer(svg);
    }

    private ensureSvgSize(svg: string): string {
        const viewBoxMatch = svg.match(/viewBox="([\d\s.]+)"/);
        const widthMatch = svg.match(/width="([^"]+)"/);
        const heightMatch = svg.match(/height="([^"]+)"/);

        let width = 800;
        let height = 600;

        if (viewBoxMatch) {
            const parts = viewBoxMatch[1].split(/\s+/).map(Number);
            if (parts.length >= 4) {
                width = parts[2];
                height = parts[3];
            }
        }

        if (widthMatch && heightMatch) {
            const w = parseInt(widthMatch[1]);
            const h = parseInt(heightMatch[1]);
            if (!isNaN(w)) width = w;
            if (!isNaN(h)) height = h;
        }

        if (!widthMatch) {
            svg = svg.replace(/<svg/, `<svg width="${width}"`);
        }
        if (!heightMatch) {
            svg = svg.replace(/<svg/, `<svg height="${height}"`);
        }

        return svg;
    }

    private async svgToPngArrayBuffer(svg: string): Promise<ArrayBuffer> {
        if (!svg.includes('xmlns=')) {
            svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        const svgWithSize = this.ensureSvgSize(svg);

        const blob = new Blob([svgWithSize], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("无法创建 canvas context");
        }

        const widthMatch = svgWithSize.match(/width="(\d+)"/);
        const heightMatch = svgWithSize.match(/height="(\d+)"/);
        const width = widthMatch ? parseInt(widthMatch[1]) : 800;
        const height = heightMatch ? parseInt(heightMatch[1]) : 600;

        // 2x 缩放提高清晰度
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    ctx.drawImage(img, 0, 0, width, height);
                    URL.revokeObjectURL(url);
                    canvas.toBlob((pngBlob) => {
                        if (pngBlob) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                resolve(reader.result as ArrayBuffer);
                            };
                            reader.readAsArrayBuffer(pngBlob);
                        } else {
                            reject(new Error("Canvas toBlob 失败"));
                        }
                    }, "image/png");
                } catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("图片加载失败"));
            };
            img.src = url;
        });
    }
}
