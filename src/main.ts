import {
    App,
    Editor,
    MarkdownView,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    Menu,
    WorkspaceLeaf,
} from "obsidian";
import { NoteToPublicSettings, DEFAULT_SETTINGS } from "./settings";
import { ObsidianParser } from "./markdown/obsidian-parser";
import { MermaidRenderer } from "./markdown/mermaid-renderer";
import { WechatFormatter } from "./markdown/wechat-formatter";
import { WechatAuth } from "./platforms/wechat/auth";
import { WechatPublisher, ArticleData } from "./platforms/wechat/publisher";
import { PublishModal, ProgressModal } from "./ui/publish-modal";
import { PreviewView, VIEW_TYPE_PREVIEW } from "./ui/preview-view";

export default class NoteToPublicPlugin extends Plugin {
    settings: NoteToPublicSettings;
    private mermaidRenderer: MermaidRenderer;
    private previewView: PreviewView | null = null;

    async onload() {
        await this.loadSettings();

        this.mermaidRenderer = new MermaidRenderer();

        // 注册预览视图
        this.registerView(
            VIEW_TYPE_PREVIEW,
            (leaf) => {
                this.previewView = new PreviewView(leaf, this.settings);
                return this.previewView;
            }
        );

        // 注册打开预览命令
        this.addCommand({
            id: "open-preview",
            name: "打开发布预览",
            callback: () => {
                this.activateOrCreatePreviewView();
            },
        });

        // 注册发布命令
        this.addCommand({
            id: "publish-to-wechat",
            name: "发布到微信公众号",
            editorCallback: (editor: Editor, view: MarkdownView) => {
                this.publishToWechat(view.file);
            },
        });

        // 注册设置页面
        this.addSettingTab(new NoteToPublicSettingTab(this.app, this));

        // 注册文件右键菜单
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
                if (file.extension === "md") {
                    menu.addItem((item) => {
                        item
                            .setTitle("👁️ 打开发布预览")
                            .setIcon("eye")
                            .onClick(() => {
                                this.activateOrCreatePreviewView(file);
                            });
                    });

                    menu.addItem((item) => {
                        item
                            .setTitle("📤 发布到微信公众号")
                            .setIcon("upload")
                            .onClick(() => {
                                this.publishToWechat(file);
                            });
                    });
                }
            })
        );

        // 注册编辑器右键菜单
        this.registerEvent(
            this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
                menu.addItem((item) => {
                    item
                        .setTitle("👁️ 打开发布预览")
                        .setIcon("eye")
                        .onClick(() => {
                            this.activateOrCreatePreviewView(view.file);
                        });
                });

                menu.addItem((item) => {
                    item
                        .setTitle("📤 发布到微信公众号")
                        .setIcon("upload")
                        .onClick(() => {
                            this.publishToWechat(view.file);
                        });
                });
            })
        );

        // 监听文件切换，自动刷新预览
        this.registerEvent(
            this.app.workspace.on("file-open", (file: TFile | null) => {
                if (this.previewView && file && file.extension === "md") {
                    this.previewView.previewFile(file);
                }
            })
        );

        console.log("Note to Public 插件已加载");
    }

    onunload() {
        console.log("Note to Public 插件已卸载");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async publishToWechat(file: TFile | null) {
        if (!file) {
            new Notice("请先打开一个 Markdown 文件");
            return;
        }

        const wechatConfig = this.settings.wechat;
        if (!wechatConfig.appId || !wechatConfig.appSecret) {
            new Notice("请先配置微信公众号的 AppID 和 AppSecret");
            return;
        }

        try {
            // 读取文件内容
            const content = await this.app.vault.read(file);
            const filePath = file.path;

            // 解析 Obsidian 语法
            const parser = new ObsidianParser(content, filePath);
            const parsed = parser.parse();

            // 提取 Mermaid 图表
            const { content: contentWithoutMermaid, mermaidBlocks } = parser.extractMermaidBlocks(parsed.content);

            // 提取本地图片
            const { content: contentWithImagePlaceholders, images } = parser.extractLocalImages(contentWithoutMermaid);

            // 显示发布模态框
            new PublishModal(
                this.app,
                {
                    appId: wechatConfig.appId,
                    appSecret: wechatConfig.appSecret,
                },
                {
                    title: parsed.metadata.title,
                    author: parsed.metadata.author || wechatConfig.defaultAuthor,
                    digest: parsed.metadata.description || "",
                },
                wechatConfig.defaultAuthor,
                async (options) => {
                    await this.doPublish({
                        file,
                        title: options.title,
                        author: options.author,
                        digest: options.digest,
                        sourceUrl: options.sourceUrl,
                        coverPath: options.coverPath,
                        coverMediaId: options.coverMediaId,
                        content: contentWithImagePlaceholders,
                        mermaidBlocks,
                        images,
                        autoPublish: options.autoPublish,
                    });
                }
            ).open();
        } catch (error) {
            new Notice(`发布准备失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async doPublish(params: {
        file: TFile;
        title: string;
        author: string;
        digest: string;
        sourceUrl: string;
        coverPath?: string;
        coverMediaId?: string;
        content: string;
        mermaidBlocks: Map<string, string>;
        images: Map<string, { alt: string; path: string }>;
        autoPublish: boolean;
    }) {
        const progressModal = new ProgressModal(this.app);
        progressModal.open();

        const updateProgress = (text: string) => {
            progressModal.updateProgress(text);
        };

        try {
            updateProgress("正在初始化...");

            const auth = new WechatAuth(
                this.settings.wechat.appId,
                this.settings.wechat.appSecret
            );
            const publisher = new WechatPublisher(auth);

            // 1. 渲染并上传 Mermaid 图表
            updateProgress("正在处理 Mermaid 图表...");
            const mermaidImageMap = new Map<string, string>();

            for (const [blockId, code] of params.mermaidBlocks) {
                try {
                    // 用 MermaidRenderer 渲染为 SVG
                    const svg = await this.mermaidRenderer.renderToSVG(code);
                    const svgEl = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("svg");

                    if (!svgEl) {
                        throw new Error("SVG not found");
                    }

                    // 从 viewBox 或宽高属性获取尺寸（保持原始比例）
                    let w = 800, h = 600;
                    const viewBox = svgEl.getAttribute("viewBox");
                    if (viewBox) {
                        const parts = viewBox.split(/[\s,]+/).map(Number);
                        if (parts.length >= 4) { w = parts[2]; h = parts[3]; }
                    }
                    // 百分比宽高的 SVG 用 viewBox 尺寸，确保比例正确
                    const attrW = svgEl.getAttribute("width") || "";
                    const attrH = svgEl.getAttribute("height") || "";
                    const parsedW = parseFloat(attrW);
                    const parsedH = parseFloat(attrH);
                    if (!isNaN(parsedW) && !attrW.includes("%") && parsedW > 0) w = parsedW;
                    if (!isNaN(parsedH) && !attrH.includes("%") && parsedH > 0) h = parsedH;

                    // 固定宽度 800px，按比例缩放（避免拉伸）
                    const targetW = 800;
                    const targetH = Math.round((h / w) * targetW);
                    w = targetW;
                    h = targetH;

                    // 2x 缩放 Canvas 转 PNG
                    const scale = 2;
                    const canvas = document.createElement("canvas");
                    canvas.width = w * scale;
                    canvas.height = h * scale;
                    const ctx = canvas.getContext("2d")!;
                    ctx.fillStyle = "white";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.scale(scale, scale);

                    // 给 SVG 加固定宽高属性（否则浏览器渲染时可能按百分比）
                    svgEl.setAttribute("width", `${w}`);
                    svgEl.setAttribute("height", `${h}`);
                    const svgText = new XMLSerializer().serializeToString(svgEl);

                    const pngDataUrl: string = await new Promise((resolve, reject) => {
                        const img = new Image();
                        const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
                        const blobUrl = URL.createObjectURL(blob);
                        img.onload = () => {
                            ctx.drawImage(img, 0, 0, w, h);
                            URL.revokeObjectURL(blobUrl);
                            resolve(canvas.toDataURL("image/png"));
                        };
                        img.onerror = () => {
                            URL.revokeObjectURL(blobUrl);
                            reject(new Error("SVG image load failed"));
                        };
                        img.src = blobUrl;
                    });

                    const pngBuffer = Uint8Array.from(
                        atob(pngDataUrl.split(",")[1]), (c) => c.charCodeAt(0)
                    ).buffer;
                    const wechatUrl = await publisher.uploadSingleImage(pngBuffer, `${blockId}.png`);
                    mermaidImageMap.set(blockId, wechatUrl);

                    updateProgress(`已处理 Mermaid 图表 ${mermaidImageMap.size}/${params.mermaidBlocks.size}`);
                } catch (error) {
                    console.error(`Mermaid 渲染失败: ${blockId}`, error);
                    new Notice(`Mermaid 图表渲染失败: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            // 2. 上传本地图片
            updateProgress("正在上传本地图片...");
            const localImageMap = new Map<string, string>();

            for (const [imageId, { path }] of params.images) {
                try {
                    const fullPath = this.getFullImagePath(path, params.file);
                    const imageFile = this.app.vault.getAbstractFileByPath(fullPath);

                    if (imageFile && imageFile instanceof TFile) {
                        const binary = await this.app.vault.readBinary(imageFile);
                        const url = await publisher.uploadSingleImage(binary, imageFile.name);
                        localImageMap.set(imageId, url);
                        updateProgress(`已上传图片 ${localImageMap.size}/${params.images.size}`);
                    }
                } catch (error) {
                    console.error(`图片上传失败: ${path}`, error);
                }
            }

            // 3. 格式化内容为微信 HTML
            updateProgress("正在格式化内容...");

            // 合并图片映射
            const imageMap = new Map([...mermaidImageMap, ...localImageMap]);

            const formatter = new WechatFormatter();
            const htmlContent = formatter.format(params.content, imageMap);

            // 生成摘要（如果未提供）
            const digest = params.digest || formatter.generateDigest(htmlContent);

            // 4. 发布
            // 4. 处理封面图
            updateProgress("正在处理封面图...");
            let coverMediaId: string | undefined = params.coverMediaId;

            // 从素材库选的 coverMediaId 直接用，否则上传
            if (!coverMediaId && params.coverPath) {
                try {
                    if (params.coverPath.startsWith("data:")) {
                        const binary = this.dataUrlToArrayBuffer(params.coverPath);
                        coverMediaId = await publisher.uploadCover(binary);
                    } else if (params.coverPath.startsWith("http://") || params.coverPath.startsWith("https://")) {
                        const res = await fetch(params.coverPath);
                        const buffer = await res.arrayBuffer();
                        coverMediaId = await publisher.uploadCover(buffer);
                    } else {
                        const coverFile = this.app.vault.getAbstractFileByPath(params.coverPath);
                        if (coverFile && coverFile instanceof TFile) {
                            const binary = await this.app.vault.readBinary(coverFile);
                            coverMediaId = await publisher.uploadCover(binary);
                        } else {
                            new Notice("封面图文件不存在");
                        }
                    }
                } catch (e) {
                    console.error("封面图上传失败:", e);
                    new Notice("封面图上传失败");
                }
            }

            // 5. 发布
            updateProgress("正在发布到微信公众号...");

            const article: ArticleData = {
                title: params.title,
                author: params.author,
                digest: digest,
                content: htmlContent,
                coverMediaId: coverMediaId,
                sourceUrl: params.sourceUrl,
            };

            const result = await publisher.publish(article, {
                autoPublish: params.autoPublish,
            });

            progressModal.closeModal();

            if (result.success) {
                if (params.autoPublish) {
                    new Notice(`发布成功！media_id: ${result.mediaId}`);
                } else {
                    new Notice("草稿已保存，请前往微信公众号后台发布");
                }
            } else {
                new Notice(`发布失败: ${result.message}`);
            }
        } catch (error) {
            progressModal.closeModal();
            new Notice(`发布失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private getFullImagePath(imagePath: string, currentFile: TFile): string {
        // 处理相对路径
        if (imagePath.startsWith("./") || imagePath.startsWith("../")) {
            const currentDir = currentFile.parent?.path || "";
            const parts = currentDir.split("/");
            const imageParts = imagePath.split("/");

            for (const part of imageParts) {
                if (part === "..") {
                    parts.pop();
                } else if (part !== "." && part !== "") {
                    parts.push(part);
                }
            }

            return parts.join("/");
        }

        // 绝对路径或 Obsidian 链接格式
        if (imagePath.startsWith("/")) {
            return imagePath.slice(1);
        }

        return imagePath;
    }

    private dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
        const base64 = dataUrl.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    async activateOrCreatePreviewView(file?: TFile | null) {
        const { workspace } = this.app;

        // 尝试找到已有的预览视图
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_PREVIEW)[0];

        // 如果没有找到，创建一个新的
        if (!leaf) {
            // 在右侧边栏创建新标签页
            leaf = workspace.getRightLeaf(false);
            await leaf?.setViewState({ type: VIEW_TYPE_PREVIEW, active: true });
        }

        // 激活视图
        if (leaf) {
            workspace.revealLeaf(leaf);

            // 如果指定了文件，立即预览
            if (file) {
                (leaf.view as PreviewView).previewFile(file);
            } else {
                // 否则预览当前活动文件
                const activeFile = workspace.getActiveFile();
                if (activeFile) {
                    (leaf.view as PreviewView).previewFile(activeFile);
                }
            }
        }
    }
}

class NoteToPublicSettingTab extends PluginSettingTab {
    plugin: NoteToPublicPlugin;

    constructor(app: App, plugin: NoteToPublicPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Note to Public 设置" });

        // 微信公众号设置
        containerEl.createEl("h3", { text: "微信公众号" });

        new Setting(containerEl)
            .setName("AppID")
            .setDesc("微信公众号的 AppID")
            .addText((text) =>
                text
                    .setPlaceholder("wx...")
                    .setValue(this.plugin.settings.wechat.appId)
                    .onChange(async (value) => {
                        this.plugin.settings.wechat.appId = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("AppSecret")
            .setDesc("微信公众号的 AppSecret")
            .addText((text) => {
                text.inputEl.type = "password";
                text
                    .setPlaceholder("请输入 AppSecret")
                    .setValue(this.plugin.settings.wechat.appSecret)
                    .onChange(async (value) => {
                        this.plugin.settings.wechat.appSecret = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("默认作者")
            .setDesc("发布文章的默认作者名称")
            .addText((text) =>
                text
                    .setPlaceholder("作者名称")
                    .setValue(this.plugin.settings.wechat.defaultAuthor)
                    .onChange(async (value) => {
                        this.plugin.settings.wechat.defaultAuthor = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("默认自动发布")
            .setDesc("开启后默认直接发布文章，否则仅保存为草稿")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.wechat.autoPublish)
                    .onChange(async (value) => {
                        this.plugin.settings.wechat.autoPublish = value;
                        await this.plugin.saveSettings();
                    })
            );

        // 说明信息
        containerEl.createEl("p", {
            text: "提示：获取 AppID 和 AppSecret 请到微信公众平台 -> 设置与开发 -> 基本配置",
            cls: "setting-item-description",
        });
    }
}
