import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

import { GRADE_NAMES, GRADE_ORDER } from '../Data/GameConstants';

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

    // 新增：判断是否全满级
    private hasUpgradeable: boolean = false;

    public init(data: any) {
        this.rawData = data;
        this.player = data.player;
        this.node.active = true;

        this.selectedLobsterIndex = -1;
        this.useSeaweed = false;
        this.royalCost = null;
        this.royalReward = null;
        this.selectedTitleId = null;
        this.hasUpgradeable = false;

        // 【核心修复1】：不论什么情况，跳过按钮在初始化时永远保持可点击状态！
        if (this.btnSkip) this.btnSkip.interactable = true;

        this.renderLobsterList();
        this.renderTitleList();
        this.refreshUI();
    }

    private renderLobsterList() {
        this.lobsterBtns.forEach(btn => btn.destroy());
        this.lobsterBtns = [];
        this.hasUpgradeable = false;

        const lobsters = this.player.lobsters || [];
        for (let i = 0; i < lobsters.length; i++) {
            const lobster = lobsters[i];
            const btnNode = instantiate(this.lobsterBtnTemplate);
            btnNode.active = true;
            this.lobsterContainer.addChild(btnNode);

            const label = btnNode.getComponentInChildren(Label);

            if (lobster.grade === 'royal' || lobster.title || lobster.name === '长鳌虾' || lobster.name === '红头紫') {
                if (label) label.string = `👑${lobster.title || lobster.name || '虾王'}\n(已满级)`;
                const btn = btnNode.getComponent(Button);
                if (btn) btn.interactable = false; // 禁用按钮
                btnNode.getComponent(Sprite).color = new Color(150, 150, 150); // 变灰
            } else {
                this.hasUpgradeable = true; // 存在可升级的龙虾
                if (label) label.string = GRADE_NAMES[lobster.grade] || lobster.grade;
                btnNode.on(Button.EventType.CLICK, () => {
                    this.selectedLobsterIndex = i;
                    this.refreshUI();
                }, this);
            }

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

        // 【核心修复2】：全满级时的专属友好提示
        if (!this.hasUpgradeable) {
            this.previewLabel.string = "🎉 你的所有龙虾都已满级，无可培养，请点击【跳过此行动】！";
            this.btnConfirm.interactable = false;
            this.royalPanel.active = false;
            if (this.titleContainer) this.titleContainer.active = false;
            if (this.btnToggleSeaweed) this.btnToggleSeaweed.interactable = false;
            return;
        }

        this.lobsterBtns.forEach((btn, idx) => {
            const interactable = btn.getComponent(Button)?.interactable;
            if (interactable) {
                btn.getComponent(Sprite).color = (idx === this.selectedLobsterIndex) ? new Color(100, 200, 100) : new Color(220, 220, 220);
            }
        });

        let isTargetRoyal = false;
        let canConfirm = false;
        let failReason = "";

        if (this.selectedLobsterIndex === -1) {
            this.previewLabel.string = "请先在上方选择一只龙虾";
            this.royalPanel.active = false;
            if (this.titleContainer) this.titleContainer.active = false;

            this.btnToggleSeaweed.interactable = false;
            this.btnToggleSeaweed.getComponent(Sprite).color = new Color(150, 150, 150);
            const swLabel = this.btnToggleSeaweed.getComponentInChildren(Label);
            if (swLabel) swLabel.string = "🌿 海草跳阶: [请先选虾]";

        } else {
            const lobster = this.player.lobsters[this.selectedLobsterIndex];
            const currentGrade = lobster.grade;

            if (currentGrade === 'royal') {
                failReason = "虾王已达最高品级，无法继续培养";
                canConfirm = false;
                this.useSeaweed = false;
                this.btnToggleSeaweed.interactable = false;
            } else {
                const canUseSeaweed = (currentGrade !== 'grade1');
                this.btnToggleSeaweed.interactable = canUseSeaweed;

                if (!canUseSeaweed && this.useSeaweed) {
                    this.useSeaweed = false;
                }

                const seaweedLabel = this.btnToggleSeaweed.getComponentInChildren(Label);
                if (seaweedLabel) {
                    if (!canUseSeaweed) seaweedLabel.string = "🌿 海草跳阶: [当前品级无需使用]";
                    else seaweedLabel.string = this.useSeaweed ? "🌿 海草跳阶: [开启]" : "🌿 海草跳阶: [关闭]";
                }
                this.btnToggleSeaweed.getComponent(Sprite).color = (!canUseSeaweed) ? new Color(150, 150, 150) : (this.useSeaweed ? new Color(100, 200, 100) : new Color(220, 220, 220));

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
        }

        this.royalPanel.active = isTargetRoyal;
        if (this.titleContainer) {
            this.titleContainer.active = isTargetRoyal;
        }

        if (!isTargetRoyal) {
            this.selectedTitleId = null;
        }

        if (isTargetRoyal) {
            this.btnCostCage.getComponent(Sprite).color = (this.royalCost === 'cage') ? new Color(255, 150, 50) : new Color(220, 220, 220);
            this.btnCostCoin.getComponent(Sprite).color = (this.royalCost === 'coin') ? new Color(255, 150, 50) : new Color(220, 220, 220);
            this.btnRewardDe.getComponent(Sprite).color = (this.royalReward === 'de') ? new Color(100, 200, 255) : new Color(220, 220, 220);
            this.btnRewardWang.getComponent(Sprite).color = (this.royalReward === 'wang') ? new Color(100, 200, 255) : new Color(220, 220, 220);

            const stateStr = cc.sys.localStorage.getItem('currentGameState');
            const titles = stateStr ? JSON.parse(stateStr).gameTitleCards || [] : [];
            const hasTitles = titles.length > 0;

            this.titleBtns.forEach((btn, idx) => {
                const tId = titles[idx]?.id;
                btn.getComponent(Sprite).color = (tId === this.selectedTitleId) ? new Color(255, 215, 0) : new Color(220, 220, 220);
            });

            if (!this.royalCost) failReason = "请选择册封消耗";
            else if (this.royalCost === 'cage' && this.player.cages < 1) failReason = "虾笼不足(需1个)";
            else if (this.royalCost === 'coin' && this.player.coins < 3) failReason = "金币不足(需3枚)";
            else if (!this.royalReward) failReason = "请选择册封奖励";
            else if (hasTitles && !this.selectedTitleId) failReason = "请选择虾王称号";
            else canConfirm = true;

            if (failReason) canConfirm = false;
        }

        // ======================================================
        // 【核心修复3】：本地强制阻断，绝不发导致死锁的包！
        // ======================================================
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
        // 在发包的最后防线，再次验证是否满足条件
        if (!this.btnConfirm.interactable) return;

        this.btnConfirm.interactable = false;
        this.btnSkip.interactable = false;

        if (this.selectedTitleId) {
            const stateStr = cc.sys.localStorage.getItem('currentGameState');
            if (stateStr) {
                const gameState = JSON.parse(stateStr);
                if (gameState.gameTitleCards) {
                    gameState.gameTitleCards = gameState.gameTitleCards.filter((t: any) => t.id !== this.selectedTitleId);
                    cc.sys.localStorage.setItem('currentGameState', JSON.stringify(gameState));
                }
            }
        }

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