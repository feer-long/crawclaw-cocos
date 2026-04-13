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

                // 兼容 Python 后端可能返回的 actionType 或 action_type 字段
                const actionType = innerData.actionType || innerData.action_type;

                if (actionType) {
                    const payload = innerData.data !== undefined ? innerData.data : innerData;
                    // 使用 Python 定义的骆驼拼写法作为事件名派发（如 'roomCreated'）
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

    // 【核心修改】：同时兼容后端的两种命名习惯
    public send(eventName: string, actionString: string, data: any = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const payload = {
                event: eventName,
                data: {
                    action_type: actionString, // 迎合 room_action_handler 的胃口
                    actionType: actionString,  // 迎合 game_action_handler 的胃口
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