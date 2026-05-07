import { _decorator, Component, Label, Sprite, Color, SpriteFrame, Node, Vec3, Widget } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('ActionSlotView')
export class ActionSlotView extends Component {

    @property(Sprite) public bgSprite: Sprite = null;
    @property(Label) public actionCountLabel: Label = null;
    @property(Label) public actionTimesLabel: Label = null;

    @property(Sprite) public playerSprite: Sprite = null;
    @property(Node) public rewardNode: Node = null;

    @property(Node) public firstFlagSprite: Node = null;

    @property(Sprite) public rewardSprite: Sprite = null;
    @property(Label) public labelReward: Label = null;
    @property(Label) public rewardLabel: Label = null;

    @property(SpriteFrame) public tokenWhite: SpriteFrame = null;
    @property(SpriteFrame) public tokenBlue: SpriteFrame = null;
    @property(SpriteFrame) public tokenGreen: SpriteFrame = null;
    @property(SpriteFrame) public tokenRed: SpriteFrame = null;
    @property(SpriteFrame) public tokenYellow: SpriteFrame = null;

    @property(SpriteFrame) public iconCoin: SpriteFrame = null;
    @property(SpriteFrame) public iconGrass: SpriteFrame = null;
    @property(SpriteFrame) public iconCage: SpriteFrame = null;

    private areaId: string = "";
    private slotIndex: number = -1;
    private canPlace: boolean = false;
    private canCancel: boolean = false;
    private failReason: string = "";

    public init(areaId: string, slotIndex: number, occupantId: number | null, players: any[], canPlace: boolean, canCancel: boolean, failReason: string = "") {
        this.areaId = areaId;
        this.slotIndex = slotIndex;
        this.canPlace = canPlace;
        this.canCancel = canCancel;
        this.failReason = failReason;

        // ==========================================
        // 1. 初始化还原节点状态
        // ==========================================
        if (this.firstFlagSprite) this.firstFlagSprite.active = false;
        if (this.rewardNode) this.rewardNode.active = true;
        if (this.rewardSprite) this.rewardSprite.node.active = true;
        if (this.labelReward) this.labelReward.node.active = true;
        if (this.rewardLabel) this.rewardLabel.node.active = true;
        if (this.actionCountLabel) this.actionCountLabel.node.active = true;
        if (this.actionTimesLabel) this.actionTimesLabel.node.active = true;

        let rewardStr = "";
        let countStr = "";
        let isNoReward = false;

        // ==========================================
        // 2. 五大区域定制化排版与数值逻辑
        // ==========================================
        switch (areaId) {
            case 'shrimp_catching':
                if (slotIndex === 0) {
                    rewardStr = "笼×1"; countStr = "1";
                    if (this.firstFlagSprite) this.firstFlagSprite.active = true;
                }
                else if (slotIndex === 1) { rewardStr = "笼×1"; countStr = "2"; }
                else if (slotIndex === 2) { rewardStr = "金×1"; countStr = "3"; }
                else if (slotIndex === 3) { isNoReward = true; countStr = "4"; }

                if (!isNoReward) this.applyRewardScale(rewardStr, 0.022, 0.056, 0.056);
                break;

            case 'seafood_market':
                if (slotIndex === 0) { rewardStr = "金×1"; countStr = "2"; }
                else if (slotIndex === 1) { isNoReward = true; countStr = "3"; }
                else if (slotIndex === 2) { rewardStr = "金×1"; countStr = "3"; }
                else if (slotIndex === 3) { rewardStr = "金×2"; countStr = "3"; }

                if (!isNoReward) this.applyRewardScale(rewardStr, 0.022, 0.056, 0.056);
                break;

            case 'breeding':
                if (slotIndex === 0) { rewardStr = "草×1"; countStr = "1"; }
                else if (slotIndex === 1) { isNoReward = true; countStr = "2"; }
                else if (slotIndex === 2) { rewardStr = "金×1"; countStr = "2"; }
                else if (slotIndex === 3) { isNoReward = true; countStr = "3"; }

                if (!isNoReward) this.applyRewardScale(rewardStr, 0.022, 0.056, 0.056);
                break;

            case 'tribute':
                if (this.actionCountLabel) this.actionCountLabel.node.active = false;
                if (this.actionTimesLabel) this.actionTimesLabel.node.active = false;
                if (this.rewardSprite) this.rewardSprite.node.active = false;

                if (slotIndex < 3) {
                    if (this.labelReward) this.labelReward.string = "顺序";
                    if (this.rewardLabel) this.rewardLabel.string = (slotIndex + 1).toString();
                } else {
                    if (this.labelReward) this.labelReward.string = "挑战";
                    if (this.rewardLabel) this.rewardLabel.string = (slotIndex - 2).toString();
                }
                break;

            case 'marketplace':
                if (this.actionCountLabel) this.actionCountLabel.node.active = false;
                if (this.actionTimesLabel) this.actionTimesLabel.node.active = false;

                if (slotIndex === 0) {
                    if (this.rewardSprite) this.rewardSprite.node.active = false;
                    if (this.rewardLabel) this.rewardLabel.node.active = false;
                    if (this.labelReward) this.labelReward.string = "第2回合+";
                } else if (slotIndex === 1) {
                    rewardStr = "金×1";
                    if (this.labelReward) this.labelReward.string = "奖励";
                } else if (slotIndex === 2) {
                    rewardStr = "金×2";
                    if (this.labelReward) this.labelReward.string = "奖励";
                }

                if (slotIndex > 0) {
                    this.applyRewardScale(rewardStr, 0.076, 0.076, 0.076);
                }
                break;
        }

        // ==========================================
        // 3. 处理无奖励时的排版移动逻辑
        // ==========================================
        if (isNoReward) {
            if (this.rewardNode) this.rewardNode.active = false;

            // 【核心修复1】：强行关闭 Widget 组件，保证代码控制坐标绝对生效！
            if (this.actionCountLabel) {
                const widget = this.actionCountLabel.getComponent(Widget);
                if (widget) widget.enabled = false;

                const pos = this.actionCountLabel.node.position;
                this.actionCountLabel.node.setPosition(new Vec3(pos.x, -83, pos.z));
            }
            if (this.actionTimesLabel) {
                const widget = this.actionTimesLabel.getComponent(Widget);
                if (widget) widget.enabled = false;

                const pos = this.actionTimesLabel.node.position;
                this.actionTimesLabel.node.setPosition(new Vec3(pos.x, -83, pos.z));
            }
        } else {
            if (this.actionCountLabel && countStr !== "") {
                this.actionCountLabel.string = countStr;
            }
        }

        // ==========================================
        // 4. 玩家 Token 渲染与占领状态
        // ==========================================
        if (this.playerSprite) {
            if (occupantId !== null) {
                const playerIndex = players.findIndex(p => p.id == occupantId);

                if (playerIndex === 0) this.playerSprite.spriteFrame = this.tokenBlue;
                else if (playerIndex === 1) this.playerSprite.spriteFrame = this.tokenGreen;
                else if (playerIndex === 2) this.playerSprite.spriteFrame = this.tokenRed;
                else if (playerIndex === 3) this.playerSprite.spriteFrame = this.tokenYellow;
                else this.playerSprite.spriteFrame = this.tokenWhite;

                this.playerSprite.node.setScale(new Vec3(0.113, 0.113, 1));
                this.bgSprite.color = this.canCancel ? new Color(255, 180, 50) : new Color(200, 100, 100);
            } else {
                this.playerSprite.spriteFrame = this.tokenWhite;
                this.playerSprite.node.setScale(new Vec3(0.036, 0.036, 1));
                this.bgSprite.color = (!this.canPlace && this.failReason) ? new Color(170, 170, 170) : new Color(250, 250, 250);
            }
        }
    }

    // ==========================================
    // 资源图标解析与尺寸调节器
    // ==========================================
    private applyRewardScale(rewardStr: string, cageScale: number, grassScale: number, coinScale: number) {
        if (!rewardStr || !this.rewardSprite || !this.rewardLabel) return;

        let numStr = "";

        if (rewardStr.includes("金")) {
            this.rewardSprite.spriteFrame = this.iconCoin;
            this.rewardSprite.node.setScale(new Vec3(coinScale, coinScale, 1));
            numStr = rewardStr.replace("金", "");
        } else if (rewardStr.includes("草")) {
            this.rewardSprite.spriteFrame = this.iconGrass;
            this.rewardSprite.node.setScale(new Vec3(grassScale, grassScale, 1));
            numStr = rewardStr.replace("草", "");
        } else if (rewardStr.includes("笼")) {
            this.rewardSprite.spriteFrame = this.iconCage;
            this.rewardSprite.node.setScale(new Vec3(cageScale, cageScale, 1));
            numStr = rewardStr.replace("笼", "");
        }

        // 【核心修复2】：如果是“×1”，直接隐藏数字 Label！
        if (numStr === "×1" || numStr === "x1" || numStr === "1") {
            this.rewardLabel.node.active = false;
        } else {
            this.rewardLabel.node.active = true;
            this.rewardLabel.string = numStr;
        }
    }

    public onSlotClicked() {
        if (this.canCancel) {
            NetworkManager.instance.send('clientGameAction', 'cancelHeadman', { payload: {} });
            return;
        }

        if (this.canPlace) {
            NetworkManager.instance.send('clientGameAction', 'placeHeadman', {
                payload: { areaIndex: this.areaId, slotIndex: this.slotIndex }
            });
            return;
        }

        console.warn(`❌ 槽位点击无效: ${this.failReason || '条件不满足'}`);
    }
}