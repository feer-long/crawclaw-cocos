import { _decorator, Component, Label, Node, Color, Button } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('PlayerInfoItem')
export class PlayerInfoItem extends Component {
    @property(Label) playerName: Label = null;
    @property(Label) attrLabel: Label = null;
    @property(Label) resourceLabel: Label = null;

    @property(Label) tributeCount: Label = null;
    @property(Label) lobsterCount: Label = null;
    @property(Node) tributeBtnNode: Node = null;
    @property(Node) lobsterBtnNode: Node = null;

    private _playerData: any = null;

    public init(data: any, isSelf: boolean) {
        this._playerData = data;

        this.playerName.string = isSelf ? `👤 ${data.name}` : data.name;

        // 对应服务端的数据字段
        this.attrLabel.string = `德:${data.de} | 望:${data.wang} | 里长:${data.liZhang}`;
        this.resourceLabel.string = `💰${data.coins} 🌿${data.seaweed} 🛒${data.cages}`;
        const tributeCards = data.tributeCards || [];
        const lobsters = data.lobsters || [];
        const titles = data.titleCards || [];

        this.tributeCount.string = `卡:${tributeCards.length}`;
        this.lobsterCount.string = `虾:${lobsters.length + titles.length}`;

        // 绑定点击事件：通过全局事件总线通知 GameView 弹出详情
        this.tributeBtnNode.off(Button.EventType.CLICK);
        this.tributeBtnNode.on(Button.EventType.CLICK, () => {
            // 【修改】：用 scheduleOnce 延迟一瞬间再发射事件
            this.scheduleOnce(() => {
                NetworkManager.instance.eventTarget.emit('ui_view_player_items', {
                    type: 'tribute',
                    playerName: data.name,
                    items: tributeCards
                });
            }, 0.05); // 延迟 0.05 秒，留给按钮恢复颜色的时间
        }, this);

        this.lobsterBtnNode.off(Button.EventType.CLICK);
        this.lobsterBtnNode.on(Button.EventType.CLICK, () => {
            this.scheduleOnce(() => {
                NetworkManager.instance.eventTarget.emit('ui_view_player_items', {
                    type: 'lobster',
                    playerName: data.name,
                    lobsters: lobsters,
                    titles: titles
                });
            }, 0.05);
        }, this);
    }
}