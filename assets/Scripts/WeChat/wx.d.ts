/**
 * Type declarations for WeChat Mini Game (微信小游戏) wx API.
 * Reference: https://developers.weixin.qq.com/minigame/dev/api/
 */

interface WxUserInfo {
    openId: string;
    nickName: string;
    avatarUrl: string;
}

interface WxShareAppMessageOptions {
    title?: string;
    imageUrl?: string;
    query?: string;
    success?: () => void;
    fail?: (err: any) => void;
}

interface WxShowShareMenuOptions {
    withShareTicket?: boolean;
    menus?: string[];
}

interface WxGetUserInfoOptions {
    success?: (res: { userInfo: WxUserInfo }) => void;
    fail?: (err: any) => void;
}

interface WxOpenDataContext {
    postMessage(message: any): void;
}

interface WxMessage {
    type: string;
    friends?: Array<{
        openId: string;
        nickname: string;
        avatarUrl: string;
        isOnline: boolean;
    }>;
    [key: string]: any;
}

interface WxOnShowCallbackResult {
    scene: number;
    query: { [key: string]: string };
    shareTicket?: string;
}

interface Wx {
    showShareMenu(options: WxShowShareMenuOptions): void;
    onShareAppMessage(callback: () => { title: string; imageUrl: string }): void;
    getOpenDataContext(): WxOpenDataContext;
    onMessage(callback: (data: WxMessage) => void): void;
    getUserInfo(options: WxGetUserInfoOptions): void;
    shareAppMessage(options: WxShareAppMessageOptions): void;
    onShow(callback: (res: WxOnShowCallbackResult) => void): void;
    offShow(callback: (res: WxOnShowCallbackResult) => void): void;
}

declare const wx: Wx | undefined;
