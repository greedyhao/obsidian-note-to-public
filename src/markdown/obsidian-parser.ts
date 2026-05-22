import * as yaml from "js-yaml";

export interface ArticleMetadata {
    title: string;
    author?: string;
    description?: string;
    cover?: string;
    tags?: string[];
    category?: string;
    date?: string;
}

export interface ParsedArticle {
    metadata: ArticleMetadata;
    content: string;
}

export class ObsidianParser {
    private fileContent: string;
    private filePath: string;

    constructor(fileContent: string, filePath: string) {
        this.fileContent = fileContent;
        this.filePath = filePath;
    }

    parse(): ParsedArticle {
        const { metadata, content } = this.extractFrontmatter(this.fileContent);
        const processedContent = this.processObsidianSyntax(content);

        return {
            metadata: {
                title: metadata.title || this.extractTitleFromPath(this.filePath),
                author: metadata.author,
                description: metadata.description,
                cover: metadata.cover,
                tags: metadata.tags,
                category: metadata.category,
                date: metadata.date,
            },
            content: processedContent,
        };
    }

    private extractFrontmatter(content: string): { metadata: any; content: string } {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
        const match = content.match(frontmatterRegex);

        if (match) {
            try {
                const metadata = yaml.load(match[1]) as any || {};
                const remainingContent = content.slice(match[0].length);
                return { metadata, content: remainingContent };
            } catch (e) {
                console.error("解析 Frontmatter 失败:", e);
            }
        }

        return { metadata: {}, content };
    }

    private extractTitleFromPath(filePath: string): string {
        const parts = filePath.split("/");
        const fileName = parts[parts.length - 1];
        return fileName.replace(/\.md$/, "");
    }

    private processObsidianSyntax(content: string): string {
        let processed = content;

        // 处理 ==高亮== -> <mark>高亮</mark>
        processed = processed.replace(/==(.*?)==/g, '<mark>$1</mark>');

        // 处理 ~~删除线~~ -> <s>删除线</s>
        processed = processed.replace(/~~(.*?)~~/g, '<s>$1</s>');

        // 先处理 ![[Embed]] -> 标记为嵌入图片
        processed = processed.replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
            return `<!-- EMBED:${p1} -->`;
        });

        // 再处理 [[WikiLink]] -> 纯文本
        processed = processed.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
            const parts = p1.split("|");
            return parts.length > 1 ? parts[1] : parts[0];
        });

        // 处理 Callout: > [!note] -> 转换为引用块
        processed = this.processCallouts(processed);

        // 处理注释 %%comment%%
        processed = processed.replace(/%%.*?%%/gs, '');

        return processed;
    }

    private processCallouts(content: string): string {
        const calloutRegex = /^>(\s*)\[!([\w-]+)\](.*)$/gm;

        return content.replace(calloutRegex, (match, spaces, type, title) => {
            const calloutTypes: Record<string, string> = {
                'note': '💡 注意',
                'tip': '💡 提示',
                'warning': '⚠️ 警告',
                'danger': '⛔ 危险',
                'info': 'ℹ️ 信息',
                'success': '✅ 成功',
                'question': '❓ 问题',
                'bug': '🐛 Bug',
                'example': '📝 示例',
                'quote': '💬 引用',
            };

            const label = calloutTypes[type.toLowerCase()] || type;
            const cleanTitle = title.trim() ? title.trim() : label;
            return `> **${cleanTitle}**`;
        });
    }

    extractMermaidBlocks(content: string): { content: string; mermaidBlocks: Map<string, string> } {
        const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g;
        const mermaidBlocks = new Map<string, string>();
        let match;
        let blockIndex = 0;

        let processedContent = content;
        while ((match = mermaidRegex.exec(content)) !== null) {
            const blockId = `MERMAID_${blockIndex++}`;
            mermaidBlocks.set(blockId, match[1].trim());
            processedContent = processedContent.replace(match[0], `<!-- ${blockId} -->`);
        }

        return { content: processedContent, mermaidBlocks };
    }

    extractLocalImages(content: string): { content: string; images: Map<string, { alt: string; path: string }> } {
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const images = new Map<string, { alt: string; path: string }>();
        let match;
        let imageIndex = 0;

        let processedContent = content;
        while ((match = imageRegex.exec(content)) !== null) {
            const imageId = `IMAGE_${imageIndex++}`;
            const alt = match[1];
            const path = match[2];

            // 只处理本地图片路径
            if (!path.startsWith("http://") && !path.startsWith("https://") && !path.startsWith("data:")) {
                images.set(imageId, { alt, path });
                processedContent = processedContent.replace(match[0], `<!-- ${imageId} -->`);
            }
        }

        return { content: processedContent, images };
    }
}
