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
    private failReason: string = ""; // 【新增】：精准记录不能点击的原因

    public init(areaId: string, slotIndex: number, occupantId: number | null, players: any[], canPlace: boolean, canCancel: boolean, failReason: string = "") {
        this.areaId = areaId;
        this.slotIndex = slotIndex;
        this.canPlace = canPlace;
        this.canCancel = canCancel;
        this.failReason = failReason;

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
                this.bgSprite.color = new Color(255, 180, 50);
            } else {
                this.ownerLabel.string = owner ? owner.name : "已占领";
                this.bgSprite.color = new Color(200, 100, 100);
            }
        } else {
            this.ownerLabel.string = "";
            // 如果是因为条件不满足而不可点击，底色加深一点点作为反馈
            if (!this.canPlace && this.failReason) {
                this.bgSprite.color = new Color(170, 170, 170);
            } else {
                this.bgSprite.color = new Color(200, 200, 200);
            }
        }
    }

    private getSlotInfo(areaId: string, index: number): { reward: string, count: string } {
        let reward = "", count = "";
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
                if (index === 0) { reward = ""; count = "1"; }
                if (index === 1) { reward = ""; count = "1"; }
                if (index === 2) { reward = "第4回合+"; count = "1"; }
                if (index === 3) { reward = "⚔️斗正上方"; count = "1"; }
                if (index === 4) { reward = "⚔️斗正上方"; count = "1"; }
                if (index === 5) { reward = "⚔️斗正上方"; count = "1"; }
                if (index === 6) { reward = ""; count = "1"; }
                if (index === 7) { reward = ""; count = "1"; }
                break;
            case 'marketplace':
                if (index === 0) { reward = "第2回合+"; count = "1"; }
                if (index === 1) { reward = "金×1(3+)"; count = "1"; }
                if (index === 2) { reward = "金×2(4+)"; count = "1"; }
                break;
            case 'hire_headman':
                if (index === 0 || index === 1) { reward = "草×1"; count = "2回+"; }
                if (index === 2 || index === 3) { reward = "普虾×1"; count = "3回+"; }
                if (index === 4 || index === 5) { reward = "3品虾×1"; count = "4回+"; }
                if (index === 6 || index === 7) { reward = "2品虾×1"; count = "4回+"; }
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
            if (this.areaId === 'hire_headman') {
                NetworkManager.instance.send('clientGameAction', 'areaAction', {
                    payload: { actionType: 'hire_headman_slot', payload: { slotIndex: this.slotIndex } }
                });
                return;
            }

            NetworkManager.instance.send('clientGameAction', 'placeHeadman', {
                payload: { areaIndex: this.areaId, slotIndex: this.slotIndex }
            });
            cc.sys.localStorage.setItem('myLastPlacedArea', this.areaId);
            cc.sys.localStorage.setItem('myLastPlacedSlot', this.slotIndex.toString());
            return;
        }

        // 【核心体验升级】：在控制台精准输出点不动的原因！
        console.warn(`❌ 槽位点击无效: ${this.failReason || '条件不满足'}`);
    }
}