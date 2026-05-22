import { WechatAPI, WechatArticle } from "./api";
import { WechatAuth } from "./auth";

export interface PublishResult {
    success: boolean;
    mediaId?: string;
    publishId?: string;
    message: string;
}

export interface ArticleData {
    title: string;
    author: string;
    digest: string;
    content: string;
    coverMediaId?: string; // 已上传的永久 media_id
    sourceUrl?: string;
}

export class WechatPublisher {
    private api: WechatAPI;

    constructor(auth: WechatAuth) {
        this.api = new WechatAPI(auth);
    }

    // 上传封面图为永久素材，返回 media_id
    async uploadCover(imageData: ArrayBuffer): Promise<string> {
        return await this.api.uploadThumbMedia(imageData);
    }

    async publish(
        article: ArticleData,
        options: { autoPublish: boolean }
    ): Promise<PublishResult> {
        try {
            if (!article.coverMediaId) {
                return {
                    success: false,
                    message: "请先上传封面图",
                };
            }

            const wechatArticle: WechatArticle = {
                article_type: "news",
                title: article.title,
                author: article.author,
                digest: article.digest,
                content: article.content,
                content_source_url: article.sourceUrl || "",
                thumb_media_id: article.coverMediaId,
                need_open_comment: 1,
                only_fans_can_comment: 0,
            };

            const mediaId = await this.api.addDraft([wechatArticle]);

            if (options.autoPublish) {
                await this.api.publishDraft(mediaId);
                return {
                    success: true,
                    mediaId,
                    message: "文章已成功发布到微信公众号",
                };
            } else {
                return {
                    success: true,
                    mediaId,
                    message: "草稿已保存到微信公众号，请前往后台发布",
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : "发布失败",
            };
        }
    }

    async uploadSingleImage(imageData: ArrayBuffer, filename?: string): Promise<string> {
        return await this.api.uploadImage(imageData, filename);
    }

    // 未提供封面时，生成默认灰色封面并上传为永久素材
    private async createAndUploadDefaultCover(): Promise<string> {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("无法创建 canvas");
        }
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, 300, 300);

        return new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    reject(new Error("生成默认封面失败"));
                    return;
                }
                try {
                    const buffer = await blob.arrayBuffer();
                    const mediaId = await this.api.uploadThumbMedia(buffer, "default_cover.png");
                    resolve(mediaId);
                } catch (error) {
                    reject(error);
                }
            }, "image/png");
        });
    }
}
