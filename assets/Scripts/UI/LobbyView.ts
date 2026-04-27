import { _decorator, Component, EditBox, Label, director, profiler } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('LobbyView')
export class LobbyView extends Component {

    @property(EditBox)
    public roomInput: EditBox = null;

    @property(Label)
    public statusLabel: Label = null;

    onLoad() {
        profiler.hideStats();
        // 【修改点】：全部对齐 events.py 的 ServerRoomActionTypes
        NetworkManager.instance.eventTarget.on('roomCreated', this.onRoomCreated, this);
        NetworkManager.instance.eventTarget.on('playerJoined', this.onRoomJoined, this);
        NetworkManager.instance.eventTarget.on('error', this.onError, this);
    }

    onDestroy() {
        NetworkManager.instance.eventTarget.off('roomCreated', this.onRoomCreated, this);
        NetworkManager.instance.eventTarget.off('playerJoined', this.onRoomJoined, this);
        NetworkManager.instance.eventTarget.off('error', this.onError, this);
    }

    public onBtnCreateRoomClicked() {
        this.statusLabel.string = "正在向服务器请求创建房间...";
        const playerName = cc.sys.localStorage.getItem("playerName") || "未知玩家";
        const userId = "user_" + Math.random().toString(36).substr(2, 9);

        // 【修改点】：传入 eventName 和 actionType (对齐 ClientEvents 和 ClientRoomActionTypes)
        NetworkManager.instance.send('clientRoomAction', 'createRoom', {
            playerName: playerName,
            userId: userId,
            maxPlayers: 4
        });
    }

    public onBtnJoinRoomClicked() {
        const roomId = this.roomInput.string.trim();
        if (!roomId) {
            this.statusLabel.string = "房间号不能为空！";
            return;
        }

        this.statusLabel.string = `正在加入房间 ${roomId}...`;
        const playerName = cc.sys.localStorage.getItem("playerName") || "未知玩家";
        const userId = "user_" + Math.random().toString(36).substr(2, 9);

        // 【修改点】：传入 eventName 和 actionType
        NetworkManager.instance.send('clientRoomAction', 'joinRoom', {
            roomId: roomId,
            playerName: playerName,
            userId: userId
        });
    }

    private onRoomCreated(data: any) {
        console.log("🎉 创建房间成功！收到数据:", data);
        cc.sys.localStorage.setItem("currentRoomId", data.roomId);

        // 【新增】：保存初始房间状态和我的玩家ID
        cc.sys.localStorage.setItem("initialRoomState", JSON.stringify(data.gameState));
        cc.sys.localStorage.setItem("localPlayerId", data.playerId.toString());

        this.goToRoomScene();
    }

    private onRoomJoined(data: any) {
        console.log("🎉 加入房间成功！收到数据:", data);
        const roomId = data.gameState ? data.gameState.gameId : data.roomId;
        if (roomId) {
            cc.sys.localStorage.setItem("currentRoomId", roomId);
        }

        // 【新增】：保存初始房间状态和我的玩家ID
        cc.sys.localStorage.setItem("initialRoomState", JSON.stringify(data.gameState));
        cc.sys.localStorage.setItem("localPlayerId", data.playerId.toString());

        this.goToRoomScene();
    }

    private onError(data: any) {
        console.error("服务器报错:", data.message);
        this.statusLabel.string = "错误: " + (data.message || "未知错误");
    }

    private goToRoomScene() {
        director.loadScene("Room");
    }
}