import { _decorator, Component, Node, Label, ScrollView, instantiate, Prefab } from 'cc';
import { WeChatAdapter, Friend } from '../WeChat/WeChatAdapter';
import { InviteManager } from '../WeChat/InviteManager';

const { ccclass, property } = _decorator;

@ccclass('FriendListPopup')
export class FriendListPopup extends Component {
    @property(ScrollView)
    public scrollView: ScrollView = null;
    
    @property(Node)
    public content: Node = null;
    
    @property(Prefab)
    public friendItemPrefab: Prefab = null;
    
    @property(Label)
    public titleLabel: Label = null;
    
    @property(Node)
    public closeButton: Node = null;
    
    @property(Label)
    public statusLabel: Label = null;
    
    private roomId: string = '';
    private playerName: string = '';
    private isLoading: boolean = false;
    
    onLoad() {
        this.titleLabel.string = '邀请好友';
        this.closeButton.on(Node.EventType.TOUCH_END, this.onClose, this);
        if (this.statusLabel) {
            this.statusLabel.node.active = false;
        }
    }
    
    public show(roomId: string, playerName: string): void {
        this.roomId = roomId;
        this.playerName = playerName;
        this.node.active = true;
        this.loadFriendList();
    }
    
    public hide(): void {
        this.node.active = false;
    }
    
    private onClose(): void {
        this.hide();
    }
    
    private showStatus(message: string): void {
        if (this.statusLabel) {
            this.statusLabel.string = message;
            this.statusLabel.node.active = true;
        }
    }
    
    private hideStatus(): void {
        if (this.statusLabel) {
            this.statusLabel.node.active = false;
        }
    }
    
    private loadFriendList(): void {
        if (this.isLoading) {
            return;
        }
        this.isLoading = true;
        this.showStatus('正在加载好友列表...');
        this.content.removeAllChildren();
        
        WeChatAdapter.instance.getFriendList((friends) => {
            this.isLoading = false;
            this.hideStatus();
            this.renderFriendList(friends);
        });
    }
    
    private renderFriendList(friends: Friend[]): void {
        this.content.removeAllChildren();
        
        if (friends.length === 0) {
            this.showEmptyState();
            return;
        }
        
        friends.forEach((friend) => {
            const friendItem = instantiate(this.friendItemPrefab);
            friendItem.parent = this.content;
            
            const friendItemComponent = friendItem.getComponent('FriendItem');
            if (friendItemComponent) {
                friendItemComponent.setFriendInfo(friend);
                friendItemComponent.setOnInviteCallback(() => {
                    this.onInviteFriend(friend);
                });
            }
        });
    }
    
    private showEmptyState(): void {
        const emptyNode = new Node();
        emptyNode.parent = this.content;
        
        const label = emptyNode.addComponent(Label);
        label.string = '暂无好友';
        label.fontSize = 24;
    }
    
    private onInviteFriend(friend: Friend): void {
        console.log('邀请好友:', friend.nickname);
        this.showStatus(`正在向 ${friend.nickname} 发送邀请...`);
        InviteManager.instance.inviteFriend(this.roomId, this.playerName);
        this.showInviteSuccess(friend.nickname);
    }
    
    private showInviteSuccess(friendName: string): void {
        this.showStatus(`已向 ${friendName} 发送邀请`);
        setTimeout(() => {
            this.hideStatus();
        }, 2000);
    }
}
