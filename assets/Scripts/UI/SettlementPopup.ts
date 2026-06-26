import { _decorator, Component, Label, Node, Button } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('SettlementPopup')
export class SettlementPopup extends Component {

    @property(Label) public titleLabel: Label = null;
    @property(Label) public descLabel: Label = null;
    @property(Label) public resultLabel: Label = null;
    @property(Label) public loadingLabel: Label = null!

    @property(Node) public btnConfirm: Node = null;
    @property(Node) public btnChooseLobster: Node = null;
    @property(Node) public btnChooseSeaweed: Node = null;
    @property(Node) public btnClose: Node = null;

    private areaType: string = "";
    private currentStep: string = "";
    private isWaitingResponse: boolean = false;
    private pendingAction: { actionType: string, payload: any } | null = null;
    private loadingTimer: number = null;
    private lastClickTime: number = 0;

    public init(data: any) {
        this.unscheduleAllCallbacks();
        this._clearLoadingTimer();
        this.isWaitingResponse = false;
        this.pendingAction = null;
        this.lastClickTime = 0;

        if (this.loadingLabel?.node) this.loadingLabel.active = false;

        this.areaType = data.areaType;
        const actionCount = data.actionCount || 0;
        this.currentStep = data.step || 'waiting_confirm';

        NetworkManager.instance.eventTarget.on('areaSettlementStart', this._onSettlementResponse, this);
        NetworkManager.instance.eventTarget.on('settlementComplete', this._onSettlementResponse, this);
        NetworkManager.instance.eventTarget.on('error', this._onError, this);

        const areaNames: any = {
            'shrimp_catching': '寻山访海',
            'seafood_market': '🐟 海鲜市场',
            'breeding': '🧪 养蛊区',
            'tribute': '⛩️ 上供区',
            'marketplace': '🏮 闹市区'
        };

        this.titleLabel.string = `${areaNames[this.areaType] || this.areaType}`;
        this.descLabel.string = `剩余操作次数：${actionCount}`;

        if (data.lastResult) {
            this.resultLabel.string = `上一步结果：${data.lastResult}`;
        } else {
            this.resultLabel.string = "请开始你的操作";
        }

        if (this.btnConfirm) this.btnConfirm.active = false;
        if (this.btnChooseLobster) this.btnChooseLobster.active = false;
        if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = false;
        if (this.btnClose) this.btnClose.active = false;

        if (this.currentStep === 'waiting_confirm') {
            // this.descLabel.string += "\n\n👉 点击下方按钮进行抽取！";
            if (this.btnConfirm) this.btnConfirm.active = true;
        }
        else if (this.currentStep === 'waiting_choice') {
            // this.descLabel.string += "\n\n🎁 抽到了【幼型灵螯或琅玕仙草】！请选择：";
            if (this.btnChooseLobster) this.btnChooseLobster.active = true;
            if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = true;
        }
        else if (this.currentStep === 'done') {
            this.descLabel.string = "✅ 该槽位操作完毕！(即将自动关闭)";
            this.scheduleOnce(() => {
                if (this.node && this.node.isValid) {
                    this.node.destroy();
                }
            }, 1.5);
        }
    }

    public initEndgameChoice(data: any) {
        this.unscheduleAllCallbacks();
        this._clearLoadingTimer();
        this.isWaitingResponse = false;
        this.pendingAction = null;

        if (this.loadingLabel?.node) this.loadingLabel.active = false;

        const card = data.card;
        const choices = data.choices || [];
        const resType = card.costResourceType === 'coins' ? '山海贝币' : '琅玕仙草';

        this.titleLabel.string = "🏁 终局得分选择";
        this.descLabel.string = `由于你拥有【${card.name}】，你可以消耗${resType}来换取额外的德/望奖励！`;
        this.resultLabel.string = "请选择一个方案：";

        if (this.btnConfirm) this.btnConfirm.active = false;
        if (this.btnChooseLobster) this.btnChooseLobster.active = false;
        if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = false;
        if (this.btnClose) this.btnClose.active = true;
        const closeLabel = this.btnClose.getComponentInChildren(Label);
        if (closeLabel) closeLabel.string = "放弃选择";

        // 检查玩家资源是否足够
        const gameState = NetworkManager.instance.getGameState();
        const pIdStr = cc.sys.localStorage.getItem('localPlayerId');
        const localPlayerId = pIdStr ? parseInt(pIdStr) : -1;
        const me = gameState?.players?.find((p: any) => p.id == localPlayerId);
        const currentResource = me ? (me[card.costResourceType] || 0) : 0;

        // 复用按钮显示 3 个选项
        const btnList = [this.btnConfirm, this.btnChooseLobster, this.btnChooseSeaweed];
        let hasAffordable = false;
        choices.forEach((choice: any, idx: number) => {
            if (idx < btnList.length) {
                const btn = btnList[idx];
                if (!btn || !btn.isValid) return;
                btn.active = true;
                const label = btn.getComponentInChildren(Label);
                if (label) {
                    label.string = `消耗 ${choice.cost}${resType} ➜ 奖励 ${choice.reward} 德/望`;
                }

                const canAfford = currentResource >= choice.cost;
                if (canAfford) hasAffordable = true;
                const btnComp = btn.getComponent(Button);
                if (btnComp) btnComp.interactable = canAfford;

                // 重新绑定点击事件
                btn.off(Node.EventType.TOUCH_END);
                btn.on(Node.EventType.TOUCH_END, () => {
                    this._sendEndgameChoice(idx);
                }, this);
            }
        });

        if (!hasAffordable && choices.length > 0) {
            this.resultLabel.string = `⚠️ 你的${resType}不足以支付任何选项，请点击"放弃选择"跳过`;
        }
    }

    private _sendEndgameChoice(idx: number) {
        if (this.isWaitingResponse) return;
        this.isWaitingResponse = true;

        if (this.loadingLabel?.node) {
            this.loadingLabel.string = "正在提交选择...";
            this.loadingLabel.active = true;
        }

        NetworkManager.instance.send('clientGameAction', 'endgameScoreChoice', {
            payload: { choiceIndex: idx }
        });

        // 提交后直接关闭，等待服务器状态同步（GameView 会处理后续）
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0.5);
    }

    public onBtnConfirmClicked() {
        let serverActionType = 'execute';
        if (this.areaType === 'shrimp_catching') {
            serverActionType = 'confirm';
        }

        this._sendWithRetry({ actionType: serverActionType, payload: {} });
    }

    public onBtnChooseLobsterClicked() {
        this._sendWithRetry({ actionType: 'choose_either', payload: { choice: 'lobster' } });
    }

    public onBtnChooseSeaweedClicked() {
        this._sendWithRetry({ actionType: 'choose_either', payload: { choice: 'seaweed' } });
    }

    public onBtnCloseClicked() {
        this._cleanup();
        this.node.destroy();
    }

    protected onDestroy() {
        this._cleanup();
    }

    private _sendWithRetry(action: { actionType: string, payload: any }) {
        if (this.isWaitingResponse) {
            return;
        }

        const now = Date.now();
        if (now - this.lastClickTime < 300) {
            return;
        }
        this.lastClickTime = now;

        this._startWaiting();
        this.pendingAction = action;

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: action
        });

        this.loadingTimer = setTimeout(() => {
            if (this.isWaitingResponse && this.pendingAction && this.node && this.node.isValid) {
                if (this.loadingLabel?.node) {
                    this.loadingLabel.string = "请求超时，点击重试";
                    this.loadingLabel.active = true;
                }
                if (this.btnClose) this.btnClose.active = true;
                this.isWaitingResponse = false;
            }
        }, 5000);
    }

    private _startWaiting() {
        this.isWaitingResponse = true;
        if (this.btnConfirm) this.btnConfirm.active = false;
        if (this.btnChooseLobster) this.btnChooseLobster.active = false;
        if (this.btnChooseSeaweed) this.btnChooseSeaweed.active = false;
        if (this.btnClose) this.btnClose.active = false;

        if (this.loadingLabel?.node) {
            this.loadingLabel.string = "等待服务器响应...";
            this.loadingLabel.active = true;
        }

        this.loadingTimer = setTimeout(() => {
            if (this.isWaitingResponse && this.pendingAction && this.node && this.node.isValid) {
                if (this.loadingLabel?.node) {
                    this.loadingLabel.string = "请求超时，点击重试";
                    this.loadingLabel.active = true;
                }
            }
        })
    }

    private _onSettlementResponse = (data: any) => {
        this._clearLoadingTimer();
        this.isWaitingResponse = false;
        this.pendingAction = null;
        if (this.loadingLabel?.node) this.loadingLabel.active = false;
    }

    private _onError = (data: any) => {
        if (data.code === 'DUPLICATE_REQUEST' && this.pendingAction && this.node && this.node.isValid) {
            this._clearLoadingTimer();

            setTimeout(() => {
                if (this.pendingAction && this.node && this.node.isValid) {
                    NetworkManager.instance.send('clientGameAction', 'areaAction', {
                        payload: this.pendingAction
                    });

                    this.loadingTimer = setTimeout(() => {
                        if (this.isWaitingResponse && this.pendingAction && this.node && this.node.isValid) {
                            if (this.loadingLabel?.node) {
                                this.loadingLabel.string = "请求超时，点击重试";
                                this.loadingLabel.active = true;
                            }
                            if (this.btnClose) this.btnClose.active = true;
                            this.isWaitingResponse = false;
                        }
                    }, 5000);
                }
            }, 600);
        }
    }

    private _clearLoadingTimer() {
        if (this.loadingTimer) {
            clearTimeout(this.loadingTimer);
            this.loadingTimer = null;
        }
    }

    private _cleanup() {
        this._clearLoadingTimer();
        this.isWaitingResponse = false;
        this.pendingAction = null;
        NetworkManager.instance.eventTarget.off('areaSettlementStart', this._onSettlementResponse, this);
        NetworkManager.instance.eventTarget.off('settlementComplete', this._onSettlementResponse, this);
        NetworkManager.instance.eventTarget.off('error', this._onError, this);
    }
}