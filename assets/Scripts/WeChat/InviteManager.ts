import { EventTarget } from 'cc';
import { WeChatAdapter } from './WeChatAdapter';
import { NetworkManager } from '../Network/NetworkManager';

export class InviteManager {
    private static _instance: InviteManager = null;
    public eventTarget: EventTarget = new EventTarget();
    private _onShowCallback: ((res: any) => void) | null = null;
    private _userId: string | null = null;

    public static get instance(): InviteManager {
        if (!this._instance) {
            this._instance = new InviteManager();
        }
        return this._instance;
    }

    public init(): void {
        if (WeChatAdapter.instance.isWeChatEnvironment()) {
            this._onShowCallback = (res: any) => {
                if (res.query && res.query.roomId) {
                    this.handleFriendJoin(res.query);
                }
            };
            wx.onShow(this._onShowCallback);
        }

        NetworkManager.instance.eventTarget.on('playerJoined', this.onPlayerJoined, this);
        NetworkManager.instance.eventTarget.on('error', this.onError, this);
    }

    public inviteFriend(roomId: string, playerName: string): void {
        WeChatAdapter.instance.shareInviteCard(roomId, playerName, (success) => {
            if (success) {
                console.log('邀请发送成功');
                this.eventTarget.emit('inviteSent', { roomId, playerName });
            } else {
                console.error('邀请发送失败');
                this.eventTarget.emit('inviteFailed', { roomId, playerName });
            }
        });
    }

    public handleFriendJoin(query: any): void {
        if (!query || !query.roomId) {
            console.error('无效的邀请参数');
            return;
        }

        const roomId = query.roomId;
        const playerName = query.playerName;

        console.log(`处理好友加入: 房间 ${roomId}`);
        this.joinRoom(roomId, playerName);
    }

    private joinRoom(roomId: string, playerName?: string): void {
        if (!NetworkManager.instance.isConnected()) {
            console.error('网络未连接，无法加入房间');
            this.eventTarget.emit('joinFailed', { reason: 'network_not_connected', roomId });
            return;
        }

        const resolvedName = playerName || '微信好友';
        if (!this._userId) {
            this._userId = 'wx_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
        }

        NetworkManager.instance.send('clientRoomAction', 'inviteJoin', {
            roomId: roomId,
            playerName: resolvedName,
            userId: this._userId
        });
    }

    private onPlayerJoined(data: any): void {
        console.log('玩家加入成功:', data);
        this.eventTarget.emit('joinSuccess', data);
    }

    private onError(data: any): void {
        console.error('邀请相关错误:', data);
        this.eventTarget.emit('joinFailed', data);
    }

    public destroy(): void {
        if (this._onShowCallback) {
            if (WeChatAdapter.instance.isWeChatEnvironment()) {
                wx.offShow(this._onShowCallback);
            }
            this._onShowCallback = null;
        }

        NetworkManager.instance.eventTarget.off('playerJoined', this.onPlayerJoined, this);
        NetworkManager.instance.eventTarget.off('error', this.onError, this);
    }
}
