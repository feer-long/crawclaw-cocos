import { _decorator, Component, Node, Prefab, instantiate, Vec3, tween, Label, UITransform } from 'cc';
import { PlayerInfoItem } from './PlayerInfoItem';
const { ccclass, property } = _decorator;

@ccclass('PlayerStatusManager')
export class PlayerStatusManager extends Component {
    @property(Node) panelBody: Node = null;
    @property(Node) listContent: Node = null;
    @property(Prefab) playerItemPrefab: Prefab = null;
    @property(Label) toggleBtnLabel: Label = null;

    private _isExpanded: boolean = false;
    private _hiddenY: number = 0;
    private _showY: number = 0;
    private _toggleBtnY: number = 0;

    start() {
        this.calcPositions();
        this.node.setPosition(this.node.position.x, this._hiddenY, this.node.position.z);

        const btnNode = this.toggleBtnLabel?.node.parent;
        if (btnNode) {
            btnNode.setPosition(btnNode.position.x, this._toggleBtnY, btnNode.position.z);
        }

        this.listContent.active = false;

        if (this.toggleBtnLabel) {
            this.toggleBtnLabel.node.active = true;
            this.toggleBtnLabel.string = "玩家资源 ▲";
        } else {
            console.error("警告：toggleBtnLabel 未在编辑器中关联！");
        }
    }

    private calcPositions() {
        const parentTrans = this.node.parent?.getComponent(UITransform);
        const canvasH = parentTrans ? parentTrans.height : 1334;
        const panelBodyH = canvasH * 0.30;

        const panelBodyTrans = this.panelBody.getComponent(UITransform);
        if (panelBodyTrans) {
            panelBodyTrans.height = panelBodyH;
        }

        const scrollView = this.panelBody.getChildByName('ScrollView');
        if (scrollView) {
            const svTrans = scrollView.getComponent(UITransform);
            if (svTrans) {
                svTrans.height = panelBodyH;
            }
            const viewNode = scrollView.getChildByName('view');
            if (viewNode) {
                const viewTrans = viewNode.getComponent(UITransform);
                if (viewTrans) {
                    viewTrans.height = panelBodyH
                    viewNode.setPosition(viewNode.position.x, 0, viewNode.position.z);
                }
            }
        }

        const btnNode = this.toggleBtnLabel?.node.parent;
        const btnH = btnNode?.getComponent(UITransform)?.height ?? 80;
        this._toggleBtnY = panelBodyH / 2 - btnH / 3;

        this._hiddenY = -canvasH / 2 + canvasH * 0.15 - panelBodyH / 2;
        this._showY = -canvasH / 2 + panelBodyH / 2;
    }

    public togglePanel() {
        this._isExpanded = !this._isExpanded;
        const targetY = this._isExpanded ? this._showY : this._hiddenY;

        if (this.toggleBtnLabel) {
            this.toggleBtnLabel.string = this._isExpanded ? "收起面板 ▼" : "玩家资源 ▲";
        }

        this.listContent.active = this._isExpanded;

        tween(this.node)
            .to(0.3, { position: new Vec3(0, targetY, 0) }, { easing: 'quintOut' })
            .start();

        if (this.toggleBtnLabel) {
            const btnNode = this.toggleBtnLabel.node.parent;
            tween(btnNode)
                .to(0.3, { position: new Vec3(btnNode.position.x, this._toggleBtnY, 0) }, { easing: 'quintOut' })
                .start();
        }
    }

    // 由 GameView 的 refreshUI 自动调用
    public refreshData(players: any[], localPlayerId: number) {
        if (!players) return;

        this.listContent.removeAllChildren();
        players.forEach((data) => {
            const item = instantiate(this.playerItemPrefab);
            this.listContent.addChild(item);
            const isSelf = (data.id == localPlayerId);
            item.getComponent(PlayerInfoItem).init(data, isSelf);
        });
    }
}