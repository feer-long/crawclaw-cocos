import { _decorator, Component, Label, Node, Button, director, Color, profiler, assetManager, sys, isValid } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { InviteManager } from '../WeChat/InviteManager';
import { Config } from '../Config';
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

    @property([Node])
    public kickButtons: Node[] = [];

    @property([Node])
    public addAiButtons: Node[] = [];

    @property(Node)
    public btnLeaveRoom: Node = null;

    private localPlayerId: number = -1;
    private isHost: boolean = false;
    private isReady: boolean = false;
    private localPlayerSlotIndex: number = -1;
    private isConnected: boolean = true;
    private lastGameState: any = null;

    onLoad() {
        profiler.hideStats();
        // 监听 Python 服务器的事件
        NetworkManager.instance.eventTarget.on('roomStateUpdate', this.onRoomStateUpdate, this);
        NetworkManager.instance.eventTarget.on('gameStarted', this.onGameStarted, this);
        NetworkManager.instance.eventTarget.on('disconnect', this.onDisconnect, this);
        NetworkManager.instance.eventTarget.on('reconnected', this.onReconnected, this);
        NetworkManager.instance.eventTarget.on('playerKicked', this.onPlayerKicked, this);
        NetworkManager.instance.eventTarget.on('playerLeft', this.onPlayerLeft, this);
        NetworkManager.instance.eventTarget.on('error', this.onRoomError, this);
        NetworkManager.instance.eventTarget.on('aiAdded', this.onAiAdded, this);
        NetworkManager.instance.eventTarget.on('aiKicked', this.onAiKicked, this);

        // 读取大厅传过来的初始数据
        const stateStr = sys.localStorage.getItem('initialRoomState');
        const pIdStr = sys.localStorage.getItem('localPlayerId');
        const roomId = sys.localStorage.getItem("currentRoomId");

        if (stateStr && pIdStr) {
            const gameState = JSON.parse(stateStr);

            // 用 userId 交叉验证 localPlayerId，防止脏数据导致身份错误
            const localUserId = sys.localStorage.getItem("userId");
            if (localUserId && gameState.players) {
                const meByUserId = gameState.players.find((p: any) => p.userId === localUserId);
                if (meByUserId) {
                    // userId 匹配到房间中的玩家，信任服务端分配的 playerId
                    this.localPlayerId = parseInt(pIdStr);
                    sys.localStorage.setItem("localPlayerId", this.localPlayerId.toString());
                    this.isHost = meByUserId.isHost;
                    this.isReady = meByUserId.ready;
                } else {
                    // userId 不匹配任何玩家 → 信任服务器分配的 playerId 作为后备
                    console.warn(`⚠️ onLoad: userId=${localUserId} 不在房间玩家列表中，使用服务器分配的 playerId`);
                    this.localPlayerId = parseInt(pIdStr);
                }
            } else {
                this.localPlayerId = parseInt(pIdStr);
            }
            this.refreshUI(gameState);
        }

        // 【关键修复：断开大厅，连接房间专属 WebSocket】
        // 只有 userId 匹配到房间玩家时才连接游戏 WS
        if (roomId && this.localPlayerId !== -1) {
            const roomWsUrl = `${Config.WS_ROOM_URL}/${roomId}/${this.localPlayerId}`;
            console.log("正在切换到房间专属通信通道...", roomWsUrl);

            // NetworkManager 内部会自动 close 掉旧的大厅连接，建立新连接
            NetworkManager.instance.connect(roomWsUrl, () => {
                console.log("✅ 成功接入房间专属频道！现在可以发送准备指令了。");
                if (this.lastGameState) {
                    this.refreshUI(this.lastGameState);
                }
            });
        }

        // 初始化邀请功能
        InviteManager.instance.init();

        // 设置踢出按钮点击监听（不依赖 Editor ClickEvents）
        for (let i = 0; i < this.kickButtons.length; i++) {
            const btnNode = this.kickButtons[i];
            if (!isValid(btnNode)) continue;
            const btn = btnNode.getComponent(Button);
            if (!btn) continue;
            btn.node.on(Button.EventType.CLICK, this._kickBtnClickHandler, this);
        }

        // 设置添加AI按钮点击监听
        for (let i = 0; i < this.addAiButtons.length; i++) {
            const btnNode = this.addAiButtons[i];
            if (!isValid(btnNode)) continue;
            const btn = btnNode.getComponent(Button);
            if (!btn) continue;
            btn.node.on(Button.EventType.CLICK, this._addAiBtnClickHandler, this);
        }
    }

    onDestroy() {
        NetworkManager.instance.eventTarget.off('roomStateUpdate', this.onRoomStateUpdate, this);
        NetworkManager.instance.eventTarget.off('gameStarted', this.onGameStarted, this);
        NetworkManager.instance.eventTarget.off('disconnect', this.onDisconnect, this);
        NetworkManager.instance.eventTarget.off('reconnected', this.onReconnected, this);
        NetworkManager.instance.eventTarget.off('playerKicked', this.onPlayerKicked, this);
        NetworkManager.instance.eventTarget.off('playerLeft', this.onPlayerLeft, this);
        NetworkManager.instance.eventTarget.off('error', this.onRoomError, this);
        NetworkManager.instance.eventTarget.off('aiAdded', this.onAiAdded, this);
        NetworkManager.instance.eventTarget.off('aiKicked', this.onAiKicked, this);

        // 清理踢出按钮监听
        for (let i = 0; i < this.kickButtons.length; i++) {
            const btnNode = this.kickButtons[i];
            if (!isValid(btnNode)) continue;
            const btn = btnNode.getComponent(Button);
            if (!btn) continue;
            btn.node.off(Button.EventType.CLICK, this._kickBtnClickHandler, this);
        }

        // 清理添加AI按钮监听
        for (let i = 0; i < this.addAiButtons.length; i++) {
            const btnNode = this.addAiButtons[i];
            if (!isValid(btnNode)) continue;
            const btn = btnNode.getComponent(Button);
            if (!btn) continue;
            btn.node.off(Button.EventType.CLICK, this._addAiBtnClickHandler, this);
        }

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
        this.lastGameState = gameState;
        const roomId = sys.localStorage.getItem("currentRoomId");
        this.titleLabel.string = `房间号: ${roomId}`;

        const players = gameState.players || [];

        // 1. 用 userId 交叉验证身份（唯一可信标识）
        const localUserId = sys.localStorage.getItem("userId");
        const meByUserId = localUserId ? players.find((p: any) => p.userId === localUserId) : null;

        if (meByUserId) {
            // userId 匹配到房间中的玩家，只更新状态不覆盖 localPlayerId
            this.isHost = meByUserId.isHost;
            this.isReady = meByUserId.ready;
        } else {
            // userId 不匹配 → 保留已有 localPlayerId，等待后续 roomStateUpdate 修正
            this.isHost = false;
            this.isReady = false;
        }

        // 2. 先隐藏所有添加AI按钮
        for (let j = 0; j < this.addAiButtons.length; j++) {
            if (this.addAiButtons[j]) this.addAiButtons[j].active = false;
        }

        // 3. 按玩家 ID 刷新每个槽位，在每个分支显式设置所有按钮状态
        for (let i = 0; i < 4; i++) {
            const p = players.find((pp: any) => Number(pp.id) === i);
            if (p) {
                const isAI = !!p.isAI;
                let nameStr = p.name;
                const isMe = (Number(p.id) === Number(this.localPlayerId) || p.userId === localUserId) && this.localPlayerId !== -1;
                if (isMe) {
                    nameStr += " (我)";
                    this.localPlayerSlotIndex = Number(p.id);
                }

                this.playerNames[i].string = nameStr;
                if (isAI) {
                    this.playerReadyStatus[i].string = "🤖 AI";
                    this.playerReadyStatus[i].color = new Color(100, 200, 255);
                } else if (p.isHost) {
                    this.playerReadyStatus[i].string = p.isOnline === false ? "离线" : "👑";
                    this.playerReadyStatus[i].color = p.isOnline === false ? new Color(128, 128, 128) : new Color(255, 255, 0);
                } else {
                    this.playerReadyStatus[i].string = p.isOnline === false ? "离线" : (p.ready ? "已准备" : "未准备");
                    this.playerReadyStatus[i].color = p.isOnline === false ? new Color(128, 128, 128) : (p.ready ? new Color(0, 255, 0) : new Color(255, 0, 0));
                }
                const btn = this.playerReadyStatus[i].getComponent(Button);
                if (btn) btn.interactable = false;

                // 有玩家：始终隐藏邀请按钮
                if (this.inviteCircles[i]) this.inviteCircles[i].active = false;

                // 踢人按钮：仅房主可见，不能踢自己
                if (this.kickButtons[i]) {
                    this.kickButtons[i].active = this.isHost && Number(p.id) !== Number(this.localPlayerId);
                }
            } else {
                this.playerNames[i].string = "";
                this.playerReadyStatus[i].string = "";

                // 空槽位：显示邀请图标
                if (this.inviteCircles[i]) this.inviteCircles[i].active = true;

                // 空槽位：没有可踢的玩家
                if (this.kickButtons[i]) this.kickButtons[i].active = false;

                // 添加AI按钮：仅房主可见
                if (this.addAiButtons[i]) this.addAiButtons[i].active = this.isHost;
            }
        }

        // 4. 按钮权限控制：房主显示"开始游戏"，普通玩家显示"准备/取消准备"
        this.btnStartGame.active = this.isHost;
        this.btnReady.active = !this.isHost;
        this.btnLeaveRoom.active = this.localPlayerId !== -1;

        // 5. 非房主在线玩家全部准备后，开始游戏按钮才可点击
        if (this.isHost) {
            const allOthersReady = players
                .filter((p: any) => !p.isHost && p.isOnline !== false)
                .every((p: any) => p.ready === true);
            const startBtn = this.btnStartGame.getComponent(Button);
            if (startBtn) {
                startBtn.interactable = allOthersReady;
            }
        }

        if (!this.isHost) {
            this.btnReady.getComponentInChildren(Label).string = this.isReady ? "取消准备" : "准备";
        }
    }

    private onDisconnect() {
        console.log("🔌 WebSocket 断开，显示离线状态");
        this.isConnected = false;
        this.isReady = false;
        this.btnReady.active = false;
        this.btnStartGame.active = false;

        if (this.localPlayerSlotIndex >= 0) {
            this.playerReadyStatus[this.localPlayerSlotIndex].string = "离线";
            this.playerReadyStatus[this.localPlayerSlotIndex].color = new Color(128, 128, 128);
        } else {
            for (let i = 0; i < 4; i++) {
                this.playerReadyStatus[i].string = "离线";
                this.playerReadyStatus[i].color = new Color(128, 128, 128);
            }
        }
    }

    private onReconnected() {
        console.log(`🔗 WebSocket 重连成功, localPlayerId=${this.localPlayerId}`);
        this.isConnected = true;
        if (this.lastGameState) {
            this.refreshUI(this.lastGameState);
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
        NetworkManager.instance.send('clientRoomAction', 'startGame', {});
    }

    public onEmptySlotClick(slotIndex: number): void {
        const roomId = sys.localStorage.getItem("currentRoomId");
        const playerName = sys.localStorage.getItem("playerName") || "玩家";
        InviteManager.instance.inviteFriend(roomId, playerName);
    }

    // 踢出按钮点击处理（不使用 Editor ClickEvents，通过按钮数组索引确定槽位）
    private _kickBtnClickHandler(btnComp: Button) {
        const slotIndex = this.kickButtons.indexOf(btnComp.node);
        if (slotIndex === -1) return;

        const players = this.lastGameState?.players || [];
        const p = players.find((pp: any) => Number(pp.id) === slotIndex);
        if (!p) {
            console.warn(`没有玩家在槽位 ${slotIndex}`);
            return;
        }

        if (p.isAI) {
            NetworkManager.instance.send('clientRoomAction', 'kickAI', {
                targetPlayerId: Number(p.id)
            });
        } else {
            NetworkManager.instance.send('clientRoomAction', 'kickPlayer', {
                targetPlayerId: Number(p.id)
            });
        }
    }

    // 点击离开房间
    public onBtnLeaveRoomClicked() {
        NetworkManager.instance.send('clientRoomAction', 'leaveRoom', {});
    }

    // 添加AI按钮点击处理
    private _addAiBtnClickHandler(btnComp: Button) {
        const slotIndex = this.addAiButtons.indexOf(btnComp.node);
        if (slotIndex === -1) return;
        NetworkManager.instance.send('clientRoomAction', 'addAI', {});
    }

    // AI添加成功
    private onAiAdded(data: any) {
        console.log("🤖 AI玩家已添加:", data);
    }

    // AI被踢出
    private onAiKicked(data: any) {
        console.log("🤖 AI玩家已被踢出:", data);
    }

    // 被房主踢出时触发
    private onPlayerKicked(data: any) {
        console.log("⛔ 您已被房主移出房间");
        const message = data.message || '您已被房主移出房间';
        this.showDialog(message, () => {
            sys.localStorage.removeItem('currentRoomId');
            sys.localStorage.removeItem('localPlayerId');
            sys.localStorage.removeItem('initialRoomState');
            sys.localStorage.removeItem('currentGameState');
            NetworkManager.instance.disconnect();
            NetworkManager.instance.ensureLobbyConnection();
            assetManager.loadBundle('remote_assets', (err, bundle) => {
                if (err) return;
                bundle.loadScene('Lobby', (err, sceneAsset) => {
                    if (err) return;
                    director.runScene(sceneAsset);
                });
            });
        });
    }

    // 主动离开房间时触发
    private onPlayerLeft(data: any) {
        console.log("🚪 您已离开房间");
        sys.localStorage.removeItem('currentRoomId');
        sys.localStorage.removeItem('localPlayerId');
        sys.localStorage.removeItem('initialRoomState');
        sys.localStorage.removeItem('currentGameState');
        NetworkManager.instance.disconnect();
        NetworkManager.instance.ensureLobbyConnection();
        assetManager.loadBundle('remote_assets', (err, bundle) => {
            if (err) return;
            bundle.loadScene('Lobby', (err, sceneAsset) => {
                if (err) return;
                director.runScene(sceneAsset);
            });
        });
    }

    // 服务端返回的错误
    private onRoomError(data: any) {
        console.error("服务器错误:", data.message);
        this.showDialog(data.message || '操作失败');
    }

    // 简易弹窗（你可替换为 Cocos Prefab 实现）
    private showDialog(message: string, onConfirm?: () => void) {
        // 在 Cocos Editor 中可通过 @property(Node) 绑定 dialog 节点后实现
        // 这里先使用 alert 占位，上线前替换为真正的弹窗 Prefab
        if (typeof alert !== 'undefined') {
            alert(message);
        } else {
            console.warn("[Dialog] " + message);
        }
        if (onConfirm) onConfirm();
    }

    // ★ 核心改动仅限于此：游戏开始后，挂好路牌，进入Loading场景拉取资源
    private onGameStarted(data: any) {
        console.log("🚀 游戏正式开始！收到初始游戏数据:", data);
        sys.localStorage.setItem("currentGameState", JSON.stringify(data.gameState || data));

        // 挂路牌：告诉 Loading 场景，这次要拉取的资源是 Game
        sys.localStorage.setItem("TargetSceneName", "Game");

        assetManager.loadBundle('remote_assets', (err, bundle) => {
            if (err) {
                console.error('加载远程包失败:', err);
                return;
            }
            bundle.loadScene('Loading', (err, sceneAsset) => {
                if (err) return console.error('加载Loading场景失败:', err);
                director.runScene(sceneAsset);
            });
        });
    }
}