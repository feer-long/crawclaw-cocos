import { _decorator, Component, Node, EditBox, director, profiler, assetManager, UITransform, screen } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { WeChatAdapter } from '../WeChat/WeChatAdapter';
const { ccclass, property } = _decorator;

@ccclass('LoginView')
export class LoginView extends Component {

    @property(EditBox)
    public nameInput: EditBox = null;

    @property(Node)
    public wechatLoginButton: Node = null;

    @property(Node)
    public manualLoginPanel: Node = null;

    private serverUrl: string = "ws://localhost:3100/ws/lobby";

    start() {
        profiler.hideStats();
        
        if (WeChatAdapter.instance.isWeChatEnvironment()) {
            this.wechatLoginButton.active = true;
            this.manualLoginPanel.active = false;
            this.setupWeChatLoginButton();
            console.log("微信环境：显示微信登录按钮");
        } else {
            this.wechatLoginButton.active = false;
            this.manualLoginPanel.active = true;
            console.log("登录场景加载完毕！等待玩家输入名字。");
        }
    }

    private setupWeChatLoginButton(): void {
        if (!this.wechatLoginButton) {
            console.warn('wechatLoginButton 未配置，降级为手动登录');
            this.fallbackToManualLogin();
            return;
        }

        const uiTransform = this.wechatLoginButton.getComponent(UITransform);
        if (!uiTransform) {
            console.warn('wechatLoginButton 缺少 UITransform 组件，降级为手动登录');
            this.fallbackToManualLogin();
            return;
        }

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
        const scaleX = logicalWidth / designWidth;
        const scaleY = logicalHeight / designHeight;

        const localPos = this.wechatLoginButton.position;
        const screenX = (localPos.x + designWidth / 2) * scaleX;

        const BUTTON_W = 280;
        const BUTTON_H = 44;
        const buttonRect = {
            x: screenX - BUTTON_W / 2,
            y: (designHeight / 2 - localPos.y) * scaleY - BUTTON_H / 2,
            width: BUTTON_W,
            height: BUTTON_H
        };

        console.log(`微信按钮: DPR=${dpr}, logical=${logicalWidth}x${logicalHeight}, pos=${buttonRect.x.toFixed(0)},${buttonRect.y.toFixed(0)} ${BUTTON_W}x${BUTTON_H}`);

        WeChatAdapter.instance.getUserInfoWithButton(buttonRect, (userInfo) => {
            if (userInfo && userInfo.nickname) {
                console.log(`获取到微信昵称: ${userInfo.nickname}`);
                if (userInfo.openId) {
                    cc.sys.localStorage.setItem("userId", userInfo.openId);
                }
                this.loginWithNickname(userInfo.nickname);
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
            this.serverUrl,
            () => {
                console.log("连接大厅成功，准备切换场景...");
                console.log("准备下载远程资源并切换到大厅场景...");
                assetManager.loadBundle('remote_assets', (err, bundle) => {
                    if (err) {
                        console.error('加载远程资源包失败:', err);
                        this.showConnectionError();
                        return;
                    }
                    bundle.loadScene('Lobby', (err, sceneAsset) => {
                        if (err) {
                            console.error('加载大厅场景失败:', err);
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
        if (this.wechatLoginButton) {
            this.wechatLoginButton.active = false;
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
            this.serverUrl,
            () => {
                console.log("连接大厅成功，准备切换场景...");
                console.log("准备下载远程资源并切换到大厅场景...");
                assetManager.loadBundle('remote_assets', (err, bundle) => {
                    if (err) {
                        console.error('加载远程资源包失败:', err);
                        return;
                    }
                    bundle.loadScene('Lobby', (err, sceneAsset) => {
                        if (err) {
                            console.error('加载大厅场景失败:', err);
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
