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
    @property(Node) public areaTribute: Node = null;
    @property(Node) public areaDowntown: Node = null;

    // 绑定“结束回合”按钮
    @property(Node)
    public btnNextPlayer: Node = null;

    private localPlayerId: number = -1;

    onLoad() {
        NetworkManager.instance.eventTarget.on('gameStateUpdate', this.onGameStateUpdate, this);
        NetworkManager.instance.eventTarget.on('playerResourceUpdate', this.onPlayerResourceUpdate, this);
        NetworkManager.instance.eventTarget.on('serverGameAction', this.onGameStateUpdate, this);

        // 【新增】：监听服务器的拒绝操作（比如玩家想在一回合放两个里长）
        NetworkManager.instance.eventTarget.on('error', this.onError, this);

        const pIdStr = cc.sys.localStorage.getItem('localPlayerId');
        if (pIdStr !== null) {
            this.localPlayerId = parseInt(pIdStr);
        }

        const stateStr = cc.sys.localStorage.getItem('currentGameState');
        if (stateStr) {
            this.refreshUI(JSON.parse(stateStr));
        }
    }

    onDestroy() {
        NetworkManager.instance.eventTarget.off('gameStateUpdate', this.onGameStateUpdate, this);
        NetworkManager.instance.eventTarget.off('playerResourceUpdate', this.onPlayerResourceUpdate, this);
        NetworkManager.instance.eventTarget.off('serverGameAction', this.onGameStateUpdate, this);
        NetworkManager.instance.eventTarget.off('error', this.onError, this);
    }

    private onError(data: any) {
        console.warn("⚠️ 操作被服务器拒绝:", data.message);
        // 把后端的报错直接显示在画面上，给玩家反馈
        this.phaseLabel.string = `⚠️ ${data.message}`;
    }

    private onPlayerResourceUpdate(data: any) {
        const stateStr = cc.sys.localStorage.getItem('currentGameState');
        let currentState = stateStr ? JSON.parse(stateStr) : {};
        if (currentState.players) {
            const targetPlayer = currentState.players.find((p: any) => p.id == data.playerId);
            if (targetPlayer) Object.assign(targetPlayer, data.resources || data);
            cc.sys.localStorage.setItem('currentGameState', JSON.stringify(currentState));
            this.refreshUI(currentState);
        }
    }

    private onGameStateUpdate(data: any) {
        const newData = data.gameState || data;
        const stateStr = cc.sys.localStorage.getItem('currentGameState');
        let currentState = stateStr ? JSON.parse(stateStr) : {};
        Object.assign(currentState, newData);
        cc.sys.localStorage.setItem('currentGameState', JSON.stringify(currentState));
        this.refreshUI(currentState);
    }

    private refreshUI(gameState: any) {
        if (!gameState) return;

        this.roundLabel.string = `🏁 第 ${gameState.currentRound || 1} 回合`;

        const players = gameState.players || [];
        const isMyTurn = (gameState.currentPlayerIndex == this.localPlayerId) && (gameState.phase === 'placement');

        // 永远保持按钮节点激活（显示在屏幕上）
        this.btnNextPlayer.active = true;
        // 获取按钮的核心组件
        const nextBtnComp = this.btnNextPlayer.getComponent(Button);

        // 【你的绝妙逻辑】：用 interactable 置灰控制
        if (isMyTurn) {
            this.phaseLabel.string = "工放阶段 (👉 轮到你了，放置后请结束回合)";
            // 轮到我，按钮高亮可点
            if (nextBtnComp) nextBtnComp.interactable = true;
        } else {
            this.phaseLabel.string = `(⏳ 等待 玩家 ${gameState.currentPlayerIndex} 行动...)`;
            // 没轮到我，按钮置灰不可点
            if (nextBtnComp) nextBtnComp.interactable = false;
        }

        const me = players.find((p: any) => p.id == this.localPlayerId);
        let myLiZhang = 0;
        if (me) {
            this.myNameLabel.string = `👤 玩家: ${me.name}`;
            this.coinsLabel.string = `💰 金币: ${me.coins}`;
            this.liZhangLabel.string = `👷 里长: ${me.liZhang}`;
            this.lobstersLabel.string = `🦞 龙虾: ${me.lobsters.length} 只`;
            myLiZhang = me.liZhang;
        }

        if (gameState.areas) {
            // 如果轮到我，就把我的里长数传给格子，允许放置
            const effectiveLiZhang = isMyTurn ? myLiZhang : 0;

            this.renderArea(gameState.areas.shrimp_catching, this.areaShrimp, 'shrimp_catching', players, isMyTurn, effectiveLiZhang);
            this.renderArea(gameState.areas.seafood_market, this.areaMarket, 'seafood_market', players, isMyTurn, effectiveLiZhang);
            this.renderArea(gameState.areas.breeding, this.areaBreeding, 'breeding', players, isMyTurn, effectiveLiZhang);
            this.renderArea(gameState.areas.tribute, this.areaTribute, 'tribute', players, isMyTurn, effectiveLiZhang);
            this.renderArea(gameState.areas.marketplace, this.areaDowntown, 'marketplace', players, isMyTurn, effectiveLiZhang);
        }
    }

    private renderArea(areaData: any, containerNode: Node, areaId: string, players: any[], isMyTurn: boolean, myLiZhang: number) {
        if (!areaData || !containerNode) return;
        containerNode.removeAllChildren();
        const slots = areaData.slots || [];
        for (let i = 0; i < slots.length; i++) {
            const slotNode = instantiate(this.slotPrefab);
            containerNode.addChild(slotNode);
            const occupantId = slots[i];
            const slotView = slotNode.getComponent(ActionSlotView);
            if (slotView) {
                slotView.init(areaId, i, occupantId, players, isMyTurn, myLiZhang);
            }
        }
    }

    public onBtnNextPlayerClicked() {
        console.log("📤 点击结束回合按钮");
        NetworkManager.instance.send('clientGameAction', 'nextPlayer', {
            payload: {}
        });

        // 点完之后立刻把按钮置灰，防止网络卡顿时的连点
        const nextBtnComp = this.btnNextPlayer.getComponent(Button);
        if (nextBtnComp) nextBtnComp.interactable = false;
    }
}