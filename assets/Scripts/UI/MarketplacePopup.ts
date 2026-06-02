import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite, tween, Vec3, UIOpacity, UITransform } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

const RES_NAMES: any = {
    'lobsters': '龙虾', 'coins': '金币', 'seaweed': '海草',
    'cages': '虾笼', 'de': '德', 'wang': '望',
    'normal': '普虾', 'grade3': '三品虾', 'grade2': '二品虾', 'grade1': '一品虾', 'royal': '虾王'
};

@ccclass('MarketplacePopup')
export class MarketplacePopup extends Component {

    @property(Label) public resourceLabel: Label = null;
    @property(Label) public hintLabel: Label = null;

    @property({ type: [Node], tooltip: '固定的三个卡牌节点' })
    public staticCards: Node[] = [];

    @property(Node) public optionPanel: Node = null;
    @property(Node) public optionContainer: Node = null;

    // 【修改点1】：将单个模板替换为两个不同的样式模板
    @property({ type: Node, tooltip: '选项1的样式模板' })
    public optionTemplate1: Node = null;
    @property({ type: Node, tooltip: '选项2的样式模板' })
    public optionTemplate2: Node = null;

    @property(Button) public btnConfirm: Button = null;
    @property(Button) public btnSkip: Button = null;

    @property({ type: Node, tooltip: '用于卡牌放大时遮挡背景的半透明遮罩' })
    public innerMask: Node = null;

    private rawData: any = null;
    private player: any = null;
    private availableCards: any[] = [];

    private selectedCardIndex: number = -1;
    private selectedOptionIndex: number = -1;

    private optionNodes: Node[] = [];

    private activeFocusNode: Node = null;
    private animCardNode: Node = null;
    private isAnimating: boolean = false;

    public init(data: any) {
        this.rawData = data;
        this.player = data.player;
        this.availableCards = data.availableCards || [];
        this.node.active = true;

        this.selectedCardIndex = -1;
        this.selectedOptionIndex = -1;

        if (this.innerMask && !this.innerMask.hasEventListener(Node.EventType.TOUCH_END)) {
            this.innerMask.on(Node.EventType.TOUCH_END, this.revertCardAnim, this);
        }

        this.bindStaticCards();
        this.refreshUI();
    }

    private bindStaticCards() {
        for (let i = 0; i < this.staticCards.length; i++) {
            const cardNode = this.staticCards[i];
            if (!cardNode) continue;

            if (i < this.availableCards.length) {
                cardNode.active = true;
                const cardData = this.availableCards[i];

                const frontNode = cardNode.getChildByName('Front');
                const backNode = cardNode.getChildByName('Back');

                const nameLabel = frontNode?.getComponentInChildren(Label);
                const descLabel = backNode?.getComponentInChildren(Label);

                if (nameLabel) nameLabel.string = `【${cardData.name || "闹市卡"}】`;
                if (descLabel) descLabel.string = cardData.description || "";

                cardNode.off(Node.EventType.TOUCH_END);
                cardNode.on(Node.EventType.TOUCH_END, () => {
                    if (this.isAnimating) return;
                    if (this.activeFocusNode === cardNode) return;

                    this.selectedCardIndex = i;
                    this.selectedOptionIndex = -1;

                    this.playCardFlipAnim(cardNode);

                    this.renderOptions();
                    this.refreshUI();
                }, this);

            } else {
                cardNode.active = false;
            }
        }
    }

    private playCardFlipAnim(targetNode: Node) {
        if (this.activeFocusNode && this.activeFocusNode !== targetNode) {
            this.revertCardAnim();
        }

        this.isAnimating = true;
        this.activeFocusNode = targetNode;

        if (this.innerMask) {
            this.innerMask.active = true;
            let uiOp = this.innerMask.getComponent(UIOpacity);
            if (!uiOp) uiOp = this.innerMask.addComponent(UIOpacity);
            tween(uiOp).to(0.2, { opacity: 180 }).start();
        }

        this.animCardNode = instantiate(targetNode);
        const panel = this.node.getChildByName('Panel') || this.node;
        panel.addChild(this.animCardNode);

        this.animCardNode.on(Node.EventType.TOUCH_END, this.revertCardAnim, this);
        this.animCardNode.setWorldPosition(targetNode.getWorldPosition());

        let targetOp = targetNode.getComponent(UIOpacity) || targetNode.addComponent(UIOpacity);
        targetOp.opacity = 0;

        const front = this.animCardNode.getChildByName('Front');
        const back = this.animCardNode.getChildByName('Back');

        if(back) back.active = false;
        if(front) front.active = true;

        tween(this.animCardNode)
            .to(0.25, { position: new Vec3(0, 50, 0), scale: new Vec3(1.5, 1.5, 1) })
            .to(0.15, { scale: new Vec3(0.01, 2.5, 1) })
            .call(() => {
                if (front) front.active = false;
                if (back) back.active = true;
            })
            .to(0.15, { scale: new Vec3(2.5, 2.5, 1) })
            .call(() => {
                this.isAnimating = false;
            })
            .start();
    }

    private revertCardAnim() {
        if (this.isAnimating || !this.activeFocusNode || !this.animCardNode) return;
        this.isAnimating = true;

        const realCard = this.activeFocusNode;
        const animCard = this.animCardNode;
        const front = animCard.getChildByName('Front');
        const back = animCard.getChildByName('Back');

        this.activeFocusNode = null;
        this.animCardNode = null;

        if (this.innerMask) {
            let uiOp = this.innerMask.getComponent(UIOpacity);
            if (uiOp) tween(uiOp).to(0.2, { opacity: 0 }).call(() => { this.innerMask.active = false; }).start();
        }

        const panel = this.node.getChildByName('Panel') || this.node;
        const panelTransform = panel.getComponent(UITransform);
        let targetLocalPos = panelTransform.convertToNodeSpaceAR(realCard.getWorldPosition());

        tween(animCard)
            .to(0.15, { scale: new Vec3(0.01, 2.5, 1) })
            .call(() => {
                if (front) front.active = true;
                if (back) back.active = false;
            })
            .to(0.15, { scale: new Vec3(1.5, 1.5, 1) })
            .to(0.25, { position: targetLocalPos, scale: new Vec3(1, 1, 1) })
            .call(() => {
                animCard.destroy();
                let realCardOp = realCard.getComponent(UIOpacity);
                if (realCardOp) realCardOp.opacity = 255;

                realCard.setScale(new Vec3(1, 1, 1));

                this.isAnimating = false;
            })
            .start();
    }

    private renderOptions() {
        this.optionNodes.forEach(n => n.destroy());
        this.optionNodes = [];

        if (this.selectedCardIndex === -1) return;

        const card = this.availableCards[this.selectedCardIndex];
        const options = card.action?.options || [];

        if (card.auto || options.length <= 1) {
            return;
        }

        for (let i = 0; i < options.length; i++) {
            const opt = options[i];

            // 【修改点2】：根据索引判断使用哪一个样式模板
            let templateToUse = this.optionTemplate1;
            if (i === 1 && this.optionTemplate2) {
                templateToUse = this.optionTemplate2; // 第2个选项用样式2
            } else if (i > 1) {
                // 如果出现第3个及以上的选项（通常不会有），安全兜底机制
                templateToUse = this.optionTemplate2 || this.optionTemplate1;
            }

            if (!templateToUse) continue;

            const node = instantiate(templateToUse);
            node.active = true; // 确保生成的节点是显示的
            this.optionContainer.addChild(node);

            const label = node.getComponentInChildren(Label);
            if (label) label.string = this.formatOptionString(opt);

            const affordable = this.canAfford(opt.cost);
            const btn = node.getComponent(Button);
            if (!affordable.ok) {
                if (btn) btn.interactable = false;
                node.getComponent(Sprite).color = new Color(150, 150, 150); // 资源不够时置灰
            }

            node.on(Button.EventType.CLICK, () => {
                this.selectedOptionIndex = i;
                this.refreshUI();
            }, this);

            this.optionNodes.push(node);
        }
    }

    private formatOptionString(opt: any): string {
        const cost = opt.cost || {};
        const reward = opt.reward || {};
        let costStr = Object.keys(cost).map(k => `${RES_NAMES[k] || k}×${cost[k]}`).join(' , ');
        let rewStr = Object.keys(reward).map(k => `${RES_NAMES[k] || k}×${reward[k]}`).join(' , ');
        if (!costStr) costStr = "无";
        if (!rewStr) rewStr = "无";
        return `消耗 [ ${costStr} ]  ➡️  获得 [ ${rewStr} ]`;
    }

    private canAfford(cost: any): { ok: boolean; reason: string } {
        if (!cost) return { ok: true, reason: "" };
        for (const key in cost) {
            const needed = cost[key];
            const have = this.player[key] || 0;
            if (have < needed) {
                return { ok: false, reason: `${RES_NAMES[key] || key}不足(需${needed})` };
            }
        }
        return { ok: true, reason: "" };
    }

    private refreshUI() {
        this.resourceLabel.string = `贝币:${this.player.coins} 仙草:${this.player.seaweed} 灵鼎:${this.player.cages} 灵螯:${this.player.lobsters.length}  | 道:${this.player.de} 运:${this.player.wang}`;

        for (let i = 0; i < this.staticCards.length; i++) {
            const cardNode = this.staticCards[i];
            if (!cardNode || !cardNode.active) continue;

            const frontContainer = cardNode.getChildByName('Front');
            const sprite = frontContainer ? frontContainer.getComponentInChildren(Sprite) : null;

            if (sprite) {
                sprite.color = (i === this.selectedCardIndex) ? new Color(94, 204, 231) : new Color(255, 255, 255);
            }
        }

        this.optionNodes.forEach((node, idx) => {
            const sprite = node.getComponent(Sprite);
            if (sprite) {
                sprite.color = (idx === this.selectedOptionIndex) ? new Color(94, 204, 231) : new Color(255, 255, 255);
            }
        });

        let canConfirm = false;

        if (this.selectedCardIndex === -1) {
            this.hintLabel.string = "👈 请在上方选择要执行的闹市卡";
            this.optionPanel.active = false;
        } else {
            const card = this.availableCards[this.selectedCardIndex];
            const options = card.action?.options || [];

            if (!card.auto && options.length > 1) {
                this.optionPanel.active = true;
                if (this.selectedOptionIndex === -1) {
                    this.hintLabel.string = "👇 请在下方选择一个具体的执行方式";
                } else {
                    const opt = options[this.selectedOptionIndex];
                    const check = this.canAfford(opt.cost);
                    if (check.ok) {
                        this.hintLabel.string = "✅ 确认执行此项操作吗？";
                        canConfirm = true;
                    } else {
                        this.hintLabel.string = `⚠️ ${check.reason}`;
                        canConfirm = false;
                    }
                }
            } else {
                this.optionPanel.active = false;
                const opt = options[0] || {};
                const check = this.canAfford(opt.cost);
                if (check.ok) {
                    this.hintLabel.string = "✅ 确认执行此卡牌效果吗？";
                    canConfirm = true;
                } else {
                    this.hintLabel.string = `⚠️ ${check.reason}`;
                    canConfirm = false;
                }
            }
        }

        this.btnConfirm.interactable = canConfirm;
    }

    public onBtnConfirmClicked() {
        this.btnConfirm.interactable = false;
        this.btnSkip.interactable = false;

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: {
                actionType: 'executeDowntownAction',
                payload: {
                    cardIndex: this.selectedCardIndex,
                    optionIndex: Math.max(0, this.selectedOptionIndex)
                }
            }
        });
    }

    public onBtnSkipClicked() {
        this.btnConfirm.interactable = false;
        this.btnSkip.interactable = false;

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: 'skip', payload: {} }
        });
    }
}