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
    private lastActionCount: number = 0; // 记录剩余次数，用于预判关闭

    public init(data: any) {
        this.areaType = data.areaType;
        this.lastActionCount = data.actionCount || 0;
        this.currentStep = data.step || 'waiting_confirm';

        const areaNames: any = {
            'shrimp_catching': '🦐 捕虾区',
            'seafood_market': '🐟 海鲜市场',
            'breeding': '🧪 养蛊区',
            'tribute': '⛩️ 上供区',
            'marketplace': '🏮 闹市区'
        };

        this.titleLabel.string = `${areaNames[this.areaType] || this.areaType} 结算`;
        this.descLabel.string = `剩余操作次数：${this.lastActionCount}`;

        if (data.lastResult) {
            this.resultLabel.string = `🎉 上一步结果：${data.lastResult}`;
        } else {
            this.resultLabel.string = "请开始你的操作";
        }

        this.hideAllButtons();

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
            this.showDoneAndClose();
        }
    }

    private hideAllButtons() {
        if (this.btnConfirm) this.btnConfirm.active = false;
        if (this.btnChooseLobster) this.btnChooseLobster.active = false;
        if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = false;
        if (this.btnClose) this.btnClose.active = false;
    }

    private showDoneAndClose() {
        this.descLabel.string = "✅ 该槽位操作完毕！(即将自动关闭)";
        this.hideAllButtons();
        // 延迟自动销毁
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 1.5);
    }

    public onBtnConfirmClicked() {
        if (this.btnConfirm) this.btnConfirm.active = false;
        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: 'confirm', payload: {} }
        });
    }

    public onBtnChooseLobsterClicked() {
        this.handleChoice('lobster');
    }

    public onBtnChooseSeaweedClicked() {
        this.handleChoice('seaweed');
    }

    private handleChoice(choice: string) {
        if (this.btnChooseLobster) this.btnChooseLobster.active = false;
        if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = false;

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: 'choose_either', payload: { choice: choice } }
        });

        // 【核心修复】：由于后端在二选一结束后不发 step: done，前端在此主动预判
        if (this.lastActionCount <= 1) {
            console.log("前端预判：最后一次二选一完成，准备关闭弹窗");
            this.resultLabel.string = `🎉 已选择: ${choice === 'lobster' ? '龙虾' : '海草'}`;
            this.showDoneAndClose();
        }
    }
}