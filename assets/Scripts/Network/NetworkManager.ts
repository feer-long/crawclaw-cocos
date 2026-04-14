import { EventTarget } from 'cc';

export class NetworkManager {
    private static _instance: NetworkManager = null;
    public static get instance(): NetworkManager {
        if (!this._instance) {
            this._instance = new NetworkManager();
        }
        return this._instance;
    }

    private ws: WebSocket | null = null;
    public eventTarget: EventTarget = new EventTarget();

    public connect(url: string, onSuccess?: () => void, onError?: () => void) {
        if (this.ws) this.ws.close();

        console.log("正在连接服务器: " + url);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log("🚀 WebSocket 连接成功！");
            if (onSuccess) onSuccess();
        };

        this.ws.onmessage = (event) => {
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
                // 🌟 全局状态拦截器 (增强版)
                // ==========================================
                const stateStr = cc.sys.localStorage.getItem('currentGameState');
                let currentState = stateStr ? JSON.parse(stateStr) : {};
                let stateModified = false;

                // 拦截 1：战局更新
                if (actionType === 'gameStateUpdate' || serverEvent === 'gameStateUpdate') {
                    const newData = innerData.gameState || innerData;
                    Object.assign(currentState, newData);
                    stateModified = true;
                }
                // 拦截 2：玩家资源更新 (包含专门的更新包和结算时的附加包)
                // 重点修复：同时拦截 playerResourceUpdate 和 AREA_WAITING_UI 里的 player 数据
                const isResourceMsg = (serverEvent === 'playerResourceUpdate' || actionType === 'playerResourceUpdate');
                const isWaitingUIMsg = (actionType === 'areaWaitingUI');

                if (isResourceMsg || isWaitingUIMsg) {
                    const playerData = innerData.player || innerData.resources || (isResourceMsg ? innerData : null);
                    const playerId = innerData.playerId;

                    if (playerData && playerId !== undefined && currentState.players) {
                        const targetPlayer = currentState.players.find((p: any) => p.id == playerId);
                        if (targetPlayer) {
                            // 将捕虾结果等资源直接合并进缓存
                            Object.assign(targetPlayer, playerData);
                            stateModified = true;
                            console.log(`✅ 已同步玩家 ${playerId} 的最新资源数据`);
                        }
                    }
                }

                if (stateModified) {
                    cc.sys.localStorage.setItem('currentGameState', JSON.stringify(currentState));
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

        this.ws.onclose = () => {
            console.warn("❌ WebSocket 连接断开");
            this.eventTarget.emit("disconnect");
        };

        this.ws.onerror = () => {
            console.error("⚠️ WebSocket 发生错误");
            if (onError) onError();
        };
    }

    public send(eventName: string, actionString: string, data: any = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const payload = {
                event: eventName,
                data: {
                    action_type: actionString,
                    actionType: actionString,
                    ...data
                }
            };
            console.log("📤 发送消息到服务器:", payload);
            this.ws.send(JSON.stringify(payload));
        } else {
            console.error("无法发送消息，网络未连接！");
        }
    }

    public disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}