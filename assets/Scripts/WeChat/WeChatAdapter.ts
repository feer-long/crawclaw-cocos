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
                imageUrl: 'https://crawclaw-1312271570.cos.ap-shanghai.myqcloud.com/logo.png'
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

    /**
     * @deprecated 微信已废弃此 API，现在只返回脱敏数据（"微信用户"）
     * 请使用 getUserInfoWithButton 替代
     */
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
            imageUrl: 'https://crawclaw-1312271570.cos.ap-shanghai.myqcloud.com/logo.png',
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

    private _authButton: WxUserInfoButton | null = null;

    public getUserInfoRecommended(
        buttonPosition: { x: number; y: number; width: number; height: number },
        callback: (userInfo: UserInfo | null) => void
    ): void {
        if (!this.isWeChatEnvironment()) {
            callback(null);
            return;
        }

        wx.getSetting({
            success: (res) => {
                if (res.authSetting['scope.userInfo'] === true) {
                    wx.getUserInfo({
                        success: (res) => {
                            callback({
                                openId: res.userInfo.openId,
                                nickname: res.userInfo.nickName,
                                avatarUrl: res.userInfo.avatarUrl
                            });
                        },
                        fail: () => {
                            callback(null);
                        }
                    });
                } else {
                    this.getUserInfoWithButton(buttonPosition, callback);
                }
            },
            fail: () => {
                this.getUserInfoWithButton(buttonPosition, callback);
            }
        });
    }

    public getUserInfoWithButton(
        buttonPosition: { x: number; y: number; width: number; height: number },
        callback: (userInfo: UserInfo | null) => void
    ): void {
        if (!this.isWeChatEnvironment()) {
            console.warn('当前不在微信小游戏环境');
            callback(null);
            return;
        }

        try {
            this._authButton = wx.createUserInfoButton({
                type: 'text',
                text: ' ',
                style: {
                    left: buttonPosition.x,
                    top: buttonPosition.y,
                    width: buttonPosition.width,
                    height: buttonPosition.height,
                    backgroundColor: 'rgba(214,214,214,0)',
                    color: 'transparent',
                    textAlign: 'center',
                    fontSize: 1,
                    lineHeight: buttonPosition.height
                }
            });

            this._authButton.onTap((res) => {
                const button = this._authButton;
                this._authButton = null;
                button.destroy();

                if (res.errMsg && res.errMsg.indexOf('no privacy api permission') > -1) {
                    console.error('[WeChatAdapter] 需要隐私授权，请在微信管理后台配置隐私协议');
                }

                if (res.userInfo) {
                    callback({
                        openId: res.userInfo.openId,
                        nickname: res.userInfo.nickName,
                        avatarUrl: res.userInfo.avatarUrl
                    });
                } else {
                    callback(null);
                }
            });
        } catch (err) {
            console.error('创建微信授权按钮失败:', err);
            this._authButton = null;
            callback(null);
        }
    }

    public destroyAuthButton(): void {
        if (this._authButton) {
            try {
                this._authButton.destroy();
            } catch (e) {
                // 按钮可能已被销毁
            }
            this._authButton = null;
        }
    }

}
