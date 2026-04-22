import { _decorator, Component, Label, Button, Node, instantiate, Sprite, tween, Vec3, RichText, ScrollView, Color, UIOpacity, UITransform, resources, SpriteFrame } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('BattlePopup')
export class BattlePopup extends Component {
    @property(Label) public titleLabel: Label = null;
    @property(Label) public statusLabel: Label = null;

    @property(Label) public leftNameLabel: Label = null;
    @property(Label) public leftLobsterLabel: Label = null;
    @property(Label) public leftDmgLabel: Label = null;
    @property(Label) public leftCritLabel: Label = null;
    @property(Sprite) public leftDiceNode: Sprite = null;
    @property(Node) public leftCardContainer: Node = null;

    @property(Label) public rightNameLabel: Label = null;
    @property(Label) public rightLobsterLabel: Label = null;
    @property(Label) public rightDmgLabel: Label = null;
    @property(Label) public rightCritLabel: Label = null;
    @property(Sprite) public rightDiceNode: Sprite = null;
    @property(Node) public rightCardContainer: Node = null;

    @property(Node) public hpCardTemplate: Node = null;

    @property(Button) public btnRoll: Button = null;
    @property(Button) public btnEatWeed: Button = null;
    @property(Button) public btnSkipWeed: Button = null;
    @property(Button) public btnDrawHP: Button = null;

    @property(ScrollView) public logScrollView: ScrollView = null;
    @property(RichText) public logText: RichText = null;

    // 【新增】：奖励面板槽位
    @property(Node) public rewardNode: Node = null;

    private battleData: any = null;
    private localPlayerId: number = -1;
    private lastProcessedLog: string = "";
    private localCritCount: number = 0;

    public init(data: any) {
        this.battleData = data;
        const stateStr = cc.sys.localStorage.getItem('localPlayerId');
        this.localPlayerId = stateStr ? parseInt(stateStr) : -1;

        this.node.active = true;
        this.logText.string = "";
        this.localCritCount = 0;

        if (this.rewardNode) this.rewardNode.active = false;

        const slotNum = data.defenderSlotIndex + 1;
        if (this.titleLabel) this.titleLabel.string = `⚔️ 争夺 [${slotNum}号] 槽位决战 ⚔️`;

        this.addLog(`🔥 战斗开始！防守方【${data.p1.name}】先进行起步判定！`);
        this.refreshUI();
    }

    public updateBattleState(newState: any) {
        this.battleData = newState;

        if (newState.lastLog && newState.lastLog !== this.lastProcessedLog) {
            this.addLog(newState.lastLog);
            this.lastProcessedLog = newState.lastLog;
        }

        if (newState.critCount > this.localCritCount) {
            this.localCritCount = newState.critCount;
            this.showCritAnimation();
        }

        if (newState.phase === 'show_hp_result') {
            this.playCardFlipAnim(newState.targetPlayerId, newState.lastHpDraws, () => {
                setTimeout(() => {
                    NetworkManager.instance.send('clientBattleAction', 'battleAction', {
                        actionType: 'confirm_hp_result'
                    });
                }, 1500);
            });
        }

        this.refreshUI();
    }

    private refreshUI() {
        const p1 = this.battleData.p1;
        const p2 = this.battleData.p2;
        const currentPhase = this.battleData.phase;
        const activePlayerId = this.battleData.activePlayerId;

        this.leftNameLabel.string = `🛡️ ${p1.name} (防守方)`;
        this.leftLobsterLabel.string = `${p1.lobsterName} (${p1.diceType}面骰)`;
        this.leftDmgLabel.string = `累计受伤: ${p1.dmgTaken}`;
        this.leftCritLabel.string = `暴击率: ${Math.min(100, p1.dmgTaken * 20)}%`;

        this.rightNameLabel.string = `⚔️ ${p2.name} (挑战方)`;
        this.rightLobsterLabel.string = `${p2.lobsterName} (${p2.diceType}面骰)`;
        this.rightDmgLabel.string = `累计受伤: ${p2.dmgTaken}`;
        this.rightCritLabel.string = `暴击率: ${Math.min(100, p2.dmgTaken * 20)}%`;

        if (this.leftDiceNode) {
            this.setDiceImage(this.leftDiceNode, p1.diceType);
        }
        if (this.rightDiceNode) {
            this.setDiceImage(this.rightDiceNode, p2.diceType);
        }

        this.btnRoll.node.active = false;
        this.btnEatWeed.node.active = false;
        this.btnSkipWeed.node.active = false;
        this.btnDrawHP.node.active = false;

        const isMyTurn = (activePlayerId === this.localPlayerId);
        const isTargetTurn = (this.battleData.targetPlayerId === this.localPlayerId);

        if (currentPhase !== 'hp_draw' && currentPhase !== 'show_hp_result') {
            this.leftCardContainer.removeAllChildren();
            this.rightCardContainer.removeAllChildren();
        }

        // ==========================================
        // 【核心修复】：奖励选择界面的渲染
        // ==========================================
        if (currentPhase === 'reward_choice') {
            this.statusLabel.string = "🏆 战斗结束！等待胜者选择奖励...";
            if (this.localPlayerId === this.battleData.winnerId && this.rewardNode) {
                this.rewardNode.active = true;
                const myData = (p1.id === this.localPlayerId) ? p1 : p2;
                const btnUpgrade = this.rewardNode.getChildByName('BtnUpgrade')?.getComponent(Button);
                if (btnUpgrade) {
                    if (myData.lobsterGrade === 'royal' || myData.lobsterGrade === '虾王' || myData.lobsterGrade === '长鳌虾' || myData.lobsterGrade === '红头紫') {
                        btnUpgrade.interactable = false;
                        const lbl = btnUpgrade.node.getComponentInChildren(Label);
                        if (lbl) lbl.string = "已是满级(不可升)";
                    } else {
                        btnUpgrade.interactable = true;
                        const lbl = btnUpgrade.node.getComponentInChildren(Label);
                        if (lbl) lbl.string = "出战龙虾升1品";
                    }
                }
            }
        } else {
            if (this.rewardNode) this.rewardNode.active = false;
        }

        switch (currentPhase) {
            case 'enrage_roll':
                this.statusLabel.string = isMyTurn ? "👉 你的回合：请掷骰子进行【狂暴起步】判定 (>=6点)" : "等待对方进行狂暴判定...";
                if (isMyTurn) this.btnRoll.node.active = true;
                break;
            case 'attack_roll':
                this.statusLabel.string = isMyTurn ? "👉 你的回合：请掷骰子进行【攻击】！" : "等待对方攻击掷骰...";
                if (isMyTurn) this.btnRoll.node.active = true;
                break;
            case 'seaweed_choice':
                this.statusLabel.string = isMyTurn ? `👉 是否消耗海草增加点数？(当前掷出:${this.battleData.currentRoll}点)` : "等待对方决定是否吃草...";
                if (isMyTurn) {
                    this.btnEatWeed.node.active = true;
                    this.btnSkipWeed.node.active = true;
                    const myData = (p1.id === this.localPlayerId) ? p1 : p2;
                    if (myData.seaweed <= 0 || myData.lobsterGrade === 'grade3') {
                        this.btnEatWeed.interactable = false;
                    } else {
                        this.btnEatWeed.interactable = true;
                    }
                }
                break;
            case 'hp_draw':
                this.statusLabel.string = isTargetTurn ? "😨 受到猛攻！请立刻抽取血量卡判定生死！" : "等待受击方抽取血量卡...";
                if (isTargetTurn) this.btnDrawHP.node.active = true;
                this.renderHPCards(this.battleData.targetPlayerId, this.battleData.requiredHPCards);
                break;
        }
    }

    private renderHPCards(targetId: number, count: number) {
        this.leftCardContainer.removeAllChildren();
        this.rightCardContainer.removeAllChildren();

        const container = (targetId === this.battleData.p1.id) ? this.leftCardContainer : this.rightCardContainer;

        for (let i = 0; i < count; i++) {
            const card = instantiate(this.hpCardTemplate);
            card.active = true;
            container.addChild(card);

            const labels = card.getComponentsInChildren(Label);
            labels.forEach(l => l.string = "？血");
        }
    }

    public playCardFlipAnim(targetId: number, hpValues: number[], callback: Function) {
        const container = (targetId === this.battleData.p1.id) ? this.leftCardContainer : this.rightCardContainer;
        const cards = container.children;

        let completedCount = 0;
        if (cards.length === 0 || !hpValues || hpValues.length === 0) {
            callback();
            return;
        }

        for (let i = 0; i < cards.length; i++) {
            if (hpValues[i] === undefined) {
                completedCount++;
                if (completedCount === cards.length) callback();
                continue;
            }
            const card = cards[i];
            const labels = card.getComponentsInChildren(Label);
            let targetLabel = card.getChildByName('CardBloodLabel')?.getComponent(Label);
            if (!targetLabel && labels.length > 0) targetLabel = labels[0];

            tween(card)
                .to(0.2, { scale: new Vec3(0, 1, 1) })
                .call(() => {
                    if (targetLabel) {
                        targetLabel.string = `${hpValues[i]}血`;
                        targetLabel.color = new Color(255, 50, 50);
                    }
                })
                .to(0.2, { scale: new Vec3(1, 1, 1) })
                .call(() => {
                    completedCount++;
                    if (completedCount === cards.length) callback();
                })
                .start();
        }
    }

    private showCritAnimation() {
        const critNode = new Node("CritNode");
        const label = critNode.addComponent(Label);
        label.string = "💥 暴击!!";
        label.color = new Color(255, 50, 50);
        label.fontSize = 50;
        label.isBold = true;

        const uiOp = critNode.addComponent(UIOpacity);
        this.node.addChild(critNode);
        critNode.setPosition(0, 0, 0);

        tween(critNode)
            .to(0.2, { scale: new Vec3(1.5, 1.5, 1) })
            .to(0.1, { scale: new Vec3(1.2, 1.2, 1) })
            .delay(0.8)
            .to(0.5, { position: new Vec3(0, 150, 0) })
            .call(() => critNode.destroy())
            .start();

        tween(uiOp).delay(1.0).to(0.5, { opacity: 0 }).start();
    }

    private setDiceImage(diceNode: Sprite, diceType: number) {
        const imagePath = `dice_d${diceType}/spriteFrame`;
        resources.load(imagePath, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                console.error(`[BattlePopup] Failed to load ${imagePath}:`, err);
                return;
            }
            if (diceNode) {
                diceNode.spriteFrame = spriteFrame;
            }
        });
    }

    private addLog(msg: string) {
        const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.logText.string = `<color=#ffcc00>[${timeStr}]</color> ${msg}<br/>\n` + this.logText.string;

        this.scheduleOnce(() => {
            if (this.logText && this.logScrollView && this.logScrollView.content) {
                const rtTrans = this.logText.getComponent(UITransform);
                const contentTrans = this.logScrollView.content.getComponent(UITransform);

                if (rtTrans && contentTrans) {
                    contentTrans.height = Math.max(350, rtTrans.height + 20);
                }
                this.logScrollView.scrollToTop(0.1, true);
            }
        }, 0.05);
    }

    // ==========================================
    // 按钮事件绑定
    // ==========================================
    public onBtnRollClicked() {
        this.btnRoll.node.active = false;
        NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'roll_dice' });
    }

    public onBtnEatWeedClicked() {
        this.btnEatWeed.node.active = false;
        this.btnSkipWeed.node.active = false;
        NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'seaweed_choice', useSeaweed: true });
    }

    public onBtnSkipWeedClicked() {
        this.btnEatWeed.node.active = false;
        this.btnSkipWeed.node.active = false;
        NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'seaweed_choice', useSeaweed: false });
    }

    public onBtnDrawHPClicked() {
        this.btnDrawHP.node.active = false;
        NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'draw_hp' });
    }

    // 【新增】：领取奖励按钮事件
    public onBtnRewardUpgradeClicked() {
        if (this.rewardNode) this.rewardNode.active = false;
        NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'claim_battle_reward', rewardType: 'upgrade' });
    }

    public onBtnRewardCoinsClicked() {
        if (this.rewardNode) this.rewardNode.active = false;
        NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'claim_battle_reward', rewardType: 'coins' });
    }
}