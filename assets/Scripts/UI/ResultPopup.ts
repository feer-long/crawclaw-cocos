import { _decorator, Component, Label, Node, Color, director, Button, assetManager, instantiate, Layout, sys, game, Sprite, ImageAsset, Texture2D, SpriteFrame, tween, Vec3 } from 'cc';
import { Config } from '../Config';
import { calculateEstimatedScore } from '../Data/GameConstants';
import { WeChatAdapter } from '../WeChat/WeChatAdapter';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('ResultPopup')
export class ResultPopup extends Component {

    @property(Node) public listContent: Node = null;
    @property(Node) public itemTemplate: Node = null;
    @property(Button) public btnReturn: Button = null;

    @property(Node) public shareSubmenu: Node = null;
    @property(Node) public qrCodeNode: Node = null;

    private _localPlayerName: string = '';
    private _isWeChat: boolean = false;
    private _isSharing: boolean = false;

    public start(): void {
        this._isWeChat = WeChatAdapter.instance.isWeChatEnvironment();
        if (this.shareSubmenu) this.shareSubmenu.active = this._isWeChat;

        if (this.qrCodeNode) this.qrCodeNode.active = false;

        if (this._isWeChat && this.qrCodeNode) {
            this._preloadQR();
        }
    }

    private _preloadQR(): void {
        const qrUrl = `https://${Config.CDN_HOST}/qrcode.png`;
        assetManager.loadRemote<ImageAsset>(qrUrl, { ext: '.png' }, (err, imageAsset) => {
            if (err) {
                console.warn('[ResultPopup] QR码预加载失败:', err);
                return;
            }
            const texture = new Texture2D();
            texture.image = imageAsset;
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            const sprite = this.qrCodeNode.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = spriteFrame;
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            }
        });
    }

    public init(data: any) {
        const gameState = data.gameState;
        if (!gameState) return;

        const players = gameState.players || [];
        this._isWeChat = WeChatAdapter.instance.isWeChatEnvironment();

        if (this.shareSubmenu) this.shareSubmenu.active = this._isWeChat;

        if (gameState.status === 'waitingEndgameChoice') {
            const waitingList = gameState.waitingForEndgameChoice || [];
            const currentIndex = gameState.endgameChoiceIndex || 0;
            const currentPlayer = waitingList[currentIndex];
            if (this.btnReturn) {
                const btnLabel = this.btnReturn.getComponentInChildren(Label);
                if (btnLabel) btnLabel.string = `⏳ 等待 ${currentPlayer?.playerName || '他人'} 选择中...`;
                this.btnReturn.interactable = false;
            }
            if (this.shareSubmenu) this.shareSubmenu.active = false;
        } else {
            if (this.btnReturn) {
                const btnLabel = this.btnReturn.getComponentInChildren(Label);
                if (btnLabel) btnLabel.string = "返回大厅";
                this.btnReturn.interactable = true;
            }
        }

        const localPlayerId = sys.localStorage.getItem('localPlayerId');

        const results = players.map((p: any) => {
            const stats = this.calculateFinalScore(p, gameState);
            return { player: p, ...stats };
        });

        results.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            return b.player.coins - a.player.coins;
        });

        results.some((res) => {
            const isLocalPlayer = localPlayerId != null && Number(res.player.id) === Number(localPlayerId);
            if (isLocalPlayer) {
                this._localPlayerName = res.player.name || '';
                return true;
            }
            return false;
        });

        // 隐藏模板
        if (this.itemTemplate) this.itemTemplate.active = false;

        // 获取场景中固定的4个玩家容器
        const containers = [
            this.listContent.getChildByName('TopContainer'),
            this.listContent.getChildByName('SecondContainer'),
            this.listContent.getChildByName('ThirdContainer'),
            this.listContent.getChildByName('FourthContainer')
        ];

        // 遍历更新UI
        containers.forEach((container, index) => {
            if (!container) return;

            // 根据实际玩家数量决定显隐
            if (index < results.length) {
                container.active = true;
                const res = results[index];

                // 绑定基础信息节点
                const nameLabel = container.getChildByName('NameLabel')?.getComponent(Label);
                const scoreLabel = container.getChildByName('ScoreLabel')?.getComponent(Label);
                const detailLabel = container.getChildByName('DetailLabel')?.getComponent(Label);
                const spritePlayer = container.getChildByName('Sprite_player')?.getComponent(Sprite);
                const btnExpand = container.getChildByName('BtnExpand');

                // 赋值微信昵称和总分
                if (nameLabel) nameLabel.string = res.player.name || `玩家${index + 1}`;
                if (scoreLabel) scoreLabel.string = `${res.total} 分`;

                // 赋值微信头像
                if (spritePlayer && res.player.avatarUrl) {
                    this.loadWeChatAvatar(res.player.avatarUrl, spritePlayer);
                }

                // 根据名次赋予不同格式的简略小分文本
                if (detailLabel) {
                    if (index === 0) {
                        detailLabel.string = `运道：${res.core} | 席位：${res.tavern} | 资源：${res.res}`;
                    } else {
                        detailLabel.string = `运:${res.core} | 席:${res.tavern} | 资:${res.res}`;
                    }
                }

                // 绑定展开按钮交互逻辑
                if (btnExpand) {
                    btnExpand.off(Button.EventType.CLICK);

                    let isExpanded = false;
                    let activeDetailNode: Node = null;

                    btnExpand.on(Button.EventType.CLICK, () => {
                        isExpanded = !isExpanded;

                        // 旋转动画 (顺时针 -90 度，恢复 0 度)
                        tween(btnExpand)
                            .to(0.2, { eulerAngles: new Vec3(0, 0, isExpanded ? -90 : 0) })
                            .start();

                        if (isExpanded) {
                            // 展开：实例化并插入详情节点
                            const detailPrefab = this.itemTemplate.getChildByName('DetailsContainer');
                            if (!detailPrefab) return;

                            activeDetailNode = instantiate(detailPrefab);
                            activeDetailNode.active = true;

                            // ==========================================
                            // 精准寻找多 Label 节点的逻辑修改部分
                            // ==========================================

                            // 1. 运道：核心乘积分
                            const spriteYundao = activeDetailNode.getChildByName('Sprite_yundao');
                            if (spriteYundao) {
                                const detailCore = spriteYundao.getChildByName('DetailCore')?.getComponent(Label);
                                const coreScore = spriteYundao.getChildByName('CoreScore')?.getComponent(Label);
                                if (detailCore) detailCore.string = `核心乘积分 =（运${res.deVal}*道${res.wangVal}=${res.core}分）`;
                                if (coreScore) coreScore.string = `+${res.core}分`;
                            }

                            // 2. 席位：上供席位分
                            const spriteXiwei = activeDetailNode.getChildByName('Sprite_xiwei');
                            if (spriteXiwei) {
                                const detailTavern = spriteXiwei.getChildByName('DetailTavern')?.getComponent(Label);
                                const tavernScore = spriteXiwei.getChildByName('TavernScore')?.getComponent(Label);
                                if (detailTavern) detailTavern.string = `上供席位分=（${res.tavernList.length > 0 ? res.tavernList.join('+') : '0'}=${res.tavern}分）`;
                                if (tavernScore) tavernScore.string = `+${res.tavern}分`;
                            }

                            // 3. 资源：资源转换分 (DetailRes_begin 为固定文字，不修改)
                            const spriteZiyuan = activeDetailNode.getChildByName('Sprite_ziyuan');
                            if (spriteZiyuan) {
                                const detailRes = spriteZiyuan.getChildByName('DetailRes')?.getComponent(Label);
                                const resScore = spriteZiyuan.getChildByName('ResScore')?.getComponent(Label);
                                if (detailRes) detailRes.string = `（贝币折算${res.coinsScore}+仙草折算${res.seaweedScore}+灵鼎折算${res.cagesScore}+灵螯折算${res.lobstersScore}=${res.res}分）`;
                                if (resScore) resScore.string = `+${res.res}分`;
                            }

                            // 4. 总计 (DetailTotal 为固定文字，不修改)
                            const spriteTotal = activeDetailNode.getChildByName('Sprite_total');
                            if (spriteTotal) {
                                const totalScore = spriteTotal.getChildByName('TotalScore')?.getComponent(Label);
                                if (totalScore) totalScore.string = `${res.total}分`; // 注意这里没有“+”号
                            }

                            // 动态插入到当前玩家容器的正下方
                            const currentIdx = container.getSiblingIndex();
                            this.listContent.insertChild(activeDetailNode, currentIdx + 1);

                        } else {
                            // 收起：销毁详情节点
                            if (activeDetailNode && activeDetailNode.isValid) {
                                activeDetailNode.removeFromParent();
                                activeDetailNode.destroy();
                                activeDetailNode = null;
                            }
                        }

                        // 通知 Layout 强制刷新重新排版
                        const layout = this.listContent.getComponent(Layout);
                        if (layout) layout.updateLayout();
                    });
                }
            } else {
                container.active = false;
            }
        });
    }

    private loadWeChatAvatar(avatarUrl: string, spriteComp: Sprite) {
        if (!avatarUrl || !spriteComp) return;
        assetManager.loadRemote<ImageAsset>(avatarUrl, { ext: '.png' }, (err, imageAsset) => {
            if (err) {
                console.warn('[ResultPopup] 微信头像加载失败:', err);
                return;
            }
            if (spriteComp && spriteComp.isValid) {
                const texture = new Texture2D();
                texture.image = imageAsset;
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                spriteComp.spriteFrame = spriteFrame;
            }
        });
    }

    public onShareResult(): void {
        if (this._isSharing || !this._localPlayerName) return;
        this._isSharing = true;

        if (this.btnReturn) this.btnReturn.node.active = false;
        if (this.shareSubmenu) this.shareSubmenu.active = false;
        if (this.qrCodeNode) this.qrCodeNode.active = true;

        requestAnimationFrame(() => {
            const canvas = (game as any).canvas;
            if (!canvas || typeof canvas.toTempFilePath !== 'function') {
                console.warn('[ResultPopup] canvas.toTempFilePath 不可用');
                if (this.qrCodeNode) this.qrCodeNode.active = false;
                this._isSharing = false;
                if (this.btnReturn) this.btnReturn.node.active = true;
                if (this.shareSubmenu) this.shareSubmenu.active = true;
                return;
            }

            canvas.toTempFilePath({
                x: 0, y: 0,
                width: canvas.width, height: canvas.height,
                destWidth: canvas.width, destHeight: canvas.height,
                fileType: 'png',
                success: (res: any) => {
                    if (this.qrCodeNode) this.qrCodeNode.active = false;

                    WeChatAdapter.instance.shareImage(res.tempFilePath, (success) => {
                        this._isSharing = false;
                        if (this.btnReturn) this.btnReturn.node.active = true;
                        if (this.shareSubmenu) this.shareSubmenu.active = true;
                        if (success) {
                            console.log('战果分享成功');
                        } else {
                            console.warn('战果分享失败');
                        }
                    });
                },
                fail: () => {
                    if (this.qrCodeNode) this.qrCodeNode.active = false;
                    this._isSharing = false;
                    if (this.btnReturn) this.btnReturn.node.active = true;
                    if (this.shareSubmenu) this.shareSubmenu.active = true;
                    console.warn('[ResultPopup] 截图失败');
                }
            });
        });
    }

    public onShareInviteFriend(): void {
        if (this._isSharing) return;
        this._isSharing = true;

        WeChatAdapter.instance.shareGameInvite(this._localPlayerName, (success) => {
            this._isSharing = false;
            if (this.shareSubmenu) this.shareSubmenu.active = true;
            if (success) {
                console.log('邀请发送成功');
            } else {
                console.warn('邀请发送失败');
            }
        });
    }

    private calculateFinalScore(player: any, gameState: any) {
        return calculateEstimatedScore(player, gameState);
    }

    public onBtnReturnClicked() {
        sys.localStorage.removeItem('currentRoomId');
        sys.localStorage.removeItem('localPlayerId');
        sys.localStorage.removeItem('initialRoomState');
        sys.localStorage.removeItem('currentGameState');
        sys.localStorage.removeItem('myLastPlacedArea');
        sys.localStorage.removeItem('myLastPlacedSlot');
        NetworkManager.instance.disconnect();
        NetworkManager.instance.ensureLobbyConnection();
        assetManager.loadBundle('remote_assets', (err, bundle) => {
            if (err) return console.error(err);
            bundle.loadScene('Lobby', (err, sceneAsset) => {
                if (err) return console.error(err);
                director.runScene(sceneAsset);
            });
        });
    }
}