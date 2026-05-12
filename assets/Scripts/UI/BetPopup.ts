import { _decorator, Component, Label, Button, Node, EditBox, Sprite, Color } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { GRADE_NAMES } from '../Data/GameConstants';
const { ccclass, property } = _decorator;

@ccclass('BetPopup')
export class BetPopup extends Component {
    @property(Label) public titleLabel: Label = null;
    @property(Label) public challengerNameLabel: Label = null;
    @property(Label) public challengerLobsterLabel: Label = null;
    @property(Label) public defenderNameLabel: Label = null;
    @property(Label) public defenderLobsterLabel: Label = null;
    @property(Label) public myCoinsLabel: Label = null;
    @property(Label) public hintLabel: Label = null;
    @property(EditBox) public betAmountInput: EditBox = null;
    @property(Button) public btnBetChallenger: Button = null;
    @property(Button) public btnBetDefender: Button = null;
    @property(Button) public btnConfirm: Button = null;

    private localPlayerId: number = -1;
    private betData: any = null;
    private selectedTarget: number = -1;
    private betAmount: number = 0;
    private myCoins: number = 0;

    public init(data: any) {
        const stateStr = cc.sys.localStorage.getItem('localPlayerId');
        this.localPlayerId = stateStr ? parseInt(stateStr) : -1;

        this.betData = data;
        this.selectedTarget = -1;
        this.betAmount = 0;

        const gameStateStr = cc.sys.localStorage.getItem('currentGameState');
        const gameState = gameStateStr ? JSON.parse(gameStateStr) : null;
        const me = gameState?.players.find((p: any) => p.id === this.localPlayerId);
        this.myCoins = me?.coins || 0;

        if (this.titleLabel) this.titleLabel.string = '竞技场下注';
        if (this.challengerNameLabel) this.challengerNameLabel.string = `${data.challengerName} (挑战方)`;
        if (this.challengerLobsterLabel) {
            const cLob = data.challengerLobster;
            this.challengerLobsterLabel.string = `${cLob?.name || GRADE_NAMES[cLob?.grade] || '龙虾'} (${cLob?.grade || ''})`;
        }
        if (this.defenderNameLabel) this.defenderNameLabel.string = `${data.defenderName} (防守方)`;
        if (this.defenderLobsterLabel) {
            const dLob = data.defenderLobster;
            this.defenderLobsterLabel.string = `${dLob?.name || GRADE_NAMES[dLob?.grade] || '龙虾'} (${dLob?.grade || ''})`;
        }
        if (this.myCoinsLabel) this.myCoinsLabel.string = `你的金币: ${this.myCoins}`;
        if (this.hintLabel) this.hintLabel.string = '请选择押注方和金额';
        if (this.betAmountInput) {
            this.betAmountInput.string = '0';
            this.betAmountInput.maxLength = 10;
        }

        this.updateButtonStates();
    }

    private updateButtonStates() {
        if (this.btnBetChallenger) {
            const lbl = this.btnBetChallenger.node.getComponentInChildren(Label);
            if (lbl) lbl.string = `押挑战方`;
            const spr = this.btnBetChallenger.node.getComponent(Sprite);
            if (spr) spr.color = this.selectedTarget === this.betData?.challengerId ? new Color(255, 100, 100) : new Color(220, 240, 255);
        }
        if (this.btnBetDefender) {
            const lbl = this.btnBetDefender.node.getComponentInChildren(Label);
            if (lbl) lbl.string = `押防守方`;
            const spr = this.btnBetDefender.node.getComponent(Sprite);
            if (spr) spr.color = this.selectedTarget === this.betData?.defenderId ? new Color(255, 100, 100) : new Color(220, 240, 255);
        }

        if (this.btnConfirm) {
            const lbl = this.btnConfirm.node.getComponentInChildren(Label);
            if (lbl) {
                lbl.string = this.betAmount === 0 ? '跳过下注' : '确认下注';
            }
            this.btnConfirm.interactable = true;
        }
    }

    public onBtnBetChallengerClicked() {
        this.selectedTarget = this.betData.challengerId;
        this.validateAndShowHint();
        this.updateButtonStates();
    }

    public onBtnBetDefenderClicked() {
        this.selectedTarget = this.betData.defenderId;
        this.validateAndShowHint();
        this.updateButtonStates();
    }

    private validateAndShowHint() {
        const inputVal = parseInt(this.betAmountInput?.string || '0');
        if (isNaN(inputVal) || inputVal < 0) {
            if (this.hintLabel) this.hintLabel.string = '请输入有效的下注金额';
            return;
        }
        if (inputVal > this.myCoins) {
            if (this.hintLabel) this.hintLabel.string = `下注金额不能超过你的金币(${this.myCoins})`;
            return;
        }
        this.betAmount = inputVal;
        const targetName = this.selectedTarget === this.betData.challengerId ? this.betData.challengerName : this.betData.defenderName;
        if (this.hintLabel) {
            if (this.betAmount === 0) {
                this.hintLabel.string = `选择押注【${targetName}】，下注金额为0，点击跳过下注`;
            } else {
                this.hintLabel.string = `押注 ${this.betAmount} 金币给【${targetName}】，点击确认下注`;
            }
        }
        this.updateButtonStates();
    }

    public onBtnConfirmClicked() {
        if (!this.btnConfirm) return;
        this.btnConfirm.interactable = false;

        const inputVal = parseInt(this.betAmountInput?.string || '0');
        this.betAmount = isNaN(inputVal) ? 0 : inputVal;

        NetworkManager.instance.send('clientBattleAction', 'spectator_bet', {
            battleId: this.betData.battleId,
            betAmount: this.betAmount,
            betTarget: this.selectedTarget
        });

        if (this.hintLabel) this.hintLabel.string = '已提交下注，等待其他玩家...';
        if (this.betAmountInput) this.betAmountInput.node.active = false;
        if (this.btnBetChallenger) this.btnBetChallenger.node.active = false;
        if (this.btnBetDefender) this.btnBetDefender.node.active = false;
    }
}