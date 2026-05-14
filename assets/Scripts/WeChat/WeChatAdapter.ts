export interface Friend {
    openId: string;
    nickname: string;
    avatarUrl: string;
    isOnline: boolean;
}

export interface UserInfo {
    openId: string;
    nickname: string;
    avatarUrl: string;
}

export class WeChatAdapter {
    private static _instance: WeChatAdapter = null;

    public static get instance(): WeChatAdapter {
        if (!this._instance) {
            this._instance = new WeChatAdapter();
        }
        return this._instance;
    }

    private _friendListCallbacks: Array<{ callback: (friends: Friend[]) => void; timer: ReturnType<typeof setTimeout> }> = [];
    private _shareCallbackHandler: ((query: { roomId?: string; playerName?: string }) => void) | null = null;

    private static readonly CALLBACK_TIMEOUT_MS = 10000;

    public isWeChatEnvironment(): boolean {
        return typeof wx !== 'undefined';
    }

    public init(): void {
        if (!this.isWeChatEnvironment()) {
            console.warn('当前不在微信小游戏环境');
            return;
        }
        this.initShare();
        this.initMessageListener();
    }

    private initShare(): void {
        wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
        });

        wx.onShareAppMessage(() => {
            return {
                title: '龙争虾斗 - 邀请你加入游戏',
                imageUrl: 'share.png'
            };
        });
    }

    private initMessageListener(): void {
        wx.onMessage((data) => {
            if (data.type === 'friendList') {
                const friends: Friend[] = Array.isArray(data.friends) ? data.friends : [];
                this._fireFriendListCallbacks(friends);
            }
        });
    }

    private _fireFriendListCallbacks(friends: Friend[]): void {
        for (const entry of this._friendListCallbacks) {
            clearTimeout(entry.timer);
            entry.callback(friends);
        }
        this._friendListCallbacks = [];
    }

    public getFriendList(callback: (friends: Friend[]) => void): void {
        if (!this.isWeChatEnvironment()) {
            console.warn('当前不在微信小游戏环境');
            callback([]);
            return;
        }

        const timer = setTimeout(() => {
            console.warn('获取好友列表超时，回调已清理');
            this._friendListCallbacks = this._friendListCallbacks.filter((e) => e.timer !== timer);
            callback([]);
        }, WeChatAdapter.CALLBACK_TIMEOUT_MS);

        this._friendListCallbacks.push({ callback, timer });

        wx.getOpenDataContext().postMessage({
            type: 'getFriendList'
        });
    }

    public getUserInfo(callback: (userInfo: UserInfo | null) => void): void {
        if (!this.isWeChatEnvironment()) {
            console.warn('当前不在微信小游戏环境');
            callback(null);
            return;
        }

        wx.getUserInfo({
            success: (res) => {
                callback({
                    openId: res.userInfo.openId,
                    nickname: res.userInfo.nickName,
                    avatarUrl: res.userInfo.avatarUrl
                });
            },
            fail: (err) => {
                console.error('获取用户信息失败:', err);
                callback(null);
            }
        });
    }

    public shareInviteCard(roomId: string, playerName: string, callback: (success: boolean) => void): void {
        if (!this.isWeChatEnvironment()) {
            console.warn('当前不在微信小游戏环境');
            callback(false);
            return;
        }

        const encodedRoomId = encodeURIComponent(roomId);
        const encodedPlayerName = encodeURIComponent(playerName);

        wx.shareAppMessage({
            title: `${playerName} 邀请你加入游戏`,
            imageUrl: 'invite_card.png',
            query: `roomId=${encodedRoomId}&playerName=${encodedPlayerName}`,
            success: () => {
                callback(true);
            },
            fail: (err) => {
                console.error('分享失败:', err);
                callback(false);
            }
        });
    }

    public handleShareCallback(query: { roomId?: string; playerName?: string }): void {
        if (this._shareCallbackHandler) {
            this._shareCallbackHandler(query);
        }
    }

    public onShareCallback(handler: (query: { roomId?: string; playerName?: string }) => void): void {
        this._shareCallbackHandler = handler;
    }
}
