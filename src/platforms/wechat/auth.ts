import { requestUrl } from "obsidian";

export class WechatAuth {
    private appId: string;
    private appSecret: string;
    private accessToken: string | null = null;
    private tokenExpireTime: number = 0;

    constructor(appId: string, appSecret: string) {
        this.appId = appId;
        this.appSecret = appSecret;
    }

    async getAccessToken(forceRefresh: boolean = false): Promise<string> {
        if (!forceRefresh && this.accessToken && Date.now() < this.tokenExpireTime) {
            return this.accessToken;
        }

        const response = await requestUrl({
            url: "https://api.weixin.qq.com/cgi-bin/stable_token",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                grant_type: "client_credential",
                appid: this.appId,
                secret: this.appSecret,
                force_refresh: forceRefresh,
            }),
        });

        const data = response.json as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };

        if (data.errcode) {
            throw new Error(`微信认证失败: ${data.errcode} - ${data.errmsg}`);
        }

        if (!data.access_token) {
            throw new Error("获取 access_token 失败，请检查 AppID 和 AppSecret");
        }

        this.accessToken = data.access_token;
        this.tokenExpireTime = Date.now() + (data.expires_in || 7200) * 1000 - 60000;
        return this.accessToken;
    }
}
