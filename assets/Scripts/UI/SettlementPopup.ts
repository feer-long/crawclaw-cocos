import { _decorator, Component, Label, Node } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('SettlementPopup')
export class SettlementPopup extends Component {

    @property(Label) public titleLabel: Label = null;
    @property(Label) public descLabel: Label = null;
    @property(Label) public resultLabel: Label = null;

    @property(Node) public btnConfirm: Node = null;
    @property(Node) public btnChooseLobster: Node = null;
    @property(Node) public btnChooseSeaweed: Node = null;
    @property(Node) public btnClose: Node = null;

    private areaType: string = "";
    private currentStep: string = "";

    public init(data: any) {
        // =========================================================
        // 【核心修复】：取消之前所有的定时器！
        // 防止同一个玩家连续结算两个槽位时，上一个槽位的 1.5秒定时销毁任务把新的界面误杀！
        // =========================================================
        this.unscheduleAllCallbacks();

        this.areaType = data.areaType;
        const actionCount = data.actionCount || 0;
        this.currentStep = data.step || 'waiting_confirm';

        const areaNames: any = {
            'shrimp_catching': '🦐 捕虾区',
            'seafood_market': '🐟 海鲜市场',
            'breeding': '🧪 养蛊区',
            'tribute': '⛩️ 上供区',
            'marketplace': '🏮 闹市区'
        };

        this.titleLabel.string = `${areaNames[this.areaType] || this.areaType} 结算`;
        this.descLabel.string = `剩余操作次数：${actionCount}`;

        if (data.lastResult) {
            this.resultLabel.string = `🎉 上一步结果：${data.lastResult}`;
        } else {
            this.resultLabel.string = "请开始你的操作";
        }

        // 先把所有按钮隐藏
        if (this.btnConfirm) this.btnConfirm.active = false;
        if (this.btnChooseLobster) this.btnChooseLobster.active = false;
        if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = false;
        if (this.btnClose) this.btnClose.active = false;

        // 根据步骤展示对应按钮
        if (this.currentStep === 'waiting_confirm') {
            this.descLabel.string += "\n\n👉 点击下方按钮进行抽取！";
            if (this.btnConfirm) this.btnConfirm.active = true;
        }
        else if (this.currentStep === 'waiting_choice') {
            this.descLabel.string += "\n\n🎁 抽到了【龙虾或海草】！请选择：";
            if (this.btnChooseLobster) this.btnChooseLobster.active = true;
            if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = true;
        }
        else if (this.currentStep === 'done') {
            this.descLabel.string = "✅ 该槽位操作完毕！(即将自动关闭)";
            // 触发 1.5 秒后关闭（如果是同一个人连着结算，这个定时器会在下一次 init 时被直接清除）
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 1.5);
        }
    }

    public onBtnConfirmClicked() {
        let serverActionType = 'execute';
        if (this.areaType === 'shrimp_catching') {
            serverActionType = 'confirm';
        }

        // 防连点：点击后立刻隐藏按钮
        if (this.btnConfirm) this.btnConfirm.active = false;

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: serverActionType, payload: {} }
        });
    }

    public onBtnChooseLobsterClicked() {
        if (this.btnChooseLobster) this.btnChooseLobster.active = false;
        if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = false;

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: 'choose_either', payload: { choice: 'lobster' } }
        });
    }

    public onBtnChooseSeaweedClicked() {
        if (this.btnChooseLobster) this.btnChooseLobster.active = false;
        if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = false;

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: 'choose_either', payload: { choice: 'seaweed' } }
        });
    }

    public onBtnCloseClicked() {
        this.node.destroy();
    }
}