import { _decorator, Component, Label, Button, Node, Prefab, instantiate, Color, Sprite, ScrollView } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { ActionSlotView } from './ActionSlotView';
const { ccclass, property } = _decorator;

@ccclass('MarketPopup')
export class MarketPopup extends Component {

    @property(Label) public marketInfoLabel: Label = null;
    @property(Label) public actionCountLabel: Label = null;
    @property(Label) public playerResourceLabel: Label = null;
    @property(Label) public hireInfoLabel: Label = null;

    // 滑动屏相关
    @property(ScrollView) public mainScrollView: ScrollView = null;
    @property(Button) public btnSlideDoor: Button = null;

    @property(Node) public hireSlotContainer: Node = null;
    @property(Prefab) public slotPrefab: Prefab = null;

    // 左侧分类按钮
    @property(Node) public btnCatLobster: Node = null;
    @property(Node) public btnCatSeaweed: Node = null;
    @property(Node) public btnCatCage: Node = null;
    @property(Node) public btnCatBatch: Node = null;

    // 右侧动态操作面板
    @property(Label) public dynamicPriceLabel: Label = null;
    @property(Button) public btnDynamicBuy: Button = null;
    @property(Button) public btnDynamicSell: Button = null;

    @property(Button) public btnSkip: Button = null;
    @property([Node]) public lobsterIcons: Node[] = [];

    private actionCount: number = 0;
    private rawData: any = null;

    // 状态机：当前选中的分类
    private currentCategory: 'lobster' | 'seaweed' | 'cage' | 'batch' = 'lobster';
    private isShowingHire: boolean = false;

    public init(data: any) {
        this.rawData = data;
        this.actionCount = data.actionCount || 0;
        if (!this.node.active) {
            this.currentCategory = 'lobster';
            this.isShowingHire = false;
        }

        this.node.active = true;

        // 初始化滚动条到最左边（交易区）
        if (this.mainScrollView) {
            this.mainScrollView.scrollToLeft(0, false);
        }

        this.refreshMarketView();
        this.refreshHireView();
    }

    // ==========================================
    // 移门滑动逻辑
    // ==========================================
    public onBtnSlideDoorClicked() {
        if (!this.mainScrollView) return;

        this.isShowingHire = !this.isShowingHire;
        // 使用 0.3 秒的平滑动画滚动
        if (this.isShowingHire) {
            this.mainScrollView.scrollToRight(0.3, true);
            this.setBtnText(this.btnSlideDoor, "▶");
        } else {
            this.mainScrollView.scrollToLeft(0.3, true);
            this.setBtnText(this.btnSlideDoor, "◀");
        }
    }

    // ==========================================
    // 左侧分类点击逻辑
    // ==========================================
    public onSelectCatLobster() { this.currentCategory = 'lobster'; this.refreshMarketView(); }
    public onSelectCatSeaweed() { this.currentCategory = 'seaweed'; this.refreshMarketView(); }
    public onSelectCatCage() { this.currentCategory = 'cage'; this.refreshMarketView(); }
    public onSelectCatBatch() { this.currentCategory = 'batch'; this.refreshMarketView(); }

    private refreshMarketView() {
        if (!this.rawData || !this.rawData.prices) return;

        const prices = this.rawData.prices;
        const player = this.rawData.player;
        const marketLobsterCount = this.rawData.marketLobsterCount;

        this.actionCountLabel.string = `剩余操作次数：${this.actionCount}`;
        this.marketInfoLabel.string = `市场龙虾余量：${marketLobsterCount} / 8`;

        const hasMarketRule = player.permaBuffs && player.permaBuffs.includes('permaBuff_market_rule');
        if (hasMarketRule) {
            this.marketInfoLabel.string += '\n📌 市场规则：普通龙虾 ¥1/只 (不可卖出)';
        }

        this.playerResourceLabel.string = `拥有：💰${player.coins} 🌿${player.seaweed} 🛒${player.cages} 🦞${player.lobsters.length}`;

        // 刷新龙虾架UI
        for (let i = 0; i < 8; i++) {
            if (this.lobsterIcons[i]) {
                const hasLobster = i >= (8 - marketLobsterCount);
                this.lobsterIcons[i].active = hasLobster;
            }
        }

        // ==========================================
        // 动态刷新分类高亮与右侧操作台
        // ==========================================
        this.updateCategoryHighlight();

        const normalLobsters = player.lobsters.filter((l: any) => !l.grade || l.grade === 'normal');
        let buyText = "", sellText = "";
        let canBuy = false, canSell = false;

        if (this.currentCategory === 'lobster') {
            this.dynamicPriceLabel.string = `【幼型灵螯】\n当前物价：${prices.buyLobster}金`;
            buyText = `买入 (-${prices.buyLobster}金)`;
            sellText = `卖出 (+${prices.sellLobster}金)`;

            canBuy = (player.coins >= prices.buyLobster && marketLobsterCount > 0);
            canSell = (normalLobsters.length > 0 && marketLobsterCount < 8);
        }
        else if (this.currentCategory === 'seaweed') {
            this.dynamicPriceLabel.string = `【琅玕仙草】\n当前物价：1金`;
            buyText = `买入 (-1金)`;
            sellText = `卖出 (+1金)`;

            canBuy = (player.coins >= 1);
            canSell = (player.seaweed >= 1);
        }
        else if (this.currentCategory === 'cage') {
            this.dynamicPriceLabel.string = `【息壤灵鼎】\n当前物价：${prices.buyCage}金`;
            buyText = `买入 (-${prices.buyCage}金)`;
            sellText = `卖出 (+${prices.sellCage}金)`;

            canBuy = (player.coins >= prices.buyCage);
            canSell = (player.cages > 0);
        }
        else if (this.currentCategory === 'batch') {
            this.dynamicPriceLabel.string = `【墟市批发】\n捆绑价：3株仙草 = 4金`;
            buyText = `买3草 (-4金)`;
            sellText = `卖3草 (+4金)`;

            canBuy = (player.coins >= 4);
            canSell = (player.seaweed >= 3);
        }

        // 渲染右侧按钮
        this.setBtnText(this.btnDynamicBuy, buyText);
        this.setBtnText(this.btnDynamicSell, sellText);

        if (this.btnDynamicBuy) this.btnDynamicBuy.interactable = canBuy;
        if (this.btnDynamicSell) this.btnDynamicSell.interactable = canSell;

        if (this.btnSkip) this.btnSkip.interactable = true;
    }

    private updateCategoryHighlight() {
        const colorSelected = new Color(100, 200, 100); // 选中变绿
        const colorNormal = new Color(220, 220, 220); // 未选中灰白

        if (this.btnCatLobster?.getComponent(Sprite)) this.btnCatLobster.getComponent(Sprite).color = (this.currentCategory === 'lobster') ? colorSelected : colorNormal;
        if (this.btnCatSeaweed?.getComponent(Sprite)) this.btnCatSeaweed.getComponent(Sprite).color = (this.currentCategory === 'seaweed') ? colorSelected : colorNormal;
        if (this.btnCatCage?.getComponent(Sprite)) this.btnCatCage.getComponent(Sprite).color = (this.currentCategory === 'cage') ? colorSelected : colorNormal;
        if (this.btnCatBatch?.getComponent(Sprite)) this.btnCatBatch.getComponent(Sprite).color = (this.currentCategory === 'batch') ? colorSelected : colorNormal;
    }

    private refreshHireView() {
        if (!this.hireSlotContainer || !this.slotPrefab) return;
        this.hireSlotContainer.removeAllChildren();

        const player = this.rawData.player;
        const currentRound = this.rawData.currentRound || 1;
        const hireSlotsData = this.rawData.hireSlots || new Array(8).fill(null);

        const stateStr = cc.sys.localStorage.getItem('currentGameState');
        const playersData = stateStr ? JSON.parse(stateStr).players : [];

        const hiredCount = player.hiredLaborersBonus ? player.hiredLaborersBonus.length : 0;
        const canAfford = player.coins >= 6;
        const notMaxedOut = hiredCount < 2;

        if (this.hireInfoLabel) {
            const availableExtra = 2 - hiredCount;
            let extraStr = "";
            for (let i = 0; i < availableExtra; i++) extraStr += "👷 ";
            for (let i = 0; i < hiredCount; i++) extraStr += "✔️(已雇) ";
            this.hireInfoLabel.string = `1名寻山客需6枚山海贝币，最多雇佣2名`;
            this.hireInfoLabel.color = canAfford ? new Color(255, 255, 255) : new Color(200, 50, 50);
        }

        for (let i = 0; i < 8; i++) {
            const slotNode = instantiate(this.slotPrefab);
            this.hireSlotContainer.addChild(slotNode);
            const occupantId = hireSlotsData[i];

            let isRoundUnlocked = false;
            if (i === 0 || i === 1) isRoundUnlocked = currentRound >= 2;
            if (i === 2 || i === 3) isRoundUnlocked = currentRound >= 3;
            if (i >= 4) isRoundUnlocked = currentRound >= 4;

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

    // ==========================================
    // 右侧动态点击事件路由
    // ==========================================
    public onDynamicBuyClicked() {
        if (this.currentCategory === 'lobster') this.sendMarketAction('buy_lobster');
        else if (this.currentCategory === 'seaweed') this.sendMarketAction('buy_seaweed');
        else if (this.currentCategory === 'cage') this.sendMarketAction('buy_cage');
        else if (this.currentCategory === 'batch') this.sendMarketAction('buy_seaweed_3');
    }

    public onDynamicSellClicked() {
        if (this.currentCategory === 'lobster') this.sendMarketAction('sell_lobster');
        else if (this.currentCategory === 'seaweed') this.sendMarketAction('sell_seaweed');
        else if (this.currentCategory === 'cage') this.sendMarketAction('sell_cage');
        else if (this.currentCategory === 'batch') this.sendMarketAction('sell_seaweed_3');
    }

    private sendMarketAction(actionString: string) {
        if (this.btnDynamicBuy) this.btnDynamicBuy.interactable = false;
        if (this.btnDynamicSell) this.btnDynamicSell.interactable = false;
        if (this.btnSkip) this.btnSkip.interactable = false;

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: actionString, payload: {} }
        });
    }

    public onBtnSkip() { this.sendMarketAction('skip'); }
}