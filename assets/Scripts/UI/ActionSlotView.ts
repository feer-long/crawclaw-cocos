import { _decorator, Component, Label, Sprite, Color } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('ActionSlotView')
export class ActionSlotView extends Component {

    @property(Label) public ownerLabel: Label = null;
    @property(Sprite) public bgSprite: Sprite = null;

    private areaId: string = "";
    private slotIndex: number = -1;

    private canPlace: boolean = false;
    private canCancel: boolean = false;

    public init(areaId: string, slotIndex: number, occupantId: number | null, players: any[], canPlace: boolean, canCancel: boolean) {
        this.areaId = areaId;
        this.slotIndex = slotIndex;
        this.canPlace = canPlace;
        this.canCancel = canCancel;

        if (occupantId !== null) {
            const owner = players.find(p => p.id == occupantId);
            if (this.canCancel) {
                this.ownerLabel.string = owner ? owner.name + "\n(点击撤回)" : "点击撤回";
                this.bgSprite.color = new Color(255, 180, 50); // 橙色：可撤回
            } else {
                this.ownerLabel.string = owner ? owner.name : "已占领";
                this.bgSprite.color = new Color(200, 100, 100); // 红色：钉死了
            }
        } else {
            this.ownerLabel.string = `格 ${slotIndex + 1}`;
            this.bgSprite.color = new Color(200, 200, 200);
        }
    }

    public onSlotClicked() {
        if (this.canCancel) {
            console.log(`向服务器请求撤回 ${this.areaId} 的第 ${this.slotIndex} 格的里长...`);
            NetworkManager.instance.send('clientGameAction', 'cancelHeadman', { payload: {} });

            // 撤销后，把小本本上的记录擦掉
            cc.sys.localStorage.removeItem('myLastPlacedArea');
            cc.sys.localStorage.removeItem('myLastPlacedSlot');
            return;
        }

        if (this.canPlace) {
            console.log(`向服务器请求在 ${this.areaId} 的第 ${this.slotIndex} 格放置里长...`);
            NetworkManager.instance.send('clientGameAction', 'placeHeadman', {
                payload: {
                    areaIndex: this.areaId,
                    slotIndex: this.slotIndex
                }
            });

            // 【核心修复】：服务器不发位置，我们自己记在小本本上！
            cc.sys.localStorage.setItem('myLastPlacedArea', this.areaId);
            cc.sys.localStorage.setItem('myLastPlacedSlot', this.slotIndex.toString());
            return;
        }

        console.log("现在不能操作！可能是没轮到你，或者没有里长了，或者格子被他人占了。");
    }
}