import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

const GRADE_NAMES: any = { 'normal': '普虾', 'grade3': '三品', 'grade2': '二品', 'grade1': '一品', 'royal': '👑虾王' };
const GRADE_ORDER = ['normal', 'grade3', 'grade2', 'grade1', 'royal'];

@ccclass('BreedingPopup')
export class BreedingPopup extends Component {

    @property(Label) public actionCountLabel: Label = null;
    @property(Label) public resourceLabel: Label = null;
    @property(Label) public previewLabel: Label = null;

    @property(Node) public lobsterContainer: Node = null;
    @property(Node) public lobsterBtnTemplate: Node = null;

    @property(Node) public royalPanel: Node = null;
    @property(Node) public btnCostCage: Node = null;
    @property(Node) public btnCostCoin: Node = null;
    @property(Node) public btnRewardDe: Node = null;
    @property(Node) public btnRewardWang: Node = null;

    @property(Node) public titleContainer: Node = null;
    @property(Node) public titleBtnTemplate: Node = null;

    @property(Node) public btnToggleSeaweed: Node = null;
    @property(Button) public btnConfirm: Button = null;
    @property(Button) public btnSkip: Button = null;

    private rawData: any = null;
    private player: any = null;

    private selectedLobsterIndex: number = -1;
    private useSeaweed: boolean = false;
    private royalCost: 'cage' | 'coin' | null = null;
    private royalReward: 'de' | 'wang' | null = null;
    private selectedTitleId: string | null = null;

    private lobsterBtns: Node[] = [];
    private titleBtns: Node[] = [];

    public init(data: any) {
        this.rawData = data;
        this.player = data.player;
        this.node.active = true;

        this.selectedLobsterIndex = -1;
        this.useSeaweed = false;
        this.royalCost = null;
        this.royalReward = null;
        this.selectedTitleId = null;

        this.renderLobsterList();
        this.renderTitleList();
        this.refreshUI();
    }

    private renderLobsterList() {
        this.lobsterBtns.forEach(btn => btn.destroy());
        this.lobsterBtns = [];

        const lobsters = this.player.lobsters || [];
        for (let i = 0; i < lobsters.length; i++) {
            const lobster = lobsters[i];
            const btnNode = instantiate(this.lobsterBtnTemplate);
            btnNode.active = true;
            this.lobsterContainer.addChild(btnNode);

            const label = btnNode.getComponentInChildren(Label);
            if (label) label.string = GRADE_NAMES[lobster.grade] || lobster.grade;

            btnNode.on(Button.EventType.CLICK, () => {
                this.selectedLobsterIndex = i;
                this.refreshUI();
            }, this);

            this.lobsterBtns.push(btnNode);
        }
    }

    private renderTitleList() {
        this.titleBtns.forEach(btn => btn.destroy());
        this.titleBtns = [];

        const stateStr = cc.sys.localStorage.getItem('currentGameState');
        const gameState = stateStr ? JSON.parse(stateStr) : {};
        const availableTitles = gameState.gameTitleCards || [];

        for (let i = 0; i < availableTitles.length; i++) {
            const titleCard = availableTitles[i];
            const btnNode = instantiate(this.titleBtnTemplate);
            btnNode.active = true;
            this.titleContainer.addChild(btnNode);

            const label = btnNode.getComponentInChildren(Label);
            if (label) label.string = `[${titleCard.name}]`;

            btnNode.on(Button.EventType.CLICK, () => {
                this.selectedTitleId = titleCard.id;
                this.refreshUI();
            }, this);

            this.titleBtns.push(btnNode);
        }
    }

    private refreshUI() {
        this.actionCountLabel.string = `剩余操作次数：${this.rawData.actionCount}`;
        this.resourceLabel.string = `拥有: 💰${this.player.coins} 🌿${this.player.seaweed} 🛒${this.player.cages}`;

        this.lobsterBtns.forEach((btn, idx) => {
            btn.getComponent(Sprite).color = (idx === this.selectedLobsterIndex) ? new Color(100, 200, 100) : new Color(220, 220, 220);
        });

        const seaweedLabel = this.btnToggleSeaweed.getComponentInChildren(Label);
        if (seaweedLabel) {
            seaweedLabel.string = this.useSeaweed ? "🌿 海草跳阶: [开启]" : "🌿 海草跳阶: [关闭]";
        }
        this.btnToggleSeaweed.getComponent(Sprite).color = this.useSeaweed ? new Color(100, 200, 100) : new Color(220, 220, 220);

        let isTargetRoyal = false;
        let canConfirm = false;
        let failReason = "";

        if (this.selectedLobsterIndex === -1) {
            this.previewLabel.string = "请先在上方选择一只龙虾";
            this.royalPanel.active = false;
        } else {
            const lobster = this.player.lobsters[this.selectedLobsterIndex];
            const currentGrade = lobster.grade;

            let gradeIdx = GRADE_ORDER.indexOf(currentGrade);
            let jump = this.useSeaweed ? 2 : 1;
            let targetIdx = Math.min(gradeIdx + jump, GRADE_ORDER.length - 1);
            let targetGrade = GRADE_ORDER[targetIdx];

            this.previewLabel.string = `预测: ${GRADE_NAMES[currentGrade]} ➡️ ${GRADE_NAMES[targetGrade]}`;
            isTargetRoyal = (currentGrade !== 'royal' && targetGrade === 'royal');

            if (this.useSeaweed && this.player.seaweed < 1) {
                failReason = "海草数量不足";
            } else {
                canConfirm = true;
            }
        }

        this.royalPanel.active = isTargetRoyal;
        if (isTargetRoyal) {
            this.btnCostCage.getComponent(Sprite).color = (this.royalCost === 'cage') ? new Color(255, 150, 50) : new Color(220, 220, 220);
            this.btnCostCoin.getComponent(Sprite).color = (this.royalCost === 'coin') ? new Color(255, 150, 50) : new Color(220, 220, 220);
            this.btnRewardDe.getComponent(Sprite).color = (this.royalReward === 'de') ? new Color(100, 200, 255) : new Color(220, 220, 220);
            this.btnRewardWang.getComponent(Sprite).color = (this.royalReward === 'wang') ? new Color(100, 200, 255) : new Color(220, 220, 220);

            this.titleBtns.forEach((btn, idx) => {
                const stateStr = cc.sys.localStorage.getItem('currentGameState');
                const titles = stateStr ? JSON.parse(stateStr).gameTitleCards : [];
                const tId = titles[idx]?.id;
                btn.getComponent(Sprite).color = (tId === this.selectedTitleId) ? new Color(255, 215, 0) : new Color(220, 220, 220);
            });

            if (!this.royalCost) failReason = "请选择册封消耗";
            else if (this.royalCost === 'cage' && this.player.cages < 1) failReason = "虾笼不足(需1个)";
            else if (this.royalCost === 'coin' && this.player.coins < 3) failReason = "金币不足(需3枚)";
            else if (!this.royalReward) failReason = "请选择册封奖励";
            else if (!this.selectedTitleId) failReason = "请选择虾王称号";
            else canConfirm = true;

            if (failReason) canConfirm = false;
        }

        this.btnConfirm.interactable = canConfirm;
        if (!canConfirm && this.selectedLobsterIndex !== -1) {
            this.previewLabel.string += `\n(⚠️ ${failReason})`;
        }
    }

    public onBtnToggleSeaweedClicked() {
        this.useSeaweed = !this.useSeaweed;
        this.refreshUI();
    }

    public onBtnCostCageClicked() { this.royalCost = 'cage'; this.refreshUI(); }
    public onBtnCostCoinClicked() { this.royalCost = 'coin'; this.refreshUI(); }
    public onBtnRewardDeClicked() { this.royalReward = 'de'; this.refreshUI(); }
    public onBtnRewardWangClicked() { this.royalReward = 'wang'; this.refreshUI(); }

    public onBtnConfirmClicked() {
        this.btnConfirm.interactable = false;
        this.btnSkip.interactable = false;

        // ========================================================
        // 【终极修复】：给数据再套一层 payload 外壳，彻底杜绝 actionType 被覆盖！
        // 这样发给后台解析出来的 actionType 才能精准识别为 'areaAction'
        // ========================================================
        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: {
                actionType: 'cultivateLobster',
                payload: {
                    lobsterIndex: this.selectedLobsterIndex,
                    useSeaweed: this.useSeaweed,
                    royalCostType: this.royalCost,
                    royalRewardType: this.royalReward,
                    selectedTitleId: this.selectedTitleId
                }
            }
        });
    }

    public onBtnSkipClicked() {
        this.btnConfirm.interactable = false;
        this.btnSkip.interactable = false;
        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: 'skip', payload: {} }
        });
    }
}