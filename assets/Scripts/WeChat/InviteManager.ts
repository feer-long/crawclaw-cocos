import { EventTarget } from 'cc';
import { WeChatAdapter } from './WeChatAdapter';
import { NetworkManager } from '../Network/NetworkManager';

export class InviteManager {
    private static _instance: InviteManager = null;
    public eventTarget: EventTarget = new EventTarget();

    public static get instance(): InviteManager {
        if (!this._instance) {
            this._instance = new InviteManager();
        }
        return this._instance;
    }

    public init(): void {
        if (WeChatAdapter.instance.isWeChatEnvironment()) {
            wx.onShow((res) => {
                if (res.query && res.query.roomId) {
                    this.handleFriendJoin(res.query);
                }
            });
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
        const inviter = query.inviter;

        console.log(`处理好友加入: 房间 ${roomId}, 邀请者 ${inviter}`);
        this.joinRoom(roomId);
    }

    private joinRoom(roomId: string): void {
        NetworkManager.instance.send('clientRoomAction', 'joinRoom', {
            roomId: roomId,
            playerName: '微信好友',
            userId: 'wx_' + Math.random().toString(36).substr(2, 9)
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
        NetworkManager.instance.eventTarget.off('playerJoined', this.onPlayerJoined, this);
        NetworkManager.instance.eventTarget.off('error', this.onError, this);
    }
}
