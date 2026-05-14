import { _decorator, Component, Node, Label, Sprite } from 'cc';
import { Friend } from '../WeChat/WeChatAdapter';

const { ccclass, property } = _decorator;

@ccclass('FriendItem')
export class FriendItem extends Component {
    @property(Label)
    public nameLabel: Label = null;
    
    @property(Sprite)
    public avatarSprite: Sprite = null;
    
    @property(Node)
    public inviteButton: Node = null;
    
    private friend: Friend = null;
    private onInviteCallback: () => void = null;
    
    onLoad() {
        this.inviteButton.on(Node.EventType.TOUCH_END, this.onInviteClick, this);
    }
    
    public setFriendInfo(friend: Friend): void {
        this.friend = friend;
        this.nameLabel.string = friend.nickname;
    }
    
    public setOnInviteCallback(callback: () => void): void {
        this.onInviteCallback = callback;
    }
    
    private onInviteClick(): void {
        if (this.onInviteCallback) {
            this.onInviteCallback();
        }
    }
}
