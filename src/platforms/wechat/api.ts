import { requestUrl } from "obsidian";
import { WechatAuth } from "./auth";

export interface WechatArticle {
    title: string;
    author: string;
    digest: string;
    content: string;
    content_source_url: string;
    article_type?: string;
    thumb_media_id?: string;
    need_open_comment: number;
    only_fans_can_comment: number;
}

// Token 过期错误码
const TOKEN_EXPIRED_CODES = [40001, 40014, 42001];

export class WechatAPI {
    private auth: WechatAuth;

    constructor(auth: WechatAuth) {
        this.auth = auth;
    }

    // 带 token 重试的请求
    private async requestWithTokenRetry<T>(requestFn: (token: string) => Promise<T>): Promise<T> {
        for (let attempt = 0; attempt < 2; attempt++) {
            const token = await this.auth.getAccessToken(attempt > 0);
            try {
                return await requestFn(token);
            } catch (error: any) {
                const errcode = error.message?.match(/(\d{5})/)?.[1];
                if (TOKEN_EXPIRED_CODES.includes(Number(errcode)) && attempt === 0) {
                    continue;
                }
                throw error;
            }
        }
        throw new Error("请求失败");
    }

    async uploadImage(imageData: ArrayBuffer, filename: string = "image.png"): Promise<string> {
        return this.requestWithTokenRetry(async (token) => {
            const url = `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${token}`;

            const boundary = "----WebKitFormBoundary" + Math.random().toString(16).substring(2);
            const headerStr = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`;
            const footerStr = `\r\n--${boundary}--\r\n`;

            const encoder = new TextEncoder();
            const headerBytes = encoder.encode(headerStr);
            const footerBytes = encoder.encode(footerStr);

            const body = new Uint8Array(headerBytes.length + imageData.byteLength + footerBytes.length);
            body.set(headerBytes, 0);
            body.set(new Uint8Array(imageData), headerBytes.length);
            body.set(footerBytes, headerBytes.length + imageData.byteLength);

            const response = await requestUrl({
                url,
                method: "POST",
                headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
                body: body.buffer,
            });

            const data = response.json as { url?: string; errcode?: number; errmsg?: string };

            if (data.errcode) {
                throw new Error(`上传图片失败 [${data.errcode}]: ${data.errmsg}`);
            }

            if (!data.url) {
                throw new Error("上传图片失败，未返回图片 URL");
            }

            return data.url;
        });
    }

    async uploadThumbMedia(imageData: ArrayBuffer, filename: string = "thumb.jpg"): Promise<string> {
        return this.requestWithTokenRetry(async (token) => {
            const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=image`;

            const boundary = "----WebKitFormBoundary" + Math.random().toString(16).substring(2);
            const headerStr = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`;
            const footerStr = `\r\n--${boundary}--\r\n`;

            const encoder = new TextEncoder();
            const headerBytes = encoder.encode(headerStr);
            const footerBytes = encoder.encode(footerStr);

            const body = new Uint8Array(headerBytes.length + imageData.byteLength + footerBytes.length);
            body.set(headerBytes, 0);
            body.set(new Uint8Array(imageData), headerBytes.length);
            body.set(footerBytes, headerBytes.length + imageData.byteLength);

            const response = await requestUrl({
                url,
                method: "POST",
                headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
                body: body.buffer,
            });

            const data = response.json as { media_id?: string; url?: string; errcode?: number; errmsg?: string };

            if (data.errcode) {
                throw new Error(`上传封面图失败 [${data.errcode}]: ${data.errmsg}`);
            }

            if (!data.media_id) {
                throw new Error("上传封面图失败，未返回 media_id");
            }

            return data.media_id;
        });
    }

    async addDraft(articles: WechatArticle[]): Promise<string> {
        return this.requestWithTokenRetry(async (token) => {
            const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;

            const response = await requestUrl({
                url,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ articles }),
            });

            const data = response.json as { media_id?: string; errcode?: number; errmsg?: string };

            if (data.errcode) {
                throw new Error(`创建草稿失败 [${data.errcode}]: ${data.errmsg}`);
            }

            if (!data.media_id) {
                throw new Error("创建草稿失败，未返回 media_id");
            }

            return data.media_id;
        });
    }

    async publishDraft(mediaId: string): Promise<void> {
        return this.requestWithTokenRetry(async (token) => {
            const url = `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${token}`;

            const response = await requestUrl({
                url,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ media_id: mediaId }),
            });

            const data = response.json as { publish_id?: string; errcode?: number; errmsg?: string };

            if (data.errcode) {
                throw new Error(`发布草稿失败 [${data.errcode}]: ${data.errmsg}`);
            }
        });
    }

    async getPublishStatus(publishId: string): Promise<string> {
        return this.requestWithTokenRetry(async (token) => {
            const url = `https://api.weixin.qq.com/cgi-bin/freepublish/get?access_token=${token}`;

            const response = await requestUrl({
                url,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publish_id: publishId }),
            });

            const data = response.json as { publish_status?: string; errcode?: number; errmsg?: string };

            if (data.errcode) {
                throw new Error(`查询发布状态失败 [${data.errcode}]: ${data.errmsg}`);
            }

            return data.publish_status || "UNKNOWN";
        });
    }

    // 获取素材库中的图片列表
    async getMaterials(page: number = 0, pageSize: number = 20): Promise<{ items: MaterialItem[]; totalCount: number }> {
        return this.requestWithTokenRetry(async (token) => {
            const url = `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${token}`;

            const response = await requestUrl({
                url,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "image",
                    offset: page * pageSize,
                    count: pageSize,
                }),
            });

            const data = response.json as { item?: MaterialItem[]; total_count?: number; errcode?: number; errmsg?: string };

            if (data.errcode) {
                throw new Error(`获取素材失败 [${data.errcode}]: ${data.errmsg}`);
            }

            return {
                items: data.item || [],
                totalCount: data.total_count || 0,
            };
        });
    }
}

export interface MaterialItem {
    media_id: string;
    name: string;
    url: string;
    update_time: string;
}
