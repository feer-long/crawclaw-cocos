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

    public isWeChatEnvironment(): boolean {
        return typeof wx !== 'undefined';
    }

    public init(): void {
        if (!this.isWeChatEnvironment()) {
            console.warn('当前不在微信小游戏环境');
            return;
        }
        this.initShare();
    }

    private initShare(): void {
        if (!this.isWeChatEnvironment()) return;

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

    public getFriendList(callback: (friends: Friend[]) => void): void {
        if (!this.isWeChatEnvironment()) {
            console.warn('当前不在微信小游戏环境');
            callback([]);
            return;
        }

        wx.getOpenDataContext().postMessage({
            type: 'getFriendList'
        });

        wx.onMessage((data) => {
            if (data.type === 'friendList') {
                callback(data.friends || []);
            }
        });
    }

    public getUserInfo(callback: (userInfo: UserInfo) => void): void {
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

        wx.shareAppMessage({
            title: `${playerName} 邀请你加入游戏`,
            imageUrl: 'invite_card.png',
            query: `roomId=${roomId}&inviter=${playerName}`,
            success: () => {
                console.log('分享成功');
                callback(true);
            },
            fail: (err) => {
                console.error('分享失败:', err);
                callback(false);
            }
        });
    }

    public handleShareCallback(query: any): void {
        if (query && query.roomId) {
            console.log('收到邀请回调:', query);
        }
    }
}
