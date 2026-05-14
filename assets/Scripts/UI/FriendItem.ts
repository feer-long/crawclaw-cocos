import { _decorator, Component, Node, Label, Sprite, SpriteFrame, assetManager, Texture2D } from 'cc';
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
        this.loadAvatar(friend.avatarUrl);
    }
    
    private loadAvatar(url: string): void {
        if (!url || !this.avatarSprite) {
            return;
        }
        
        assetManager.loadRemote<Texture2D>(url, (err, texture) => {
            if (err || !texture) {
                return;
            }
            
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            this.avatarSprite.spriteFrame = spriteFrame;
        });
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
