import { _decorator, Component, Label, Button, Node, Sprite, tween, Vec3, RichText, ScrollView, Color, UIOpacity, UITransform, SpriteFrame, assetManager } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

@ccclass('BattlePopup')
export class BattlePopup extends Component {
    @property(Label) public titleLabel: Label = null;
    @property(Label) public statusLabel: Label = null;

    @property(Label) public leftNameLabel: Label = null;
    @property(Label) public leftLobsterSkillLabel: Label = null;
    @property(Label) public leftDmgLabel: Label = null;
    @property(Label) public leftCritLabel: Label = null;
    @property(Label) public leftLastHPLabel: Label = null; // 【新增】左侧当前血量文本

    @property(Label) public rightNameLabel: Label = null;
    @property(Label) public rightLobsterSkillLabel: Label = null;
    @property(Label) public rightDmgLabel: Label = null;
    @property(Label) public rightCritLabel: Label = null;
    @property(Label) public rightLastHPLabel: Label = null; // 【新增】右侧当前血量文本

    // 【修改】统管全局的唯一血量卡节点
    @property(Node) public hpCardNode: Node = null;

    @property(Button) public btnRoll: Button = null;
    @property(Sprite) public btnRollDiceSprite: Sprite = null; // 【新增】骰子按钮内的图片节点

    @property(Button) public btnEatWeed: Button = null;
    @property(Button) public btnSkipWeed: Button = null;
    @property(Button) public btnDrawHP: Button = null;

    @property(ScrollView) public logScrollView: ScrollView = null;
    @property(RichText) public logText: RichText = null;

    @property(Node) public rewardNode: Node = null;

    // ==========================================
    // 战斗动画相关节点绑定
    // ==========================================
    @property(Node) public leftLobsterNode: Node = null;  // 左侧灵螯本体节点 (需挂载Sprite)
    @property(Node) public rightLobsterNode: Node = null; // 右侧灵螯本体节点 (需挂载Sprite)
    @property(Sprite) public waveSprite: Sprite = null;
    @property(Sprite) public waveAtSprite: Sprite = null; // 【新增】光波溅射节点
    @property(Sprite) public leftShieldSprite: Sprite = null;
    @property(Sprite) public rightShieldSprite: Sprite = null;

    // 光波与护盾颜色配置 (对应等级 1-4)
    private waveColors: Color[] = [
        new Color(255, 255, 255, 255), // grade1
        new Color(255, 100, 100, 255), // grade2
        new Color(100, 100, 255, 255), // grade3
        new Color(100, 255, 100, 255)  // royal
    ];

    private shieldColors: Color[] = [
        new Color(200, 200, 200, 255), // grade1
        new Color(255, 150, 150, 255), // grade2
        new Color(150, 150, 255, 255), // grade3
        new Color(150, 255, 150, 255)  // royal
    ];

    private battleData: any = null;
    private localPlayerId: number = -1;
    private lastProcessedLog: string = "";
    private localCritCount: number = 0;
    private isSpectator: boolean = false;
    private isPlayingAttackAnim: boolean = false;

    public init(data: any) {
        this.battleData = data;
        const stateStr = cc.sys.localStorage.getItem('localPlayerId');
        this.localPlayerId = stateStr ? parseInt(stateStr) : -1;

        this.isSpectator = (this.localPlayerId !== data.p1.id && this.localPlayerId !== data.p2.id);

        this.node.active = true;
        this.logText.string = "";
        this.localCritCount = 0;
        this.isPlayingAttackAnim = false;

        if (this.rewardNode) this.rewardNode.active = false;

        // 初始化文本和隐藏独立血量卡
        if (this.leftLastHPLabel) this.leftLastHPLabel.string = "当前血量：0";
        if (this.rightLastHPLabel) this.rightLastHPLabel.string = "当前血量：0";
        if (this.hpCardNode) this.hpCardNode.active = false;

        // 初始化隐藏特效
        if(this.waveSprite) this.waveSprite.getComponent(UIOpacity)!.opacity = 0;
        if(this.waveAtSprite) this.waveAtSprite.getComponent(UIOpacity)!.opacity = 0;
        if(this.leftShieldSprite) this.leftShieldSprite.getComponent(UIOpacity)!.opacity = 0;
        if(this.rightShieldSprite) this.rightShieldSprite.getComponent(UIOpacity)!.opacity = 0;

        // 【新增】初始化时动态加载双方灵螯图片
        this.loadLobsterImages(data.p1, data.p2);

        const slotNum = data.defenderSlotIndex + 1;
        if (this.titleLabel) {
            this.titleLabel.string = this.isSpectator
                ? `观战模式 - 争夺 [${slotNum}号] 槽位决战`
                : `争夺 [${slotNum}号] 槽位决战`;
        }

        this.addLog(`战斗开始！防守方【${data.p1.name}】先进行起步判定！`);
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

        if (newState.phase === 'hp_draw' && !this.isPlayingAttackAnim) {
            this.isPlayingAttackAnim = true;
            this.executeAttackAnimation(newState.activePlayerId);
        }

        if (newState.phase === 'show_hp_result') {
            this.isPlayingAttackAnim = false;
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

    // ==========================================
    // 【新增】：动态加载图片核心方法
    // ==========================================
    private loadRemoteSpriteFrame(imagePath: string, spriteComp: Sprite) {
        if (!spriteComp) return;
        assetManager.loadBundle('remote_assets', (err, bundle) => {
            if (err) { console.error('[BattlePopup] Bundle加载失败:', err); return; }
            // 注意：Cocos 动态加载不需要加 .png 后缀
            bundle.load(`${imagePath}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
                if (err) { console.error(`[BattlePopup] 图片加载失败 ${imagePath}:`, err); return; }
                spriteComp.spriteFrame = spriteFrame;
            });
        });
    }

    private loadLobsterImages(p1: any, p2: any) {
        // 左边(防守方/玩家1出战)图集映射
        const leftMap: Record<string, string> = {
            'grade1': 'Images/settlement/battle/level2-left',
            'grade2': 'Images/settlement/battle/level3-left',
            'grade3': 'Images/settlement/battle/level4-left',
            'royal': 'Images/settlement/battle/level5-left'
        };

        // 右边(挑战方/玩家2出战)图集映射
        const rightMap: Record<string, string> = {
            'grade1': 'Images/settlement/breeding/【磐石玄甲螯】',
            'grade2': 'Images/settlement/breeding/【昆仑冰晶螯】',
            'grade3': 'Images/settlement/breeding/【祝融赤焰螯】',
            'royal': 'Images/settlement/breeding/【洪荒两仪·山海龙螯】'
        };

        const leftPath = leftMap[p1.lobsterGrade] || leftMap['grade1'];
        const rightPath = rightMap[p2.lobsterGrade] || rightMap['grade1'];

        this.loadRemoteSpriteFrame(leftPath, this.leftLobsterNode.getComponent(Sprite));
        this.loadRemoteSpriteFrame(rightPath, this.rightLobsterNode.getComponent(Sprite));
    }

    private updateActiveDiceImage(activePlayer: any) {
        // 动态更新骰子按钮里的骰子图片
        if (this.btnRollDiceSprite && activePlayer) {
            const dicePath = `Images/settlement/tribute/dice_d${activePlayer.diceType}`;
            this.loadRemoteSpriteFrame(dicePath, this.btnRollDiceSprite);
        }
    }

    // ==========================================
    // 【修改】：解耦动画表现 (含飞溅溅射)
    // ==========================================
    private executeAttackAnimation(attackerId: number) {
        const p1 = this.battleData.p1;
        const p2 = this.battleData.p2;

        const isLeftAttacking = (attackerId === p1.id);
        const attackerData = isLeftAttacking ? p1 : p2;
        const defenderData = isLeftAttacking ? p2 : p1;

        const attackerNode = isLeftAttacking ? this.leftLobsterNode : this.rightLobsterNode;
        const defenderNode = isLeftAttacking ? this.rightLobsterNode : this.leftLobsterNode;
        const targetShieldSprite = isLeftAttacking ? this.rightShieldSprite : this.leftShieldSprite;

        const getGradeIndex = (grade: string) => {
            if (grade === 'grade1') return 0;
            if (grade === 'grade2') return 1;
            if (grade === 'grade3') return 2;
            if (grade === 'royal') return 3;
            return 0;
        };

        const atkLv = getGradeIndex(attackerData.lobsterGrade);
        const defLv = getGradeIndex(defenderData.lobsterGrade);

        this.waveSprite.color = this.waveColors[atkLv];
        targetShieldSprite.color = this.shieldColors[defLv];

        const waveOpacity = this.waveSprite.getComponent(UIOpacity);
        const shieldOpacity = targetShieldSprite.getComponent(UIOpacity);
        const waveAtOpacity = this.waveAtSprite?.getComponent(UIOpacity);

        const startOffsetX = isLeftAttacking ? 50 : -50;
        const endOffsetX = isLeftAttacking ? -50 : 50;

        this.waveSprite.node.setPosition(attackerNode.position.x + startOffsetX, attackerNode.position.y, 0);
        this.waveSprite.node.setScale(new Vec3(isLeftAttacking ? 1 : -1, 1, 1));
        waveOpacity.opacity = 255;

        // 攻击者微动
        const atkStartPos = attackerNode.position.clone();
        tween(attackerNode)
            .by(0.1, { position: new Vec3(isLeftAttacking ? 20 : -20, 0, 0) })
            .to(0.2, { position: atkStartPos })
            .start();

        const targetPos = defenderNode.position;
        tween(this.waveSprite.node)
            .to(0.4, { position: new Vec3(targetPos.x + endOffsetX, targetPos.y, 0) })
            .call(() => {
                waveOpacity.opacity = 0;

                // 【新增】：触碰瞬间触发溅射效果
                if (waveAtOpacity) {
                    this.waveAtSprite.color = this.waveColors[atkLv]; // 溅射同色
                    this.waveAtSprite.node.setPosition(targetPos.x + endOffsetX, targetPos.y, 0);
                    // 如果从右往左打，溅射特效可能也需要翻转一下
                    this.waveAtSprite.node.setScale(new Vec3(isLeftAttacking ? 1 : -1, 1, 1));

                    waveAtOpacity.opacity = 255;
                    // 飞溅闪烁一下消失
                    tween(waveAtOpacity)
                        .to(0.1, { opacity: 255 })
                        .to(0.3, { opacity: 0 })
                        .start();
                }

                // 护盾闪烁
                shieldOpacity.opacity = 255;
                tween(shieldOpacity)
                    .to(0.1, { opacity: 255 })
                    .to(0.3, { opacity: 0 })
                    .start();

                // 受击者震动
                const defStartPos = defenderNode.position.clone();
                tween(defenderNode)
                    .by(0.05, { position: new Vec3(10, 0, 0) })
                    .by(0.05, { position: new Vec3(-20, 0, 0) })
                    .to(0.05, { position: defStartPos })
                    .start();
            })
            .start();
    }

    private refreshUI() {
        const p1 = this.battleData.p1;
        const p2 = this.battleData.p2;
        const currentPhase = this.battleData.phase;
        const activePlayerId = this.battleData.activePlayerId;

        this.leftNameLabel.string = `🛡️ ${p1.name} (防守方)`;
        this.leftLobsterSkillLabel.string = `技能:(${p1.skillDesc || "无"})`;
        this.leftDmgLabel.string = `累计受伤: ${p1.dmgTaken}`;
        this.leftCritLabel.string = `暴击率: ${Math.round((p1.critChance || 0) * 100)}%`;

        this.rightNameLabel.string = `⚔️ ${p2.name} (挑战方)`;
        this.rightLobsterSkillLabel.string = `技能:(${p2.skillDesc || "无"})`;
        this.rightDmgLabel.string = `累计受伤: ${p2.dmgTaken}`;
        this.rightCritLabel.string = `暴击率: ${Math.round((p2.critChance || 0) * 100)}%`;

        this.btnRoll.node.active = false;
        this.btnEatWeed.node.active = false;
        this.btnSkipWeed.node.active = false;
        this.btnDrawHP.node.active = false;

        // 如果是等待抽卡，确保统管卡牌节点显示出来
        if (currentPhase === 'hp_draw') {
            this.hpCardNode.active = true;
            // 恢复卡牌为背面状态
            const cardBack = this.hpCardNode.getChildByName('card_back');
            const cardFront = this.hpCardNode.getChildByName('CardBloodSprite');
            if (cardBack) cardBack.active = true;
            if (cardFront) cardFront.active = false;
        } else if (currentPhase !== 'show_hp_result') {
            // 其他阶段隐藏卡牌
            this.hpCardNode.active = false;
        }

        const isMyTurn = !this.isSpectator && (activePlayerId === this.localPlayerId);
        const isTargetTurn = !this.isSpectator && (this.battleData.targetPlayerId === this.localPlayerId);

        // 若是我的回合，加载我出战灵螯对应的骰子图片
        if (isMyTurn && (currentPhase === 'enrage_roll' || currentPhase === 'attack_roll')) {
            const myData = (p1.id === this.localPlayerId) ? p1 : p2;
            this.updateActiveDiceImage(myData);
        }

        if (this.isSpectator) {
            switch (currentPhase) {
                case 'enrage_roll':
                    this.statusLabel.string = "观战中：等待狂暴起步判定...";
                    break;
                case 'attack_roll':
                    this.statusLabel.string = "观战中：等待攻击掷骰...";
                    break;
                case 'seaweed_choice':
                    this.statusLabel.string = "观战中：等待对方决定是否吃草...";
                    break;
                case 'hp_draw':
                    this.statusLabel.string = "观战中：等待受击方抽取血量卡...";
                    break;
                case 'reward_choice':
                    this.statusLabel.string = `战斗结束！胜者【${this.battleData.winnerName}】正在选择奖励...`;
                    break;
                default:
                    this.statusLabel.string = "观战中...";
                    break;
            }
            if (this.rewardNode) this.rewardNode.active = false;
            return;
        }

        if (currentPhase === 'reward_choice') {
            this.statusLabel.string = "🏆 战斗结束！等待胜者选择奖励...";
            if (this.localPlayerId === this.battleData.winnerId && this.rewardNode) {
                this.rewardNode.active = true;
                const myData = (p1.id === this.localPlayerId) ? p1 : p2;
                const btnUpgrade = this.rewardNode.getChildByName('BtnUpgrade')?.getComponent(Button);
                if (btnUpgrade) {
                    if (myData.lobsterGrade !== 'royal') {
                        btnUpgrade.interactable = true;
                        const lbl = btnUpgrade.node.getComponentInChildren(Label);
                        if (lbl) lbl.string = "出战灵螯升1品";
                    } else {
                        btnUpgrade.interactable = false;
                        const lbl = btnUpgrade.node.getComponentInChildren(Label);
                        if (lbl) lbl.string = "已是满级";
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
                this.statusLabel.string = isMyTurn ? `👉 是否消耗仙草增加点数？(当前掷出:${this.battleData.currentRoll}点)` : "等待对方决定是否吃草...";
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
                break;
        }
    }

    // ==========================================
    // 【修改】：全局血量卡 3D 翻面逻辑
    // ==========================================
    public playCardFlipAnim(targetId: number, hpValues: number[], callback: Function) {
        if (!hpValues || hpValues.length === 0 || !this.hpCardNode) {
            callback();
            return;
        }

        // 取出实际抽到的血量值
        const drawnHP = hpValues[0];

        const cardBack = this.hpCardNode.getChildByName('card_back');
        const cardFront = this.hpCardNode.getChildByName('CardBloodSprite');
        const hpLabel = cardFront?.getChildByName('CardBloodLabel')?.getComponent(Label);

        // 初始化动画前状态
        if (cardBack) cardBack.active = true;
        if (cardFront) cardFront.active = false;
        this.hpCardNode.setScale(new Vec3(1, 1, 1));
        this.hpCardNode.active = true;

        tween(this.hpCardNode)
            .to(0.2, { scale: new Vec3(0, 1, 1) }) // 翻转到中轴线（视觉上不可见）
            .call(() => {
                // 在翻转中点切换前后图像
                if (cardBack) cardBack.active = false;
                if (cardFront) cardFront.active = true;
                if (hpLabel) {
                    hpLabel.string = `${drawnHP}血`;
                    hpLabel.color = new Color(255, 50, 50);
                }
            })
            .to(0.2, { scale: new Vec3(1, 1, 1) }) // 继续翻转展开正面
            .delay(0.5) // 停顿0.5秒让玩家看清
            .call(() => {
                // 更新面板上的 LastHPLabel
                if (targetId === this.battleData.p1.id) {
                    if (this.leftLastHPLabel) this.leftLastHPLabel.string = `当前血量：${drawnHP}`;
                } else {
                    if (this.rightLastHPLabel) this.rightLastHPLabel.string = `当前血量：${drawnHP}`;
                }
                callback();
            })
            .start();
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
    // 【修改】：骰子按钮增加旋转效果
    // ==========================================
    public onBtnRollClicked() {
        // 先禁用按钮防止玩家疯狂连点
        this.btnRoll.interactable = false;

        // 执行快速旋转3圈的动画
        if (this.btnRollDiceSprite) {
            tween(this.btnRollDiceSprite.node)
                .by(0.5, { eulerAngles: new Vec3(0, 0, -360 * 3) })
                .call(() => {
                    // 动画结束后隐藏节点，并恢复交互性以备后用
                    this.btnRoll.node.active = false;
                    this.btnRoll.interactable = true;
                    NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'roll_dice' });
                })
                .start();
        } else {
            // 防御性处理
            this.btnRoll.node.active = false;
            this.btnRoll.interactable = true;
            NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'roll_dice' });
        }
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

    public onBtnRewardUpgradeClicked() {
        if (this.rewardNode) this.rewardNode.active = false;
        NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'claim_battle_reward', rewardType: 'upgrade' });
    }

    public onBtnRewardCoinsClicked() {
        if (this.rewardNode) this.rewardNode.active = false;
        NetworkManager.instance.send('clientBattleAction', 'battleAction', { actionType: 'claim_battle_reward', rewardType: 'coins' });
    }
}