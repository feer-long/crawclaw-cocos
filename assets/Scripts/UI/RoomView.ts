import { _decorator, Component, Label, Node, Button, director, Color, profiler, assetManager, sys } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { InviteManager } from '../WeChat/InviteManager';
const { ccclass, property } = _decorator;

@ccclass('RoomView')
export class RoomView extends Component {

    @property(Label)
    public titleLabel: Label = null;

    // 【重点语法】：用数组绑定多个同类节点，方便用 for 循环遍历
    @property([Label])
    public playerNames: Label[] = [];

    @property([Label])
    public playerReadyStatus: Label[] = [];

    @property(Node)
    public btnReady: Node = null;

    @property(Node)
    public btnStartGame: Node = null;

    @property([Node])
    public inviteCircles: Node[] = [];

    private localPlayerId: number = -1;
    private isHost: boolean = false;
    private isReady: boolean = false;

    onLoad() {
        profiler.hideStats();
        // 监听 Python 服务器的事件
        NetworkManager.instance.eventTarget.on('roomStateUpdate', this.onRoomStateUpdate, this);
        NetworkManager.instance.eventTarget.on('gameStarted', this.onGameStarted, this);

        // 读取大厅传过来的初始数据
        const stateStr = sys.localStorage.getItem('initialRoomState');
        const pIdStr = sys.localStorage.getItem('localPlayerId');
        const roomId = sys.localStorage.getItem("currentRoomId");

        if (stateStr && pIdStr) {
            this.localPlayerId = parseInt(pIdStr);
            const gameState = JSON.parse(stateStr);
            this.refreshUI(gameState);
        }

        // 【关键修复：断开大厅，连接房间专属 WebSocket】
        if (roomId && pIdStr) {
            const roomWsUrl = `wss://crawclaw-257976-7-1318258869.sh.run.tcloudbase.com/ws/${roomId}/${pIdStr}`;
            console.log("正在切换到房间专属通信通道...", roomWsUrl);

            // NetworkManager 内部会自动 close 掉旧的大厅连接，建立新连接
            NetworkManager.instance.connect(roomWsUrl, () => {
                console.log("✅ 成功接入房间专属频道！现在可以发送准备指令了。");
            });
        }

        // 初始化邀请功能
        InviteManager.instance.init();
    }

    onDestroy() {
        NetworkManager.instance.eventTarget.off('roomStateUpdate', this.onRoomStateUpdate, this);
        NetworkManager.instance.eventTarget.off('gameStarted', this.onGameStarted, this);
        InviteManager.instance.destroy();
    }

    // 每次有玩家进出、准备时，服务器都会发这个事件
    private onRoomStateUpdate(data: any) {
        console.log("🔄 收到房间状态更新:", data);
        // data 可能包在 gameState 里面，也可能直接是 players 数组
        const gameState = data.gameState || data;
        this.refreshUI(gameState);
    }

    private refreshUI(gameState: any) {
        const roomId = sys.localStorage.getItem("currentRoomId");
        this.titleLabel.string = `房间号: ${roomId}`;

        const players = gameState.players || [];

        // 1. 判断自己是不是房主
        const me = players.find((p: any) => p.id === this.localPlayerId);
        if (me) {
            this.isHost = me.isHost;
            this.isReady = me.ready;
        }

        // 2. 刷新 4 个槽位的显示
        for (let i = 0; i < 4; i++) {
            if (i < players.length) {
                const p = players[i];
                let nameStr = p.name;
                if (p.isHost) nameStr += " 👑";
                if (p.id === this.localPlayerId) nameStr += " (我)";

                this.playerNames[i].string = nameStr;
                this.playerReadyStatus[i].string = p.ready ? "已准备" : "未准备";
                this.playerReadyStatus[i].color = p.ready ? new Color(0, 255, 0) : new Color(255, 0, 0);
                if (this.inviteCircles[i]) this.inviteCircles[i].active = false;
                const btn = this.playerReadyStatus[i].getComponent(Button);
                if (btn) btn.interactable = false;
            } else {
                this.playerNames[i].string = "";
                this.playerReadyStatus[i].string = "";
                if (i > 0) {
                    if (this.inviteCircles[i]) this.inviteCircles[i].active = true;
                } else {
                    if (this.inviteCircles[i]) this.inviteCircles[i].active = false;
                }
                const btn = this.playerReadyStatus[i].getComponent(Button);
                if (btn) btn.interactable = i > 0;
            }
        }

        // 3. 按钮权限控制：房主显示“开始游戏”，普通玩家显示“准备/取消准备”
        this.btnStartGame.active = this.isHost;
        this.btnReady.active = !this.isHost;

        if (!this.isHost) {
            this.btnReady.getComponentInChildren(Label).string = this.isReady ? "取消准备" : "准备";
        }
    }

    // 玩家点击准备按钮
    public onBtnReadyClicked() {
        this.isReady = !this.isReady;
        NetworkManager.instance.send('clientRoomAction', 'setReady', {
            ready: this.isReady
        });
    }

    // 房主点击开始游戏
    public onBtnStartGameClicked() {
        // 根据你的 Python 代码，发送 forceStart: true 就会强制触发 start_game
        NetworkManager.instance.send('clientRoomAction', 'setReady', {
            ready: true,
            forceStart: true
        });
    }

    public onEmptySlotClick(slotIndex: number): void {
        const roomId = sys.localStorage.getItem("currentRoomId");
        const playerName = sys.localStorage.getItem("playerName") || "玩家";
        InviteManager.instance.inviteFriend(roomId, playerName);
    }

    // 接收到游戏开始信号
    private onGameStarted(data: any) {
        console.log("🚀 游戏正式开始！收到初始游戏数据:", data);
        // 保存最新的游戏状态，准备传给 Game 场景
        sys.localStorage.setItem("currentGameState", JSON.stringify(data.gameState || data));

        // 我们下一步要建的 Game 场景
        // director.loadScene("Game");
        assetManager.loadBundle('remote_assets', (err, bundle) => {
            if (err) {
                console.error('加载远程包失败:', err);
                return;
            }
            bundle.loadScene('Game', (err, sceneAsset) => {
                if (err) return console.error('加载游戏场景失败:', err);
                director.runScene(sceneAsset);
            });
        });
    }
}