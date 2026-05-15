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

interface WxSystemInfo {
    screenWidth: number;
    screenHeight: number;
    pixelRatio: number;
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
    createUserInfoButton(options: WxCreateUserInfoButtonOptions): WxUserInfoButton;
    getSystemInfoSync(): WxSystemInfo;
}

interface WxUserInfoButton {
    destroy(): void;
    onTap(callback: (res: { userInfo?: WxUserInfo; errMsg?: string; err_code?: string }) => void): void;
}

interface WxCreateUserInfoButtonOptions {
    type: 'text' | 'image';
    text?: string;
    image?: string;
    style: {
        left: number;
        top: number;
        width: number;
        height: number;
        backgroundColor?: string;
        borderColor?: string;
        borderWidth?: number;
        borderRadius?: number;
        color?: string;
        textAlign?: 'left' | 'center' | 'right';
        fontSize?: number;
        lineHeight?: number;
    };
}

declare const wx: Wx | undefined;
