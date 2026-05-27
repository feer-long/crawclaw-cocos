import { _decorator, Component, Label, Node, Color, director, Button, assetManager, instantiate, Layout, sys, game, Sprite, ImageAsset, Texture2D, SpriteFrame } from 'cc';
import { Config } from '../Config';
import { calculateEstimatedScore } from '../Data/GameConstants';
import { WeChatAdapter } from '../WeChat/WeChatAdapter';
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

        this.listContent.removeAllChildren();
        if (this.itemTemplate) this.itemTemplate.active = false;

        results.forEach((res, index) => {
            const node = instantiate(this.itemTemplate);
            node.active = true;
            this.listContent.addChild(node);

            const topContainer = node.getChildByName('TopContainer') || node;
            const rankLabel = topContainer.getChildByName('RankLabel')?.getComponent(Label);
            const nameLabel = topContainer.getChildByName('NameLabel')?.getComponent(Label);
            const scoreLabel = topContainer.getChildByName('ScoreLabel')?.getComponent(Label);

            const detailLabel = topContainer.getChildByName('DetailLabel')?.getComponent(Label)
                || topContainer.getChildByName('SummaryLabel')?.getComponent(Label);

            const btnExpand = topContainer.getChildByName('BtnExpand')?.getComponent(Button);
            const arrowLabel = btnExpand?.node.getComponentInChildren(Label);

            const detailsContainer = node.getChildByName('DetailsContainer');
            const detailCore = detailsContainer?.getChildByName('DetailCore')?.getComponent(Label);
            const detailTavern = detailsContainer?.getChildByName('DetailTavern')?.getComponent(Label);
            const detailRes = detailsContainer?.getChildByName('DetailRes')?.getComponent(Label);

            if (rankLabel) {
                rankLabel.string = `第 ${index + 1} 名`;
                if (index === 0) rankLabel.color = new Color(255, 215, 0);
                else if (index === 1) rankLabel.color = new Color(200, 230, 255);
                else if (index === 2) rankLabel.color = new Color(255, 184, 115);
                else rankLabel.color = new Color(255, 255, 255);
            }

            if (nameLabel) nameLabel.string = res.player.name;
            if (scoreLabel) scoreLabel.string = `${res.total} 分`;

            const bonusStr = res.bonusPoints > 0 ? ` | 额外: ${res.bonusPoints}分` : "";
            if (detailLabel) detailLabel.string = `德望: ${res.core}分 | 席位: ${res.tavern}分 | 资源: ${res.res}分${bonusStr}`;

            if (detailCore) {
                detailCore.string = `核心乘积分 = 德${res.deVal} * 望${res.wangVal} = ${res.core}分`;
            }
            if (detailTavern) detailTavern.string = `上供席位分 =（${res.tavernList.length > 0 ? res.tavernList.join(' + ') : '0'} = ${res.tavern}分）`;
            if (detailRes) detailRes.string = `资源转换分 =（金币折算${res.coinsScore} + 海草折算${res.seaweedScore} + 虾笼折算${res.cagesScore} + 龙虾折算${res.lobstersScore} = ${res.res}分）`;

            let isExpanded = false;
            if (btnExpand) {
                btnExpand.node.on(Button.EventType.CLICK, () => {
                    isExpanded = !isExpanded;
                    if (detailsContainer) detailsContainer.active = isExpanded;
                    if (arrowLabel) arrowLabel.string = isExpanded ? "▲" : "▼";

                    const layout = this.listContent.getComponent(Layout);
                    if (layout) layout.updateLayout();
                }, this);
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
        sys.localStorage.removeItem('currentGameState');
        sys.localStorage.removeItem('myLastPlacedArea');
        sys.localStorage.removeItem('myLastPlacedSlot');
        assetManager.loadBundle('remote_assets', (err, bundle) => {
            if (err) return console.error(err);
            bundle.loadScene('Lobby', (err, sceneAsset) => {
                if (err) return console.error(err);
                director.runScene(sceneAsset);
            });
        });
    }
}
