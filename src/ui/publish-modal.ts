import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { WechatAuth } from "../platforms/wechat/auth";
import { WechatAPI, MaterialItem } from "../platforms/wechat/api";

export interface PublishOptions {
    title: string;
    author: string;
    digest: string;
    sourceUrl: string;
    autoPublish: boolean;
    coverPath?: string;     // 本地路径或 URL 或 base64
    coverMediaId?: string;  // 从素材库选择的 media_id
}

export class PublishModal extends Modal {
    private options: PublishOptions;
    private onSubmit: (options: PublishOptions) => void;
    private onCancel: () => void;
    private settings: { appId: string; appSecret: string };

    constructor(
        app: App,
        settings: { appId: string; appSecret: string },
        defaultOptions: Partial<PublishOptions>,
        defaultAuthor: string,
        onSubmit: (options: PublishOptions) => void,
        onCancel: () => void = () => {}
    ) {
        super(app);
        this.settings = settings;
        this.options = {
            title: defaultOptions.title || "",
            author: defaultOptions.author || defaultAuthor || "",
            digest: defaultOptions.digest || "",
            sourceUrl: defaultOptions.sourceUrl || "",
            autoPublish: false,
            coverPath: defaultOptions.coverPath,
            coverMediaId: defaultOptions.coverMediaId,
        };
        this.onSubmit = onSubmit;
        this.onCancel = onCancel;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText("发布到微信公众号");

        // 标题
        new Setting(contentEl)
            .setName("标题")
            .setDesc("文章标题（必填）")
            .addText((text) =>
                text.setPlaceholder("输入标题").setValue(this.options.title).onChange((v) => { this.options.title = v; })
            );

        // 作者
        new Setting(contentEl)
            .setName("作者")
            .setDesc("文章作者")
            .addText((text) =>
                text.setPlaceholder("输入作者").setValue(this.options.author).onChange((v) => { this.options.author = v; })
            );

        // 摘要
        new Setting(contentEl)
            .setName("摘要")
            .setDesc("最多120字符，留空自动生成")
            .addTextArea((ta) => {
                ta.setPlaceholder("输入摘要").setValue(this.options.digest).onChange((v) => { this.options.digest = v; });
                ta.inputEl.rows = 3;
            });

        // 原文链接
        new Setting(contentEl)
            .setName("原文链接")
            .setDesc("阅读原文链接（可选）")
            .addText((text) =>
                text.setPlaceholder("https://...").setValue(this.options.sourceUrl).onChange((v) => { this.options.sourceUrl = v; })
            );

        // 封面图
        const coverSetting = new Setting(contentEl)
            .setName("封面图")
            .setDesc("必选：选择本地图片或从素材库选择");

        coverSetting.addButton((btn) => {
            btn.setButtonText("选择本地图片").onClick(() => this.pickLocalFile());
        });

        coverSetting.addButton((btn) => {
            btn.setButtonText("素材库选择").setCta().onClick(() => this.openMaterialPicker());
        });

        // 预览区
        this.updateCoverPreview();

        // 立即发布
        new Setting(contentEl)
            .setName("立即发布")
            .setDesc("开启后直接发布，否则仅保存为草稿")
            .addToggle((toggle) =>
                toggle.setValue(this.options.autoPublish).onChange((v) => { this.options.autoPublish = v; })
            );

        // 按钮
        const buttonEl = contentEl.createDiv();
        buttonEl.style.cssText = "display:flex;justify-content:flex-end;gap:10px;margin-top:20px;";

        const cancelBtn = buttonEl.createEl("button", { text: "取消" });
        cancelBtn.style.cssText = "padding:8px 16px;cursor:pointer;";
        cancelBtn.addEventListener("click", () => { this.close(); this.onCancel(); });

        const submitBtn = buttonEl.createEl("button", { text: "发布", cls: "mod-cta" });
        submitBtn.style.cssText = "padding:8px 16px;cursor:pointer;";
        submitBtn.addEventListener("click", () => {
            if (!this.options.title.trim()) { new Notice("标题不能为空"); return; }
            if (!this.options.coverPath && !this.options.coverMediaId) { new Notice("请先选择封面图"); return; }
            this.close();
            this.onSubmit(this.options);
        });
    }

    private pickLocalFile() {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);

        fileInput.onchange = async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                this.options.coverPath = reader.result as string;
                this.options.coverMediaId = undefined;
                this.updateCoverPreview();
                new Notice(`已选择：${file.name}`);
            };
            reader.readAsDataURL(file);
            document.body.removeChild(fileInput);
        };

        fileInput.click();
    }

    private async openMaterialPicker() {
        if (!this.settings.appId || !this.settings.appSecret) {
            new Notice("请先配置 AppID 和 AppSecret");
            return;
        }

        const modal = new MaterialPickerModal(this.app, this.settings, (mediaId, url) => {
            this.options.coverMediaId = mediaId;
            this.options.coverPath = url;
            this.updateCoverPreview();
        });
        modal.open();
    }

    private updateCoverPreview() {
        // 移除旧预览
        const old = this.contentEl.querySelector(".cover-preview-container");
        if (old) old.remove();

        const container = this.contentEl.createDiv({ cls: "cover-preview-container" });
        container.style.cssText = "text-align:center;margin:10px 0;";

        if (this.options.coverPath) {
            const img = container.createEl("img");
            img.style.cssText = "max-width:200px;max-height:150px;border-radius:6px;border:1px solid var(--background-modifier-border);";
            img.src = this.options.coverPath;

            const label = container.createDiv();
            label.style.cssText = "font-size:12px;color:var(--text-muted);margin-top:4px;";
            label.textContent = this.options.coverMediaId ? "素材库图片" : "本地/URL图片";
        } else {
            const hint = container.createDiv();
            hint.style.cssText = "color:var(--text-muted);font-size:13px;padding:20px;border:1px dashed var(--background-modifier-border);border-radius:6px;";
            hint.textContent = "请选择封面图（必选）";
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

// 素材库选择弹窗
class MaterialPickerModal extends Modal {
    private settings: { appId: string; appSecret: string };
    private onSelect: (mediaId: string, url: string) => void;
    private items: MaterialItem[] = [];
    private currentPage = 0;
    private totalCount = 0;
    private pageSize = 20;
    private selectedMediaId: string | null = null;
    private selectedUrl: string | null = null;
    private gridEl: HTMLElement | null = null;
    private pageInfoEl: HTMLElement | null = null;

    constructor(
        app: App,
        settings: { appId: string; appSecret: string },
        onSelect: (mediaId: string, url: string) => void
    ) {
        super(app);
        this.settings = settings;
        this.onSelect = onSelect;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText("选择素材库图片");

        // 标签页提示
        const tip = contentEl.createDiv();
        tip.style.cssText = "font-size:13px;color:var(--text-muted);margin-bottom:12px;";
        tip.textContent = "点击图片选中，然后点击「确认」按钮";

        // 图片网格
        this.gridEl = contentEl.createDiv();
        this.gridEl.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-height:400px;overflow-y:auto;";

        // 分页
        const pagination = contentEl.createDiv();
        pagination.style.cssText = "display:flex;justify-content:center;align-items:center;gap:16px;margin-top:12px;";

        const prevBtn = pagination.createEl("button", { text: "上一页" });
        prevBtn.style.cssText = "padding:4px 12px;";
        prevBtn.disabled = true;
        prevBtn.addEventListener("click", () => this.loadPage(this.currentPage - 1));

        this.pageInfoEl = pagination.createSpan({ text: "加载中..." });

        const nextBtn = pagination.createEl("button", { text: "下一页" });
        nextBtn.style.cssText = "padding:4px 12px;";
        nextBtn.disabled = true;
        nextBtn.addEventListener("click", () => this.loadPage(this.currentPage + 1));

        // 按钮
        const buttons = contentEl.createDiv();
        buttons.style.cssText = "display:flex;justify-content:flex-end;gap:10px;margin-top:16px;";

        const cancelBtn = buttons.createEl("button", { text: "取消" });
        cancelBtn.style.cssText = "padding:8px 16px;cursor:pointer;";
        cancelBtn.addEventListener("click", () => this.close());

        const confirmBtn = buttons.createEl("button", { text: "确认", cls: "mod-cta" });
        confirmBtn.style.cssText = "padding:8px 16px;cursor:pointer;";
        confirmBtn.addEventListener("click", () => {
            if (this.selectedMediaId && this.selectedUrl) {
                this.onSelect(this.selectedMediaId, this.selectedUrl);
                this.close();
            } else {
                new Notice("请选择一张图片");
            }
        });

        // 存储分页按钮引用用于更新状态
        this._prevBtn = prevBtn;
        this._nextBtn = nextBtn;

        await this.loadPage(0);
    }

    private _prevBtn: HTMLButtonElement | null = null;
    private _nextBtn: HTMLButtonElement | null = null;

    async loadPage(page: number) {
        if (!this.gridEl) return;

        this.gridEl.empty();
        this.gridEl.createDiv({ text: "加载中..." });

        try {
            const auth = new WechatAuth(this.settings.appId, this.settings.appSecret);
            const api = new WechatAPI(auth);
            const result = await api.getMaterials(page, this.pageSize);

            this.items = result.items;
            this.totalCount = result.totalCount;
            this.currentPage = page;

            this.gridEl.empty();

            if (this.items.length === 0) {
                this.gridEl.createDiv({ text: "素材库为空，请先上传图片" });
                return;
            }

            // 更新分页
            if (this.pageInfoEl) {
                this.pageInfoEl.textContent = `第${page + 1}页 / 共${Math.ceil(this.totalCount / this.pageSize)}页`;
            }
            if (this._prevBtn) this._prevBtn.disabled = page === 0;
            if (this._nextBtn) this._nextBtn.disabled = (page + 1) * this.pageSize >= this.totalCount;

            // 渲染图片
            for (const material of this.items) {
                const item = this.gridEl.createDiv();
                item.style.cssText = "position:relative;cursor:pointer;border-radius:6px;overflow:hidden;border:2px solid transparent;transition:border-color 0.2s;";

                const img = item.createEl("img");
                img.src = material.url;
                img.style.cssText = "width:100%;height:120px;object-fit:cover;display:block;";
                img.loading = "lazy";

                const name = item.createDiv();
                name.style.cssText = "font-size:11px;padding:4px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
                name.textContent = material.name || "未命名";

                item.addEventListener("click", () => {
                    // 取消其他选中
                    this.gridEl?.querySelectorAll("div[style]").forEach((el) => {
                        (el as HTMLElement).style.borderColor = "transparent";
                    });
                    // 选中当前
                    item.style.borderColor = "var(--interactive-accent)";
                    this.selectedMediaId = material.media_id;
                    this.selectedUrl = material.url;
                });
            }
        } catch (error) {
            this.gridEl.empty();
            this.gridEl.createDiv({ text: "加载失败：" + (error instanceof Error ? error.message : String(error)) });
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

// 进度弹窗
export class ProgressModal extends Modal {
    private progressText: string = "";
    private progressEl: HTMLElement;

    constructor(app: App) {
        super(app);
    }

    onOpen() {
        this.titleEl.setText("发布中...");
        this.progressEl = this.contentEl.createDiv();
        this.progressEl.style.cssText = "padding:20px;text-align:center;";
        this.progressEl.setText(this.progressText);
    }

    updateProgress(text: string) {
        this.progressText = text;
        if (this.progressEl) this.progressEl.setText(text);
    }

    closeModal() {
        this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
