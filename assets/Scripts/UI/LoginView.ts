import { _decorator, Component, Node, EditBox, director, profiler } from 'cc';
import { NetworkManager } from '../Network/NetworkManager'; // 引入我们刚写的全局单例
const { ccclass, property } = _decorator;

@ccclass('LoginView')
export class LoginView extends Component {

    @property(EditBox)
    public nameInput: EditBox = null;

    // 假设你在本地运行 Python 服务器，端口是 3100
    // 根据你的 server/main.py，大厅的路由是 /ws/lobby
    private serverUrl: string = "ws://localhost:3100/ws/lobby";

    start() {
        profiler.hideStats();
        console.log("登录场景加载完毕！等待玩家输入名字。");
    }

    public onLoginButtonClicked() {
        const playerName = this.nameInput.string;

        if (!playerName || playerName.trim() === "") {
            console.warn("名字不能为空！");
            return;
        }

        // 把玩家名字存入本地缓存，因为进大厅或者进房间时，都要把名字发给服务器
        cc.sys.localStorage.setItem("playerName", playerName);

        // 禁用按钮，防止玩家连点（你可以试着加个正在加载的提示文本）
        console.log(`玩家 ${playerName} 准备连接大厅...`);

        // 调用刚刚写的单例方法连接大厅
        NetworkManager.instance.connect(
            this.serverUrl,
            // 成功的回调：连上了才跳转！
            () => {
                console.log("连接大厅成功，准备切换场景...");
                director.loadScene("Lobby");
            },
            // 失败的回调
            () => {
                console.error("服务器连接失败，请检查 Python 后端是否已启动！");
                // 提示玩家连接失败
            }
        );
    }
}