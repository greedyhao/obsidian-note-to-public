export interface WechatSettings {
    appId: string;             // 明文，存 data.json
    appSecretName: string;     // SecretStorage 中的 key 名称
    defaultAuthor: string;
    autoPublish: boolean;
}

export interface NoteToPublicSettings {
    wechat: WechatSettings;
}

export const DEFAULT_SETTINGS: NoteToPublicSettings = {
    wechat: {
        appId: "",
        appSecretName: "note-to-public-appsecret",
        defaultAuthor: "",
        autoPublish: false,
    }
};
