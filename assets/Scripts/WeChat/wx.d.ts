/**
 * Type declarations for WeChat Mini Game (微信小游戏) wx API.
 * Reference: https://developers.weixin.qq.com/minigame/dev/api/
 */

interface WxUserInfo {
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

interface WxGetSettingCallbackResult {
    authSetting: {
        'scope.userInfo'?: boolean;
        [key: string]: boolean | undefined;
    };
}

interface WxGetSettingOptions {
    success?: (res: WxGetSettingCallbackResult) => void;
    fail?: (err: any) => void;
}

interface WxLoginResult {
    code: string;
    errMsg: string;
}

interface WxLoginOptions {
    success?: (res: WxLoginResult) => void;
    fail?: (err: any) => void;
}

interface WxRequestOptions {
    url: string;
    method?: string;
    data?: any;
    header?: { [key: string]: string };
    success?: (res: { data: any; statusCode: number }) => void;
    fail?: (err: any) => void;
}

interface WxShowShareImageMenuOptions {
    path: string;
    needShowEntrance?: boolean;
    entrancePath?: string;
    success?: () => void;
    fail?: (err: any) => void;
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
    getSetting(options: WxGetSettingOptions): void;
    login(options: WxLoginOptions): void;
    request(options: WxRequestOptions): void;
    showShareImageMenu(options: WxShowShareImageMenuOptions): void;
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
