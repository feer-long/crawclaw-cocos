import { _decorator, Component, Label, Sprite, Color } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('ActionSlotView')
export class ActionSlotView extends Component {

    @property(Label)
    public ownerLabel: Label = null;

    @property(Sprite)
    public bgSprite: Sprite = null;

    // 记录这个格子属于哪个区域、第几个序号
    private areaId: string = "";
    private slotIndex: number = -1;

    // 记录当前是否是我的回合，以及我是否还有里长
    private canPlace: boolean = false;

    /**
     * 初始化格子的数据
     */
    public init(areaId: string, slotIndex: number, occupantId: number | null, players: any[], isMyTurn: boolean, myLiZhang: number) {
        this.areaId = areaId;
        this.slotIndex = slotIndex;

        // 判断是否可以放置：是我的回合 + 我有里长 + 格子是空的
        this.canPlace = isMyTurn && (myLiZhang > 0) && (occupantId === null);

        if (occupantId !== null) {
            // 格子被占用了，显示玩家名字
            const owner = players.find(p => p.id === occupantId);
            this.ownerLabel.string = owner ? owner.name : "已占领";
            this.bgSprite.color = new Color(200, 100, 100); // 红色代表被占
        } else {
            this.ownerLabel.string = `格 ${slotIndex + 1}`;
            this.bgSprite.color = new Color(200, 200, 200); // 灰色代表空闲
        }
    }

    /**
     * 当玩家点击这个格子时触发
     */
    public onSlotClicked() {
        if (!this.canPlace) {
            console.log("现在不能放置！可能是没轮到你，或者没有里长了，或者格子被占了。");
            return;
        }

        console.log(`向服务器请求在 ${this.areaId} 的第 ${this.slotIndex} 格放置里长...`);

        // 【核心修改】：完全对齐 game_action_handler 的特殊要求
        // 1. 数据必须嵌套在 payload 字段内
        // 2. 后端取值的字段名叫 areaIndex (虽然传的是字符串)
        NetworkManager.instance.send('clientGameAction', 'placeHeadman', {
            payload: {
                areaIndex: this.areaId,
                slotIndex: this.slotIndex
            }
        });
    }
}