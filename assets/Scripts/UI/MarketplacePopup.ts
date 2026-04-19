import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

// 资源名称中文化映射
const RES_NAMES: any = {
    'lobsters': '龙虾', 'coins': '金币', 'seaweed': '海草',
    'cages': '虾笼', 'de': '德', 'wang': '望',
    'normal': '普虾', 'grade3': '三品虾', 'grade2': '二品虾', 'grade1': '一品虾', 'royal': '虾王'
};

@ccclass('MarketplacePopup')
export class MarketplacePopup extends Component {

    @property(Label) public resourceLabel: Label = null;
    @property(Label) public hintLabel: Label = null;

    @property(Node) public cardContainer: Node = null;
    @property(Node) public cardTemplate: Node = null;

    @property(Node) public optionPanel: Node = null;
    @property(Node) public optionContainer: Node = null;
    @property(Node) public optionTemplate: Node = null;

    @property(Button) public btnConfirm: Button = null;
    @property(Button) public btnSkip: Button = null;

    private rawData: any = null;
    private player: any = null;
    private availableCards: any[] = [];

    private selectedCardIndex: number = -1;
    private selectedOptionIndex: number = -1;

    private cardNodes: Node[] = [];
    private optionNodes: Node[] = [];

    public init(data: any) {
        this.rawData = data;
        this.player = data.player;
        this.availableCards = data.availableCards || [];
        this.node.active = true;

        this.selectedCardIndex = -1;
        this.selectedOptionIndex = -1;

        this.renderCards();
        this.refreshUI();
    }

    private renderCards() {
        this.cardNodes.forEach(n => n.destroy());
        this.cardNodes = [];

        for (let i = 0; i < this.availableCards.length; i++) {
            const card = this.availableCards[i];
            const node = instantiate(this.cardTemplate);
            node.active = true;
            this.cardContainer.addChild(node);

            const nameLabel = node.getChildByName('NameLabel')?.getComponent(Label);
            const descLabel = node.getChildByName('DescLabel')?.getComponent(Label);

            if (nameLabel) nameLabel.string = `【${card.name || "闹市卡"}】`;
            if (descLabel) descLabel.string = card.description || "";

            // 给整张卡牌绑定点击事件
            node.on(Button.EventType.CLICK, () => {
                this.selectedCardIndex = i;
                this.selectedOptionIndex = -1; // 切换卡牌时，清空子选项选中状态
                this.renderOptions();
                this.refreshUI();
            }, this);

            this.cardNodes.push(node);
        }
    }

    private renderOptions() {
        this.optionNodes.forEach(n => n.destroy());
        this.optionNodes = [];

        if (this.selectedCardIndex === -1) return;

        const card = this.availableCards[this.selectedCardIndex];
        const options = card.action?.options || [];

        // 如果是自动执行的卡，或者没有多个选项，就不渲染子选项面板
        if (card.auto || options.length <= 1) {
            return;
        }

        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const node = instantiate(this.optionTemplate);
            node.active = true;
            this.optionContainer.addChild(node);

            const label = node.getComponentInChildren(Label);
            if (label) label.string = this.formatOptionString(opt);

            node.on(Button.EventType.CLICK, () => {
                this.selectedOptionIndex = i;
                this.refreshUI();
            }, this);

            this.optionNodes.push(node);
        }
    }

    // 将 { cost: {coins: 2}, reward: {de: 1} } 格式化为直观的中文文本
    private formatOptionString(opt: any): string {
        const cost = opt.cost || {};
        const reward = opt.reward || {};

        let costStr = Object.keys(cost).map(k => `${RES_NAMES[k] || k}×${cost[k]}`).join(' , ');
        let rewStr = Object.keys(reward).map(k => `${RES_NAMES[k] || k}×${reward[k]}`).join(' , ');

        if (!costStr) costStr = "无";
        if (!rewStr) rewStr = "无";

        return `消耗 [ ${costStr} ]  ➡️  获得 [ ${rewStr} ]`;
    }

    private refreshUI() {
        this.resourceLabel.string = `拥有: 💰${this.player.coins} 🌿${this.player.seaweed} 🛒${this.player.cages} 🦞${this.player.lobsters.length} | 德:${this.player.de} 望:${this.player.wang}`;

        // 刷新主卡牌的高亮
        this.cardNodes.forEach((node, idx) => {
            const sprite = node.getComponent(Sprite);
            if (sprite) {
                sprite.color = (idx === this.selectedCardIndex) ? new Color(100, 200, 100) : new Color(220, 220, 220);
            }
        });

        // 刷新子选项的高亮
        this.optionNodes.forEach((node, idx) => {
            const sprite = node.getComponent(Sprite);
            if (sprite) {
                sprite.color = (idx === this.selectedOptionIndex) ? new Color(255, 200, 100) : new Color(220, 220, 220);
            }
        });

        let canConfirm = false;

        if (this.selectedCardIndex === -1) {
            this.hintLabel.string = "👈 请在上方选择要执行的闹市卡";
            this.optionPanel.active = false;
        } else {
            const card = this.availableCards[this.selectedCardIndex];
            const options = card.action?.options || [];

            // 需要手动选择的卡
            if (!card.auto && options.length > 1) {
                this.optionPanel.active = true;
                if (this.selectedOptionIndex === -1) {
                    this.hintLabel.string = "👇 请在下方选择一个具体的执行方式";
                } else {
                    this.hintLabel.string = "✅ 确认执行此项操作吗？";
                    canConfirm = true;
                }
            } else {
                // 自动执行的卡
                this.optionPanel.active = false;
                this.hintLabel.string = "✅ 确认执行此卡牌效果吗？";
                canConfirm = true;
            }
        }

        this.btnConfirm.interactable = canConfirm;
    }

    public onBtnConfirmClicked() {
        this.btnConfirm.interactable = false;
        this.btnSkip.interactable = false;

        // 【重中之重】：外面套一层 payload 防止 actionType 被覆盖！
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