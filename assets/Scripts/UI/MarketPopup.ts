import { _decorator, Component, Label, Button, Node, Prefab, instantiate, Color, Sprite } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { ActionSlotView } from './ActionSlotView';
const { ccclass, property } = _decorator;

@ccclass('MarketPopup')
export class MarketPopup extends Component {

    @property(Label) public marketInfoLabel: Label = null;
    @property(Label) public currentPriceLabel: Label = null;
    @property(Label) public actionCountLabel: Label = null;
    @property(Label) public playerResourceLabel: Label = null;

    // 【新增】：刚才在编辑器里建好的用来展示额外里长的小文本
    @property(Label) public hireInfoLabel: Label = null;

    @property(Node) public btnTabMarket: Node = null;
    @property(Node) public btnTabHire: Node = null;
    @property(Node) public viewMarket: Node = null;
    @property(Node) public viewHire: Node = null;

    @property(Node) public hireSlotContainer: Node = null;
    @property(Prefab) public slotPrefab: Prefab = null;

    @property(Button) public btnBuyLobster: Button = null;
    @property(Button) public btnSellLobster: Button = null;
    @property(Button) public btnBuyCage: Button = null;
    @property(Button) public btnSellCage: Button = null;
    @property(Button) public btnBuySeaweed: Button = null;
    @property(Button) public btnSellSeaweed: Button = null;
    @property(Button) public btnBuySeaweed3: Button = null;
    @property(Button) public btnSellSeaweed3: Button = null;
    @property(Button) public btnSkip: Button = null;

    @property([Node]) public lobsterIcons: Node[] = [];

    private actionCount: number = 0;
    private rawData: any = null;

    public init(data: any) {
        this.rawData = data;
        this.actionCount = data.actionCount || 0;

        this.node.active = true;
        this.refreshMarketView();
        this.refreshHireView();

        if (!this.viewMarket.active && !this.viewHire.active) {
            this.showTab('market');
        }
    }

    public onBtnTabMarketClicked() { this.showTab('market'); }
    public onBtnTabHireClicked() { this.showTab('hire'); }

    private showTab(tabName: string) {
        const colorSelected = new Color(200, 200, 200);
        const colorNormal = new Color(255, 255, 255);

        if (tabName === 'market') {
            this.viewMarket.active = true;
            this.viewHire.active = false;
            if (this.btnTabMarket?.getComponent(Sprite)) this.btnTabMarket.getComponent(Sprite).color = colorSelected;
            if (this.btnTabHire?.getComponent(Sprite)) this.btnTabHire.getComponent(Sprite).color = colorNormal;
        } else {
            this.viewMarket.active = false;
            this.viewHire.active = true;
            if (this.btnTabHire?.getComponent(Sprite)) this.btnTabHire.getComponent(Sprite).color = colorSelected;
            if (this.btnTabMarket?.getComponent(Sprite)) this.btnTabMarket.getComponent(Sprite).color = colorNormal;
        }
    }

    private refreshMarketView() {
        const prices = this.rawData.prices;
        const player = this.rawData.player;
        const marketLobsterCount = this.rawData.marketLobsterCount;

        this.actionCountLabel.string = `剩余操作次数：${this.actionCount}`;
        this.marketInfoLabel.string = `市场龙虾余量：${marketLobsterCount} / 8`;
        this.playerResourceLabel.string = `拥有: 💰${player.coins} 🌿${player.seaweed} 🛒${player.cages} 🦞${player.lobsters.length}`;

        if (this.currentPriceLabel) {
            this.currentPriceLabel.string = `当前流通物价：龙虾 ${prices.buyLobster}金 | 虾笼 ${prices.buyCage}金 | 1草 1金 | 3草 4金`;
        }

        this.setBtnText(this.btnBuyLobster, `买入龙虾 (-${prices.buyLobster}金)`);
        this.setBtnText(this.btnSellLobster, `卖出龙虾 (+${prices.sellLobster}金)`);
        this.setBtnText(this.btnBuyCage, `买入虾笼 (-${prices.buyCage}金)`);
        this.setBtnText(this.btnSellCage, `卖出虾笼 (+${prices.sellCage}金)`);
        this.setBtnText(this.btnBuySeaweed, `买1草 (-1金)`);
        this.setBtnText(this.btnSellSeaweed, `卖1草 (+1金)`);
        this.setBtnText(this.btnBuySeaweed3, `买3草 (-4金)`);
        this.setBtnText(this.btnSellSeaweed3, `卖3草 (+4金)`);

        if (this.btnBuyLobster) this.btnBuyLobster.interactable = (player.coins >= prices.buyLobster && marketLobsterCount > 0);
        if (this.btnSellLobster) this.btnSellLobster.interactable = (player.lobsters.length > 0);
        if (this.btnBuyCage) this.btnBuyCage.interactable = (player.coins >= prices.buyCage);
        if (this.btnSellCage) this.btnSellCage.interactable = (player.cages > 0);
        if (this.btnBuySeaweed) this.btnBuySeaweed.interactable = (player.coins >= 1);
        if (this.btnSellSeaweed) this.btnSellSeaweed.interactable = (player.seaweed >= 1);
        if (this.btnBuySeaweed3) this.btnBuySeaweed3.interactable = (player.coins >= 4);
        if (this.btnSellSeaweed3) this.btnSellSeaweed3.interactable = (player.seaweed >= 3);
        if (this.btnSkip) this.btnSkip.interactable = true;

        for (let i = 0; i < 8; i++) {
            if (this.lobsterIcons[i]) {
                const hasLobster = i >= (8 - marketLobsterCount);
                this.lobsterIcons[i].active = hasLobster;
            }
        }
    }

    private refreshHireView() {
        if (!this.hireSlotContainer || !this.slotPrefab) return;
        this.hireSlotContainer.removeAllChildren();

        const player = this.rawData.player;

        // 【防错核心】：所有判定数据直接从服务器最新的包里面拿，绝对不再从 localStorage 读导致延迟！
        const currentRound = this.rawData.currentRound || 1;
        const hireSlotsData = this.rawData.hireSlots || new Array(8).fill(null);
        const stateStr = cc.sys.localStorage.getItem('currentGameState');
        const playersData = stateStr ? JSON.parse(stateStr).players : [];

        const hiredCount = player.hiredLaborersBonus ? player.hiredLaborersBonus.length : 0;
        const canAfford = player.coins >= 6;
        const notMaxedOut = hiredCount < 2;

        // 【新增】：直观展示玩家的市场里的2个额外里长
        if (this.hireInfoLabel) {
            const availableExtra = 2 - hiredCount;
            let extraStr = "";
            for(let i=0; i<availableExtra; i++) extraStr += "👷 ";
            for(let i=0; i<hiredCount; i++) extraStr += "✔️(已雇) ";
            this.hireInfoLabel.string = `我的待雇佣市场里长: ${extraStr}\n(占槽位每次需 6 金币)`;
            this.hireInfoLabel.color = canAfford ? new Color(0, 120, 0) : new Color(200, 50, 50); // 钱够绿色，钱不够红色警告
        }

        for (let i = 0; i < 8; i++) {
            const slotNode = instantiate(this.slotPrefab);
            this.hireSlotContainer.addChild(slotNode);
            const occupantId = hireSlotsData[i];

            let isRoundUnlocked = false;
            if (i === 0 || i === 1) isRoundUnlocked = currentRound >= 2;
            if (i === 2 || i === 3) isRoundUnlocked = currentRound >= 3;
            if (i >= 4) isRoundUnlocked = currentRound >= 4;

            // 【精准拦截分析】：查出为什么点不动
            let canPlace = false;
            let failReason = "";

            if (this.actionCount <= 0) failReason = "没有剩余交易次数了";
            else if (occupantId !== null) failReason = "该槽位已被占领";
            else if (!isRoundUnlocked) failReason = `当前是第${currentRound}回合，该槽位尚未开放`;
            else if (!notMaxedOut) failReason = "你已经雇佣了全部2个额外里长";
            else if (!canAfford) failReason = "金币不足(需要 6 金币)";
            else canPlace = true;

            const slotView = slotNode.getComponent(ActionSlotView);
            if (slotView) {
                // 将拦截原因发给预制体，点击时会打印
                slotView.init('hire_headman', i, occupantId, playersData, canPlace, false, failReason);
            }
        }
    }

    private setBtnText(btn: Button, text: string) {
        if (btn && btn.node) {
            const label = btn.node.getComponentInChildren(Label);
            if (label) label.string = text;
        }
    }

    private sendMarketAction(actionString: string) {
        if (this.btnBuyLobster) this.btnBuyLobster.interactable = false;
        if (this.btnSellLobster) this.btnSellLobster.interactable = false;
        if (this.btnBuySeaweed) this.btnBuySeaweed.interactable = false;
        if (this.btnSellSeaweed) this.btnSellSeaweed.interactable = false;
        if (this.btnBuySeaweed3) this.btnBuySeaweed3.interactable = false;
        if (this.btnSellSeaweed3) this.btnSellSeaweed3.interactable = false;
        if (this.btnBuyCage) this.btnBuyCage.interactable = false;
        if (this.btnSellCage) this.btnSellCage.interactable = false;
        if (this.btnSkip) this.btnSkip.interactable = false;

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: actionString, payload: {} }
        });
    }

    public onBtnBuyLobster() { this.sendMarketAction('buy_lobster'); }
    public onBtnSellLobster() { this.sendMarketAction('sell_lobster'); }
    public onBtnBuyCage() { this.sendMarketAction('buy_cage'); }
    public onBtnSellCage() { this.sendMarketAction('sell_cage'); }
    public onBtnBuySeaweed() { this.sendMarketAction('buy_seaweed'); }
    public onBtnSellSeaweed() { this.sendMarketAction('sell_seaweed'); }
    public onBtnBuySeaweed3() { this.sendMarketAction('buy_seaweed_3'); }
    public onBtnSellSeaweed3() { this.sendMarketAction('sell_seaweed_3'); }
    public onBtnSkip() { this.sendMarketAction('skip'); }
}