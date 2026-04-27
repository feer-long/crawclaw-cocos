import { _decorator, Component, Node, Prefab, instantiate, Vec3, tween, Label } from 'cc';
import { PlayerInfoItem } from './PlayerInfoItem';
const { ccclass, property } = _decorator;

@ccclass('PlayerStatusManager')
export class PlayerStatusManager extends Component {
    @property(Node) panelBody: Node = null;
    @property(Node) listContent: Node = null;
    @property(Prefab) playerItemPrefab: Prefab = null;
    @property(Label) toggleBtnLabel: Label = null;

    private _isExpanded: boolean = false;
    private _hiddenY: number = -795;
    private _showY: number = -520;

    start() {
        // 初始位置设置
        const pos = this.node.position;
        this.node.setPosition(pos.x, this._hiddenY, pos.z);

        // 【新增】：初始化时强制刷新一次文字，防止编辑器里是空的
        if (this.toggleBtnLabel) {
            this.toggleBtnLabel.node.active = true; // 确保节点开启
            this.toggleBtnLabel.string = "玩家状态 ▲";
        } else {
            console.error("警告：toggleBtnLabel 未在编辑器中关联！");
        }
    }

    public togglePanel() {
        this._isExpanded = !this._isExpanded;
        const targetY = this._isExpanded ? this._showY : this._hiddenY;

        // 如果绑定了文字，自动修改箭头方向
        if (this.toggleBtnLabel) {
            this.toggleBtnLabel.string = this._isExpanded ? "收起面板 ▼" : "玩家状态 ▲";
        }

        tween(this.node)
            .to(0.3, { position: new Vec3(0, targetY, 0) }, { easing: 'quintOut' })
            .start();
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