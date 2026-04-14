import { _decorator, Component, Label, Sprite, Color } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('ActionSlotView')
export class ActionSlotView extends Component {

    @property(Label) public ownerLabel: Label = null;
    @property(Sprite) public bgSprite: Sprite = null;

    @property(Label) public rewardLabel: Label = null;
    @property(Label) public actionCountLabel: Label = null;

    private areaId: string = "";
    private slotIndex: number = -1;

    private canPlace: boolean = false;
    private canCancel: boolean = false;

    public init(areaId: string, slotIndex: number, occupantId: number | null, players: any[], canPlace: boolean, canCancel: boolean) {
        this.areaId = areaId;
        this.slotIndex = slotIndex; // 底层逻辑索引，坚决不动，保证后端结算不乱！
        this.canPlace = canPlace;
        this.canCancel = canCancel;

        const slotInfo = this.getSlotInfo(areaId, slotIndex);

        if (this.rewardLabel) {
            this.rewardLabel.string = slotInfo.reward;
            this.rewardLabel.node.active = slotInfo.reward !== "";
        }

        if (this.actionCountLabel) {
            this.actionCountLabel.string = slotInfo.count;
            this.actionCountLabel.node.active = slotInfo.count !== "";
        }

        if (occupantId !== null) {
            const owner = players.find(p => p.id == occupantId);
            if (this.canCancel) {
                this.ownerLabel.string = owner ? owner.name + "\n(可撤回)" : "可撤回";
                this.bgSprite.color = new Color(255, 180, 50); // 橙色：可撤回
            } else {
                this.ownerLabel.string = owner ? owner.name : "已占领";
                this.bgSprite.color = new Color(200, 100, 100); // 红色：钉死了
            }
        } else {
            // 【核心修改】：把原本的 `格 ${slotIndex + 1}` 直接设为空字符串
            this.ownerLabel.string = "";
            this.bgSprite.color = new Color(200, 200, 200); // 灰色：空闲
        }
    }

    /**
     * reward: 左上角小字固定收益
     * count: 右下角大字执行次数
     */
    private getSlotInfo(areaId: string, index: number): { reward: string, count: string } {
        let reward = "";
        let count = "";

        switch (areaId) {
            case 'shrimp_catching':
                if (index === 0) { reward = "笼×1+先手"; count = "1"; }
                if (index === 1) { reward = "笼×1"; count = "2"; }
                if (index === 2) { reward = "金×1"; count = "3"; }
                if (index === 3) { reward = ""; count = "4"; }
                break;

            case 'seafood_market':
                if (index === 0) { reward = "金×1"; count = "2"; }
                if (index === 1) { reward = ""; count = "3"; }
                if (index === 2) { reward = "金×1"; count = "3"; }
                if (index === 3) { reward = "金×2"; count = "3"; }
                break;

            case 'breeding':
                if (index === 0) { reward = "草×1"; count = "1"; }
                if (index === 1) { reward = ""; count = "2"; }
                if (index === 2) { reward = "金×1"; count = "2"; }
                if (index === 3) { reward = ""; count = "3"; }
                break;

            case 'tribute':
                // 第一行：被挑战位 (后端索引 3, 4, 5)
                if (index === 3) { reward = ""; count = "1"; }
                if (index === 4) { reward = ""; count = "1"; }
                if (index === 5) { reward = "第4回合+"; count = "1"; }
                // 第二行：挑战位 (后端索引 0, 1, 2)
                if (index === 0) { reward = "⚔️斗正上方"; count = "1"; }
                if (index === 1) { reward = "⚔️斗正上方"; count = "1"; }
                if (index === 2) { reward = "⚔️斗正上方"; count = "1"; }
                // 第二行：普通位 (后端索引 6, 7)
                if (index === 6) { reward = ""; count = "1"; }
                if (index === 7) { reward = ""; count = "1"; }
                break;

            case 'marketplace':
                if (index === 0) { reward = "第2回合+"; count = "1"; }
                if (index === 1) { reward = "金×1(3+)"; count = "1"; }
                if (index === 2) { reward = "金×2(4+)"; count = "1"; }
                break;
        }

        return { reward, count };
    }

    public onSlotClicked() {
        if (this.canCancel) {
            NetworkManager.instance.send('clientGameAction', 'cancelHeadman', { payload: {} });
            cc.sys.localStorage.removeItem('myLastPlacedArea');
            cc.sys.localStorage.removeItem('myLastPlacedSlot');
            return;
        }

        if (this.canPlace) {
            NetworkManager.instance.send('clientGameAction', 'placeHeadman', {
                payload: {
                    areaIndex: this.areaId,
                    slotIndex: this.slotIndex // 发送真实的后端索引，保证后台逻辑严丝合缝
                }
            });
            cc.sys.localStorage.setItem('myLastPlacedArea', this.areaId);
            cc.sys.localStorage.setItem('myLastPlacedSlot', this.slotIndex.toString());
            return;
        }
    }
}