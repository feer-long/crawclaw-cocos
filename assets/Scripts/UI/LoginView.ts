import { _decorator, Component, Node, EditBox, director, profiler, assetManager, UITransform, screen } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { WeChatAdapter } from '../WeChat/WeChatAdapter';
import { Config } from '../Config';
const { ccclass, property } = _decorator;

@ccclass('LoginView')
export class LoginView extends Component {

    @property(EditBox)
    public nameInput: EditBox = null;

    @property(Node)
    public wechatLoginPanel: Node = null;

    @property(Node)
    public manualLoginPanel: Node = null;

    start() {
        profiler.hideStats();

        if (WeChatAdapter.instance.isWeChatEnvironment()) {
            this.wechatLoginPanel.active = true;
            this.manualLoginPanel.active = false;
            this.setupWeChatLoginButton();
            console.log("微信环境：显示微信登录按钮");
        } else {
            this.wechatLoginPanel.active = false;
            this.manualLoginPanel.active = true;
            console.log("登录场景加载完毕！等待玩家输入名字。");
        }
    }

    private setupWeChatLoginButton(): void {
        if (!this.wechatLoginPanel) {
            console.warn('wechatLoginPanel 未配置，降级为手动登录');
            this.fallbackToManualLogin();
            return;
        }

        const loginBtn = this.wechatLoginPanel.getChildByName('LoginButton');
        if (!loginBtn) {
            console.warn('wechatLoginPanel 缺少 LoginButton 子节点，降级为手动登录');
            this.fallbackToManualLogin();
            return;
        }

        const uiTransform = loginBtn.getComponent(UITransform);
        if (!uiTransform) {
            console.warn('LoginButton 缺少 UITransform 组件，降级为手动登录');
            this.fallbackToManualLogin();
            return;
        }

        const BUTTON_W = uiTransform.width;
        const BUTTON_H = uiTransform.height;

        const canvasSize = screen.windowSize;
        const designWidth = 750;
        const designHeight = 1334;

        let dpr = 2;
        try {
            dpr = wx.getSystemInfoSync().pixelRatio || 2;
        } catch (e) {
            console.warn('获取 DPR 失败，使用默认值 2');
        }
        const logicalWidth = canvasSize.width / dpr;
        const logicalHeight = canvasSize.height / dpr;
        const uniformScale = Math.min(logicalWidth / designWidth, logicalHeight / designHeight);
        const offsetX = (logicalWidth - designWidth * uniformScale) / 2;
        const offsetY = (logicalHeight - designHeight * uniformScale) / 2;

        const localPos = loginBtn.position;

        const buttonRect = {
            x: (localPos.x + designWidth / 2 - BUTTON_W / 2) * uniformScale + offsetX,
            y: (designHeight / 2 - localPos.y - BUTTON_H / 2) * uniformScale + offsetY,
            width: BUTTON_W * uniformScale,
            height: BUTTON_H * uniformScale
        };

        WeChatAdapter.instance.getUserInfoRecommended(buttonRect, (userInfo) => {
            if (userInfo && userInfo.nickname) {
                WeChatAdapter.instance.getOpenId((openId) => {
                    if (openId) {
                        cc.sys.localStorage.setItem("userId", openId);
                    } else {
                        console.warn('获取微信ID失败，将使用随机用户ID');
                    }
                    this.loginWithNickname(userInfo.nickname);
                });
            } else {
                console.warn('微信授权失败或用户取消，降级为手动登录');
                this.fallbackToManualLogin();
            }
        });
    }

    private loginWithNickname(nickname: string): void {
        cc.sys.localStorage.setItem("playerName", nickname);
        console.log(`玩家 ${nickname} 准备连接大厅...`);

        NetworkManager.instance.connect(
            Config.WS_LOBBY_URL,
            () => {
                console.log("连接大厅成功，准备切换场景...");
                console.log("准备下载远程资源并切换到加载页...");

                // ★ 挂路牌：告诉加载页，加载完后去大厅 (Lobby)
                cc.sys.localStorage.setItem("TargetSceneName", "Lobby");

                assetManager.loadBundle('remote_assets', (err, bundle) => {
                    if (err) {
                        console.error('加载远程资源包失败:', err);
                        this.showConnectionError();
                        return;
                    }
                    bundle.loadScene('Loading', (err, sceneAsset) => {
                        if (err) {
                            console.error('加载Loading场景失败:', err);
                            this.showConnectionError();
                            return;
                        }
                        director.runScene(sceneAsset);
                    });
                });
            },
            () => {
                console.error("服务器连接失败，请检查 Python 后端是否已启动！");
                this.showConnectionError();
            }
        );
    }

    private showConnectionError(): void {
        // 显示错误提示，不切换 UI 模式
        console.warn("连接失败，请检查网络后重试");
        // 重新创建授权按钮，用户可以再次点击重试
        this.setupWeChatLoginButton();
    }

    private fallbackToManualLogin(): void {
        if (this.wechatLoginPanel) {
            this.wechatLoginPanel.active = false;
        }
        if (this.manualLoginPanel) {
            this.manualLoginPanel.active = true;
        }
        console.log("已切换为手动输入模式");
    }

    public onLoginButtonClicked() {
        const playerName = this.nameInput.string;

        if (!playerName || playerName.trim() === "") {
            console.warn("名字不能为空！");
            return;
        }

        cc.sys.localStorage.setItem("playerName", playerName);

        let userId = cc.sys.localStorage.getItem("userId");
        if (!userId) {
            userId = "user_" + Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 9);
            cc.sys.localStorage.setItem("userId", userId);
        }

        console.log(`玩家 ${playerName} 准备连接大厅...`);

        NetworkManager.instance.connect(
            Config.WS_LOBBY_URL,
            () => {
                console.log("连接大厅成功，准备切换场景...");
                console.log("准备下载远程资源并切换到加载页...");

                // ★ 挂路牌：告诉加载页，加载完后去大厅 (Lobby)
                cc.sys.localStorage.setItem("TargetSceneName", "Lobby");

                assetManager.loadBundle('remote_assets', (err, bundle) => {
                    if (err) {
                        console.error('加载远程资源包失败:', err);
                        return;
                    }
                    bundle.loadScene('Loading', (err, sceneAsset) => {
                        if (err) {
                            console.error('加载Loading场景失败:', err);
                            return;
                        }
                        director.runScene(sceneAsset);
                    });
                });
            },
            () => {
                console.error("服务器连接失败，请检查 Python 后端是否已启动！");
            }
        );
    }

    onDestroy(): void {
        WeChatAdapter.instance.destroyAuthButton();
    }
}