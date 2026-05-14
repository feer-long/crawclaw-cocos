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

    private _friendListCallbacks: Array<(friends: Friend[]) => void> = [];
    private _shareCallbackHandler: ((query: { roomId?: string; inviter?: string }) => void) | null = null;

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
                const friends = data.friends || [];
                this._friendListCallbacks.forEach((cb) => cb(friends));
                this._friendListCallbacks = [];
            }
        });
    }

    public getFriendList(callback: (friends: Friend[]) => void): void {
        if (!this.isWeChatEnvironment()) {
            console.warn('当前不在微信小游戏环境');
            callback([]);
            return;
        }

        this._friendListCallbacks.push(callback);

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
            query: `roomId=${encodedRoomId}&inviter=${encodedPlayerName}`,
            success: () => {
                callback(true);
            },
            fail: (err) => {
                console.error('分享失败:', err);
                callback(false);
            }
        });
    }

    public handleShareCallback(query: { roomId?: string; inviter?: string }): void {
        if (this._shareCallbackHandler) {
            this._shareCallbackHandler(query);
        }
    }

    public onShareCallback(handler: (query: { roomId?: string; inviter?: string }) => void): void {
        this._shareCallbackHandler = handler;
    }
}
