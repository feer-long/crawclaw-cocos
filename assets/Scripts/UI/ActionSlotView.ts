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
        this.slotIndex = slotIndex;
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
                this.bgSprite.color = new Color(255, 180, 50);
            } else {
                this.ownerLabel.string = owner ? owner.name : "已占领";
                this.bgSprite.color = new Color(200, 100, 100);
            }
        } else {
            this.ownerLabel.string = "";
            this.bgSprite.color = new Color(200, 200, 200);
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
                if (index === 3) { reward = ""; count = "1"; }
                if (index === 4) { reward = ""; count = "1"; }
                if (index === 5) { reward = "第4回合+"; count = "1"; }
                if (index === 0) { reward = "⚔️斗正上方"; count = "1"; }
                if (index === 1) { reward = "⚔️斗正上方"; count = "1"; }
                if (index === 2) { reward = "⚔️斗正上方"; count = "1"; }
                if (index === 6) { reward = ""; count = "1"; }
                if (index === 7) { reward = ""; count = "1"; }
                break;
            case 'marketplace':
                if (index === 0) { reward = "第2回合+"; count = "1"; }
                if (index === 1) { reward = "金×1(3+)"; count = "1"; }
                if (index === 2) { reward = "金×2(4+)"; count = "1"; }
                break;
            // 【核心新增】：市场内的雇佣里长区
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
            // 【核心拦截】：如果是雇佣区，我们要发送专门的 areaAction，因为现在是结算阶段！
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
    }
}