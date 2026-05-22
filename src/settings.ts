export interface WechatSettings {
    appId: string;
    appSecret: string;
    defaultAuthor: string;
    defaultCoverUrl: string;
    autoPublish: boolean;
}

export interface NoteToPublicSettings {
    wechat: WechatSettings;
}

export const DEFAULT_SETTINGS: NoteToPublicSettings = {
    wechat: {
        appId: "",
        appSecret: "",
        defaultAuthor: "",
        defaultCoverUrl: "",
        autoPublish: false,
    }
};
