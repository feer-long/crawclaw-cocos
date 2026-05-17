import { EventTarget, game, Game } from 'cc';

export class NetworkManager {
    private static _instance: NetworkManager = null;
    public static get instance(): NetworkManager {
        if (!this._instance) {
            this._instance = new NetworkManager();
            this._instance.initGameListeners();
        }
        return this._instance;
    }

    private ws: WebSocket | null = null;
    private oldLobbyWs: WebSocket | null = null;
    public eventTarget: EventTarget = new EventTarget();
    private gameState: any = {}; // In-memory cache for game state
    private connectUrl: string = '';
    private lobbyUrl: string = '';
    private isReconnecting: boolean = false;
    private pendingMessages: string[] = [];

    private initGameListeners() {
        game.on(Game.EVENT_SHOW, this.onGameShow, this);
    }

    private onGameShow() {
        if (!this.connectUrl || this.isReconnecting) return;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.isReconnecting = true;
            this.reconnect();
        }
    }

    private reconnect() {
        console.log("🔄 检测到连接断开，正在自动重连...");
        this.connect(this.connectUrl,
            () => {
                this.eventTarget.emit("reconnected");
            },
            () => {
                this.eventTarget.emit("reconnect_failed");
            }
        );
    }

    public ensureLobbyConnection() {
        if (!this.lobbyUrl) return;
        if (!this.isConnected() || this.connectUrl !== this.lobbyUrl) {
            console.log("🔄 正在连接大厅...");
            this.connect(this.lobbyUrl,
                () => { this.eventTarget.emit("lobby_connected"); },
                () => { console.error("连接大厅失败"); }
            );
        }
    }

    public connect(url: string, onSuccess?: () => void, onError?: () => void) {
        this.connectUrl = url;
        if (!this.lobbyUrl) this.lobbyUrl = url;

        // 回切大厅：关闭旧的 room WS 和 lobby WS，创建全新连接
        if (url === this.lobbyUrl) {
            if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
                this.ws.onclose = null;
                this.ws.close();
            }
            if (this.oldLobbyWs && this.oldLobbyWs.readyState !== WebSocket.CLOSED) {
                this.oldLobbyWs.onclose = null;
                this.oldLobbyWs.close();
                this.oldLobbyWs = null;
            }
            this.ws = null;
        }

        // 进房间：保存 lobby WS 引用，但不关闭
        if (this.ws && !this.oldLobbyWs) {
            this.oldLobbyWs = this.ws;
        }

        const oldWs = this.ws;
        const newWs = new WebSocket(url);

        console.log("正在连接服务器: " + url);

        newWs.onopen = () => {
            console.log("🚀 WebSocket 连接成功！");
            if (oldWs && oldWs !== newWs) {
                oldWs.onclose = null;
                oldWs.onmessage = null;
                oldWs.onerror = null;
                // 不关闭 oldWs，保持 lobby 连接存活
            }
            this.ws = newWs;
            if (onSuccess) onSuccess();
            this.isReconnecting = false;
            this.flushPendingMessages();
        };

        newWs.onmessage = (event) => {
            try {
                const parsedData = JSON.parse(event.data);
                console.log("📥 收到服务器原始消息:", parsedData);

                const serverEvent = parsedData.event;
                const innerData = parsedData.data || {};

                if (serverEvent === 'error') {
                    this.eventTarget.emit('error', innerData);
                    return;
                }

                const actionType = innerData.actionType || innerData.action_type;

                // ==========================================
                // 🌟 全局状态拦截器 (内存缓存版)
                // ==========================================
                let stateModified = false;

                // 拦截 1：战局更新
                if (innerData.gameState) {
                    Object.assign(this.gameState, innerData.gameState);
                    stateModified = true;
                } else if (serverEvent === 'gameStateUpdate' || actionType === 'gameStateUpdate') {
                    const newData = innerData.gameState || innerData;
                    Object.assign(this.gameState, newData);
                    stateModified = true;
                }

                // 拦截 2：玩家资源更新
                const isResourceMsg = (serverEvent === 'playerResourceUpdate' || actionType === 'playerResourceUpdate');
                const isWaitingUIMsg = (actionType === 'areaWaitingUI');

                if (isResourceMsg || isWaitingUIMsg) {
                    const playerData = innerData.player || innerData.resources || (isResourceMsg ? innerData : null);
                    const playerId = innerData.playerId;

                    if (playerData && playerId !== undefined && this.gameState.players) {
                        const targetPlayer = this.gameState.players.find((p: any) => p.id == playerId);
                        if (targetPlayer) {
                            Object.assign(targetPlayer, playerData);
                            stateModified = true;
                            console.log(`✅ 已同步玩家 ${playerId} 的内存缓存数据`);
                        }
                    }
                }

                if (stateModified) {
                    cc.sys.localStorage.setItem('currentGameState', JSON.stringify(this.gameState));
                }
                // ==========================================

                if (actionType) {
                    const payload = innerData.data !== undefined ? innerData.data : innerData;
                    this.eventTarget.emit(actionType, payload);
                } else {
                    this.eventTarget.emit(serverEvent, innerData);
                }
            } catch (e) {
                console.error("解析服务器消息失败:", e);
            }
        };

        newWs.onclose = () => {
            if (this.ws !== newWs) return;
            console.warn("❌ WebSocket 连接断开");
            this.isReconnecting = false;
            this.eventTarget.emit("disconnect");
        };

        newWs.onerror = () => {
            console.error("⚠️ WebSocket 发生错误");
            if (this.ws !== newWs) return;
            this.isReconnecting = false;
            if (onError) onError();
        };
    }

    public send(eventName: string, actionString: string, data: any = {}) {
        const payload = {
            event: eventName,
            data: {
                action_type: actionString,
                actionType: actionString,
                ...data
            }
        };
        const message = JSON.stringify(payload);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log("📤 发送消息到服务器:", payload);
            this.ws.send(message);
        } else if (this.isReconnecting || this.ws?.readyState === WebSocket.CONNECTING) {
            console.log("⏳ 连接正在恢复，暂存消息:", payload);
            this.pendingMessages.push(message);
        } else {
            console.error("无法发送消息，网络未连接！");
        }
    }

    private flushPendingMessages() {
        if (this.pendingMessages.length === 0) return;
        const messages = this.pendingMessages.slice();
        this.pendingMessages = [];
        for (const msg of messages) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log("📤 补发暂存消息");
                this.ws.send(msg);
            } else {
                this.pendingMessages.push(msg);
            }
        }
        if (this.pendingMessages.length > 0) {
            console.log(`⏳ ${this.pendingMessages.length} 条消息暂存等待下次连接`);
        }
    }

    public isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    public disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.oldLobbyWs) {
            this.oldLobbyWs.close();
            this.oldLobbyWs = null;
        }
        this.connectUrl = '';
        this.pendingMessages = [];
        this.isReconnecting = false;
        this.gameState = {}; // Clear cache on disconnect
    }

    public getGameState(): any {
        if (Object.keys(this.gameState).length === 0) {
            const stateStr = cc.sys.localStorage.getItem('currentGameState');
            if (stateStr) {
                this.gameState = JSON.parse(stateStr);
            }
        }
        return this.gameState;
    }
}