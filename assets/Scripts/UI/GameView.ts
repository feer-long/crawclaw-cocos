import { _decorator, Component, Label, Node, Prefab, instantiate, Button } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { ActionSlotView } from './ActionSlotView';
import { SettlementPopup } from './SettlementPopup';
import { MarketPopup } from './MarketPopup';
import { BreedingPopup } from './BreedingPopup';
import { MarketplacePopup } from './MarketplacePopup';
import { TributePopup } from './TributePopup';
const { ccclass, property } = _decorator;

@ccclass('GameView')
export class GameView extends Component {

    @property(Label) public roundLabel: Label = null;
    @property(Label) public phaseLabel: Label = null;
    @property(Label) public myNameLabel: Label = null;
    @property(Label) public coinsLabel: Label = null;
    @property(Label) public liZhangLabel: Label = null;
    @property(Label) public lobstersLabel: Label = null;
    @property(Label) public seaweedLabel: Label = null;
    @property(Label) public cagesLabel: Label = null;
    @property(Label) public tributeCardsLabel: Label = null;
    @property(Label) public buffsLabel: Label = null;

    @property(Prefab) public slotPrefab: Prefab = null;
    @property(Prefab) public popupPrefab: Prefab = null;
    @property(Prefab) public marketPopupPrefab: Prefab = null;
    @property(Prefab) public breedingPopupPrefab: Prefab = null;
    @property(Prefab) public marketplacePopupPrefab: Prefab = null;
    @property(Prefab) public tributePopupPrefab: Prefab = null;

    @property(Node) public areaShrimp: Node = null;
    @property(Node) public areaMarket: Node = null;
    @property(Node) public areaBreeding: Node = null;
    @property(Node) public areaTributeChallenge: Node = null;
    @property(Node) public areaTributeNormal: Node = null;
    @property(Node) public areaDowntown: Node = null;
    @property(Node) public btnNextPlayer: Node = null;


    private localPlayerId: number = -1;
    private currentTurnPlayerIndex: number = -1;
    private currentTurnPhase: string = "";
    private turnStartLiZhang: number = -1;
    private currentPopupNode: Node = null;


    onLoad() {
        NetworkManager.instance.eventTarget.on('gameStateUpdate', this.onStateChanged, this);
        NetworkManager.instance.eventTarget.on('playerResourceUpdate', this.onStateChanged, this);
        NetworkManager.instance.eventTarget.on('serverGameAction', this.onStateChanged, this);
        NetworkManager.instance.eventTarget.on('error', this.onError, this);
        NetworkManager.instance.eventTarget.on('areaSettlementStart', this.onAreaSettlementStart, this);
        NetworkManager.instance.eventTarget.on('areaWaitingUI', this.onAreaWaitingUI, this);
        NetworkManager.instance.eventTarget.on('settlementComplete', this.onSettlementComplete, this);

        const pIdStr = cc.sys.localStorage.getItem('localPlayerId');
        if (pIdStr !== null) {
            this.localPlayerId = parseInt(pIdStr);
        }
        this.onStateChanged();
    }

    onDestroy() {
        NetworkManager.instance.eventTarget.off('gameStateUpdate', this.onStateChanged, this);
        NetworkManager.instance.eventTarget.off('playerResourceUpdate', this.onStateChanged, this);
        NetworkManager.instance.eventTarget.off('serverGameAction', this.onStateChanged, this);
        NetworkManager.instance.eventTarget.off('error', this.onError, this);
        NetworkManager.instance.eventTarget.off('areaSettlementStart', this.onAreaSettlementStart, this);
        NetworkManager.instance.eventTarget.off('areaWaitingUI', this.onAreaWaitingUI, this);
        NetworkManager.instance.eventTarget.off('settlementComplete', this.onSettlementComplete, this);
    }

    private onError(data: any) {
        console.warn("⚠️ 操作被服务器拒绝:", data.message);
        this.phaseLabel.string = `⚠️ ${data.message}`;
    }

    private onAreaSettlementStart(data: any) {
        const areaNames: any = {
            'shrimp_catching': '捕虾区',
            'seafood_market': '海鲜市场',
            'breeding': '养蛊区',
            'tribute': '上供区',
            'marketplace': '闹市区'
        };
        this.phaseLabel.string = `结算阶段：正在结算 【${areaNames[data.areaType] || data.areaType}】...`;
    }

    private onAreaWaitingUI(data: any) {
        this.onStateChanged();
        const isForMe = (data.playerId == this.localPlayerId);
        const isDoneBroadcast = (data.step === 'done' && data.playerId === null);

        if (isForMe || isDoneBroadcast) {
            let targetPrefab = this.popupPrefab; // 默认
            if (data.areaType === 'seafood_market') targetPrefab = this.marketPopupPrefab;
            if (data.areaType === 'breeding') targetPrefab = this.breedingPopupPrefab;
            if (data.areaType === 'marketplace') targetPrefab = this.marketplacePopupPrefab;

            // 【新增】：指定上供区面板！
            if (data.areaType === 'tribute') targetPrefab = this.tributePopupPrefab;

            if (this.currentPopupNode && this.currentPopupNode.isValid) {
                const isMarket = this.currentPopupNode.getComponent('MarketPopup') !== null;
                const isBreeding = this.currentPopupNode.getComponent('BreedingPopup') !== null;
                const isMarketplace = this.currentPopupNode.getComponent('MarketplacePopup') !== null;
                // 【新增】：检查当前是不是上供面板
                const isTribute = this.currentPopupNode.getComponent('TributePopup') !== null;

                const needMarket = (data.areaType === 'seafood_market');
                const needBreeding = (data.areaType === 'breeding');
                const needMarketplace = (data.areaType === 'marketplace');
                const needTribute = (data.areaType === 'tribute');

                if (isMarket !== needMarket || isBreeding !== needBreeding || isMarketplace !== needMarketplace || isTribute !== needTribute) {
                    this.currentPopupNode.destroy();
                    this.currentPopupNode = null;
                }
            }

            if (targetPrefab) {
                if (!this.currentPopupNode || !this.currentPopupNode.isValid) {
                    if (data.step !== 'done') {
                        this.currentPopupNode = instantiate(targetPrefab);
                        this.node.addChild(this.currentPopupNode);
                    }
                }

                if (this.currentPopupNode && this.currentPopupNode.isValid) {
                    if (data.areaType === 'seafood_market') {
                        this.currentPopupNode.getComponent('MarketPopup')?.init(data);
                    } else if (data.areaType === 'breeding') {
                        this.currentPopupNode.getComponent('BreedingPopup')?.init(data);
                    } else if (data.areaType === 'marketplace') {
                        this.currentPopupNode.getComponent('MarketplacePopup')?.init(data);
                    } else if (data.areaType === 'tribute') {
                        // 【新增】：初始化上供面板
                        this.currentPopupNode.getComponent('TributePopup')?.init(data);
                    } else {
                        this.currentPopupNode.getComponent('SettlementPopup')?.init(data);
                    }
                }
            }
        }

        if (data.playerId !== null && data.playerId != this.localPlayerId) {
            this.phaseLabel.string = `结算阶段：等待 玩家 ${data.playerId} 操作...`;
            if (this.currentPopupNode && this.currentPopupNode.isValid) {
                this.currentPopupNode.destroy();
                this.currentPopupNode = null;
            }
        }
    }

    private onSettlementComplete(data: any) {
        this.phaseLabel.string = "本回合结算完成，准备进入下一回合！";
        if (this.currentPopupNode && this.currentPopupNode.isValid) {
            this.currentPopupNode.destroy();
            this.currentPopupNode = null;
        }
        this.onStateChanged();
    }

    private onStateChanged() {
        const stateStr = cc.sys.localStorage.getItem('currentGameState');
        if (stateStr) {
            this.refreshUI(JSON.parse(stateStr));
        }
    }

    private refreshUI(gameState: any) {
        if (!gameState) return;
        this.roundLabel.string = `🏁 第 ${gameState.currentRound || 1} 回合`;

        const players = gameState.players || [];
        const isMyTurn = (gameState.currentPlayerIndex == this.localPlayerId) && (gameState.phase === 'placement');

        const me = players.find((p: any) => p.id == this.localPlayerId);
        let myLiZhang = 0;
        if (me) {
            myLiZhang = me.liZhang;
            this.myNameLabel.string = `👤 玩家：${me.name}`;
            this.coinsLabel.string = `💰 金币：${me.coins}`;
            this.liZhangLabel.string = `👷 里长：${me.liZhang}`;
            this.lobstersLabel.string = `🦞 龙虾：${me.lobsters.length} 只`;
            if (this.seaweedLabel) this.seaweedLabel.string = `🌿 海草：${me.seaweed || 0}`;
            if (this.cagesLabel) this.cagesLabel.string = `🛒 虾笼：${me.cages || 0}`;
            
            // ========== 新增：上供卡列表 ==========
            if (this.tributeCardsLabel) {
                const cards = me.tributeCards || [];
                if (cards.length > 0) {
                    const names = cards.map((c: any) => c.name).join(' | ');
                    this.tributeCardsLabel.string = `📜 上供卡：${names}`;
                    this.tributeCardsLabel.node.active = true;
                } else {
                    this.tributeCardsLabel.string = '📜 上供卡：无';
                    this.tributeCardsLabel.node.active = true;
                }
            }
            
            // ========== 新增：光环列表 ==========
            if (this.buffsLabel) {
                const buffs = me.permaBuffs || [];
                if (buffs.length > 0) {
                    this.buffsLabel.string = '✨ 生效中';
                    this.buffsLabel.node.active = true;
                } else {
                    this.buffsLabel.string = '✨ 无';
                    this.buffsLabel.node.active = true;
                }
            }
        }

        if (gameState.currentPlayerIndex !== this.currentTurnPlayerIndex || gameState.phase !== this.currentTurnPhase) {
            this.currentTurnPlayerIndex = gameState.currentPlayerIndex;
            this.currentTurnPhase = gameState.phase;
            if (isMyTurn) {
                this.turnStartLiZhang = myLiZhang;
            } else {
                this.turnStartLiZhang = -1;
            }
            cc.sys.localStorage.removeItem('myLastPlacedArea');
            cc.sys.localStorage.removeItem('myLastPlacedSlot');
        }

        let hasPlacedThisTurn = false;
        const lastPlacement = gameState.lastPlacement;

        if (lastPlacement && Number(lastPlacement.playerId) === Number(this.localPlayerId)) {
            hasPlacedThisTurn = true;
        } else if (isMyTurn && this.turnStartLiZhang !== -1 && myLiZhang < this.turnStartLiZhang) {
            hasPlacedThisTurn = true;
        }

        this.btnNextPlayer.active = true;
        const nextBtnComp = this.btnNextPlayer.getComponent(Button);

        if (isMyTurn) {
            if (hasPlacedThisTurn) {
                this.phaseLabel.string = "工放阶段 (👉 已放置，可撤回，或点下一阶段)";
                if (nextBtnComp) nextBtnComp.interactable = true;
            } else {
                this.phaseLabel.string = "工放阶段 (👉 请放置里长)";
                if (nextBtnComp) nextBtnComp.interactable = false;
            }
        } else if (gameState.phase === 'placement') {
            this.phaseLabel.string = `(⏳ 等待 玩家 ${gameState.currentPlayerIndex} 行动...)`;
            if (nextBtnComp) nextBtnComp.interactable = false;
        }

        if (gameState.areas) {
            const effectiveLiZhang = hasPlacedThisTurn ? 0 : myLiZhang;
            this.renderArea(gameState.areas.shrimp_catching, this.areaShrimp, 'shrimp_catching', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn);
            this.renderArea(gameState.areas.seafood_market, this.areaMarket, 'seafood_market', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn);
            this.renderArea(gameState.areas.breeding, this.areaBreeding, 'breeding', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn);
            const tributeData = gameState.areas.tribute;
            if (tributeData) {
                this.renderArea(tributeData, this.areaTributeChallenge, 'tribute', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn, [3, 4, 5]);
                this.renderArea(tributeData, this.areaTributeNormal, 'tribute', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn, [0, 1, 2, 6, 7]);
            }
            this.renderArea(gameState.areas.marketplace, this.areaDowntown, 'marketplace', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn);
        }
    }

    private renderArea(areaData: any, containerNode: Node, areaId: string, players: any[], isMyTurn: boolean, effectiveLiZhang: number, lastPlacement: any, hasPlacedThisTurn: boolean, customIndices?: number[]) {
        if (!areaData || !containerNode) return;
        containerNode.removeAllChildren();
        const slots = areaData.slots || [];
        const myLocalLastArea = cc.sys.localStorage.getItem('myLastPlacedArea');
        const myLocalLastSlot = parseInt(cc.sys.localStorage.getItem('myLastPlacedSlot') || '-1');
        const indicesToRender = customIndices || Array.from({length: slots.length}, (_, i) => i);

        for (let idx of indicesToRender) {
            if (idx >= slots.length) continue;
            const slotNode = instantiate(this.slotPrefab);
            containerNode.addChild(slotNode);
            const occupantId = slots[idx];
            const isLastPlaced = (lastPlacement && Number(lastPlacement.playerId) === Number(this.localPlayerId) && lastPlacement.areaName === areaId && lastPlacement.slotIndex === idx) ||
                (occupantId == this.localPlayerId && hasPlacedThisTurn && myLocalLastArea === areaId && myLocalLastSlot === idx);
            const canCancel = isMyTurn && isLastPlaced;
            const canPlace = isMyTurn && effectiveLiZhang > 0 && occupantId === null;
            const slotView = slotNode.getComponent(ActionSlotView);
            if (slotView) slotView.init(areaId, idx, occupantId, players, canPlace, canCancel);
        }
    }

    public onBtnNextPlayerClicked() {
        NetworkManager.instance.send('clientGameAction', 'nextPlayer', { payload: {} });
        this.turnStartLiZhang = -1;
        const nextBtnComp = this.btnNextPlayer.getComponent(Button);
        if (nextBtnComp) nextBtnComp.interactable = false;
    }
}