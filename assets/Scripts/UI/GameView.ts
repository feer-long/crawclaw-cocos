import { _decorator, Component, Label, Node, Prefab, instantiate, Button } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { ActionSlotView } from './ActionSlotView';
const { ccclass, property } = _decorator;

@ccclass('GameView')
export class GameView extends Component {

    @property(Label) public roundLabel: Label = null;
    @property(Label) public phaseLabel: Label = null;
    @property(Label) public myNameLabel: Label = null;
    @property(Label) public coinsLabel: Label = null;
    @property(Label) public liZhangLabel: Label = null;
    @property(Label) public lobstersLabel: Label = null;
    @property(Prefab) public slotPrefab: Prefab = null;

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

    onLoad() {
        NetworkManager.instance.eventTarget.on('gameStateUpdate', this.onStateChanged, this);
        NetworkManager.instance.eventTarget.on('playerResourceUpdate', this.onStateChanged, this);
        NetworkManager.instance.eventTarget.on('serverGameAction', this.onStateChanged, this);
        NetworkManager.instance.eventTarget.on('error', this.onError, this);

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
    }

    private onError(data: any) {
        console.warn("⚠️ 操作被服务器拒绝:", data.message);
        this.phaseLabel.string = `⚠️ ${data.message}`;
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
            this.myNameLabel.string = `👤 玩家: ${me.name}`;
            this.coinsLabel.string = `💰 金币: ${me.coins}`;
            this.liZhangLabel.string = `👷 里长: ${me.liZhang}`;
            this.lobstersLabel.string = `🦞 龙虾: ${me.lobsters.length} 只`;
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
                this.phaseLabel.string = "工放阶段 (👉 已放置，可点击橙色格子撤回，或点结束回合)";
                if (nextBtnComp) nextBtnComp.interactable = true;
            } else {
                this.phaseLabel.string = "工放阶段 (👉 请放置里长)";
                if (nextBtnComp) nextBtnComp.interactable = false;
            }
        } else {
            this.phaseLabel.string = `(⏳ 等待 玩家 ${gameState.currentPlayerIndex} 行动...)`;
            if (nextBtnComp) nextBtnComp.interactable = false;
        }

        if (gameState.areas) {
            const effectiveLiZhang = hasPlacedThisTurn ? 0 : myLiZhang;

            this.renderArea(gameState.areas.shrimp_catching, this.areaShrimp, 'shrimp_catching', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn);
            this.renderArea(gameState.areas.seafood_market, this.areaMarket, 'seafood_market', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn);
            this.renderArea(gameState.areas.breeding, this.areaBreeding, 'breeding', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn);

            // =========================================================
            // 🌟 核心修复：上供区的两行映射联动，指定渲染哪些 index
            // =========================================================
            const tributeData = gameState.areas.tribute;
            if (tributeData) {
                // 第一行：挑战位 (映射后端数组的 3, 4, 5 号索引)
                // 因为它们都属于 'tribute' 区域，我们传入真实的区域名 'tribute'，后端就能精准识别
                this.renderArea(tributeData, this.areaTributeChallenge, 'tribute', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn, [3, 4, 5]);

                // 第二行：普通位 (映射后端数组的 0, 1, 2, 6, 7 号索引)
                this.renderArea(tributeData, this.areaTributeNormal, 'tribute', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn, [0, 1, 2, 6, 7]);
            }
            // =========================================================

            this.renderArea(gameState.areas.marketplace, this.areaDowntown, 'marketplace', players, isMyTurn, effectiveLiZhang, lastPlacement, hasPlacedThisTurn);
        }
    }

    // 【新增参数】：customIndices?: number[] 用于指定渲染后端数组的哪几个格子
    private renderArea(areaData: any, containerNode: Node, areaId: string, players: any[], isMyTurn: boolean, effectiveLiZhang: number, lastPlacement: any, hasPlacedThisTurn: boolean, customIndices?: number[]) {
        if (!areaData || !containerNode) return;
        containerNode.removeAllChildren();
        const slots = areaData.slots || [];

        const myLocalLastArea = cc.sys.localStorage.getItem('myLastPlacedArea');
        const myLocalLastSlot = parseInt(cc.sys.localStorage.getItem('myLastPlacedSlot') || '-1');

        // 如果传入了指定索引，就按指定索引画；否则按默认顺序 0,1,2,3... 画
        const indicesToRender = customIndices || Array.from({length: slots.length}, (_, i) => i);

        for (let idx of indicesToRender) {
            // 防御性保护：防止后端少发了数据导致数组越界
            if (idx >= slots.length) continue;

            const slotNode = instantiate(this.slotPrefab);
            containerNode.addChild(slotNode);
            const occupantId = slots[idx];

            // 使用真实的后端索引 idx 进行校验
            const isLastPlaced =
                (lastPlacement && Number(lastPlacement.playerId) === Number(this.localPlayerId) && lastPlacement.areaName === areaId && lastPlacement.slotIndex === idx) ||
                (occupantId == this.localPlayerId && hasPlacedThisTurn && myLocalLastArea === areaId && myLocalLastSlot === idx);

            const canCancel = isMyTurn && isLastPlaced;
            const canPlace = isMyTurn && effectiveLiZhang > 0 && occupantId === null;

            const slotView = slotNode.getComponent(ActionSlotView);
            if (slotView) {
                // 将真实的后端索引 idx 传给预制体
                slotView.init(areaId, idx, occupantId, players, canPlace, canCancel);
            }
        }
    }

    public onBtnNextPlayerClicked() {
        console.log("📤 点击结束回合按钮");
        NetworkManager.instance.send('clientGameAction', 'nextPlayer', { payload: {} });

        this.turnStartLiZhang = -1;
        const nextBtnComp = this.btnNextPlayer.getComponent(Button);
        if (nextBtnComp) nextBtnComp.interactable = false;
    }
}