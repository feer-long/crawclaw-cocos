import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite, assetManager, SpriteFrame, Prefab } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

import { GRADE_NAMES, GRADE_ORDER } from '../Data/GameConstants';

// ★ 新增：灵螯品级对应的所有UI资源配置字典
const GRADE_MAP: Record<string, any> = {
    'normal': { name: '幼型灵螯', bg: 'Images/settlement/breeding/level1', longBg: 'Images/settlement/breeding/level1_long', sprite: 'Images/settlement/shrimp/【寻山访海】幼型灵螯' },
    'grade3': { name: '磐石玄甲螯', bg: 'Images/settlement/breeding/level2', longBg: 'Images/settlement/breeding/level2_long', sprite: 'Images/settlement/breeding/【磐石玄甲螯】' },
    'grade2': { name: '昆仑冰晶螯', bg: 'Images/settlement/breeding/level3', longBg: 'Images/settlement/breeding/level3_long', sprite: 'Images/settlement/breeding/【昆仑冰晶螯】' },
    'grade1': { name: '祝融赤焰螯', bg: 'Images/settlement/breeding/level4', longBg: 'Images/settlement/breeding/level4_long', sprite: 'Images/settlement/breeding/【祝融赤焰螯】' },
    'royal':  { name: '山海龙螯', bg: 'Images/settlement/breeding/level5', longBg: 'Images/settlement/breeding/level5_long', sprite: 'Images/settlement/breeding/【洪荒两仪·山海龙螯】' }
};

@ccclass('BreedingPopup')
export class BreedingPopup extends Component {

    // --- 顶部文本 ---
    @property(Label) public actionCountLabel: Label = null;
    @property(Label) public resourceLabel: Label = null;
    @property(Label) public previewLabel: Label = null;

    // --- 左侧灵螯列表 ---
    @property(Node) public lobsterContainer: Node = null;
    @property(Prefab) public lobsterBtnPrefab: Prefab = null;

    // --- 中间展示节点 ---
    @property(Node) public showNode: Node = null;
    @property(Sprite) public Sprite_left: Sprite = null;
    @property(Sprite) public Sprite_level_low: Sprite = null;
    @property(Label) public Label_level_low: Label = null;
    @property(Sprite) public Sprite_right: Sprite = null;
    @property(Sprite) public Sprite_level_high: Sprite = null;
    @property(Label) public Label_level_high: Label = null;

    // --- 虾王专属节点 ---
    @property(Node) public royalPanel: Node = null;
    @property(Node) public btnCostCage: Node = null;
    @property(Node) public btnCostCoin: Node = null;
    @property(Node) public btnRewardDe: Node = null;
    @property(Node) public btnRewardWang: Node = null;

    // 固定的两个神器按钮
    @property(Button) public Button_shenqi_left: Button = null;
    @property(Label) public Label_shenqi_left: Label = null;
    @property(Button) public Button_shenqi_right: Button = null;
    @property(Label) public Label_shenqi_right: Label = null;

    // --- 底部控制 ---
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
    private filteredTitles: any[] = [];
    private hasUpgradeable: boolean = false;

    // ★ 新增的两段式确认状态变量
    private isWaitingForRoyalConfirm: boolean = false;
    private isTargetRoyal: boolean = false;

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

        // 初始化状态
        this.isWaitingForRoyalConfirm = false;
        this.isTargetRoyal = false;

        // 跳过按钮在初始化时永远保持可点击状态
        if (this.btnSkip) this.btnSkip.interactable = true;

        // 隐藏展示面板，等玩家选中后再显示
        if (this.showNode) this.showNode.active = false;
        if (this.royalPanel) this.royalPanel.active = false;

        this.renderLobsterList();
        this.setupTitles();
        this.refreshUI();
    }

    // 远程加载图片的通用方法
    private loadRemoteImg(sprite: Sprite, path: string) {
        if (!sprite || !path) return;
        assetManager.getBundle('remote_assets')?.load(`${path}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sprite.isValid) sprite.spriteFrame = sf;
        });
    }

    private renderLobsterList() {
        if (!this.lobsterBtnPrefab) {
            console.error("❌ 严重错误：未绑定 Lobster Btn Prefab！");
            return;
        }

        this.lobsterBtns.forEach(btn => btn.destroy());
        this.lobsterBtns = [];
        this.hasUpgradeable = false;

        const lobsters = this.player.lobsters || [];
        for (let i = 0; i < lobsters.length; i++) {
            const lobster = lobsters[i];
            const btnNode = instantiate(this.lobsterBtnPrefab);
            btnNode.active = true;
            this.lobsterContainer.addChild(btnNode);

            const cfg = GRADE_MAP[lobster.grade] || GRADE_MAP['normal'];

            // 动态替换背景框 (按钮本身的Sprite)
            const bgSprite = btnNode.getComponent(Sprite);
            if (bgSprite) this.loadRemoteImg(bgSprite, cfg.bg);

            // 动态替换灵螯形象 (子节点 CharSprite)
            const charSprite = btnNode.getChildByName('CharSprite')?.getComponent(Sprite);
            if (charSprite) this.loadRemoteImg(charSprite, cfg.sprite);

            if (lobster.grade === 'royal') {
                const btn = btnNode.getComponent(Button);
                if (btn) btn.interactable = false; // 禁用按钮
                btnNode.getComponent(Sprite).color = new Color(150, 150, 150); // 变灰
            } else {
                this.hasUpgradeable = true; // 存在可升级的灵螯
                btnNode.on(Button.EventType.CLICK, () => {
                    // ★ 玩家切换了灵螯，退出神器选择状态，重置回第一阶段
                    this.isWaitingForRoyalConfirm = false;
                    this.selectedLobsterIndex = i;
                    this.refreshUI();
                }, this);
            }

            this.lobsterBtns.push(btnNode);
        }
    }

    private setupTitles() {
        const stateStr = cc.sys.localStorage.getItem('currentGameState');
        const gameState = stateStr ? JSON.parse(stateStr) : {};
        const availableTitles = gameState.gameTitleCards || [];

        const earnedTitleIds = new Set((this.player.titleCards || []).map((t: any) => t.id));
        this.filteredTitles = availableTitles.filter((t: any) => !earnedTitleIds.has(t.id));

        // 处理固定的左侧神器按钮
        if (this.Button_shenqi_left) {
            if (this.filteredTitles.length > 0) {
                this.Button_shenqi_left.node.active = true;
                if (this.Label_shenqi_left) this.Label_shenqi_left.string = `[${this.filteredTitles[0].name}]`;
                // 绑定点击事件
                this.Button_shenqi_left.node.on(Button.EventType.CLICK, () => {
                    this.selectedTitleId = this.filteredTitles[0].id;
                    this.refreshUI();
                }, this);
            } else {
                this.Button_shenqi_left.node.active = false;
            }
        }

        // 处理固定的右侧神器按钮
        if (this.Button_shenqi_right) {
            if (this.filteredTitles.length > 1) {
                this.Button_shenqi_right.node.active = true;
                if (this.Label_shenqi_right) this.Label_shenqi_right.string = `[${this.filteredTitles[1].name}]`;
                this.Button_shenqi_right.node.on(Button.EventType.CLICK, () => {
                    this.selectedTitleId = this.filteredTitles[1].id;
                    this.refreshUI();
                }, this);
            } else {
                this.Button_shenqi_right.node.active = false;
            }
        }
    }

    private refreshUI() {
        this.actionCountLabel.string = `剩余操作次数：${this.rawData.actionCount}`;
        this.resourceLabel.string = `贝币:${this.player.coins} 仙草:${this.player.seaweed} 灵鼎:${this.player.cages}`;

        if (!this.hasUpgradeable) {
            this.previewLabel.string = "🎉 你的所有灵螯都已满级，无可培养，请点击【跳过此行动】！";
            this.btnConfirm.interactable = false;
            if (this.showNode) this.showNode.active = false;
            if (this.royalPanel) this.royalPanel.active = false;
            if (this.titleContainer) this.titleContainer.active = false;

            const swSprite = this.btnToggleSeaweed?.getComponent(Sprite);
            if (swSprite) swSprite.color = new Color(150, 150, 150);
            return;
        }

        // 刷新列表里的选中光圈
        // 没选中是白色(220,220,220表示稍微有点底色)，选中是耀眼的金色(255, 215, 0)
        this.lobsterBtns.forEach((btn, idx) => {
            const interactable = btn.getComponent(Button)?.interactable;
            if (interactable) {
                btn.getComponent(Sprite).color = (idx === this.selectedLobsterIndex) ? new Color(255, 225, 0, 200) : new Color(220, 220, 220);
            }
        });

        this.isTargetRoyal = false;
        let canConfirm = false;
        let failReason = "";

        if (this.selectedLobsterIndex === -1) {
            this.previewLabel.string = "请先在下方选择一只灵螯";
            if (this.showNode) this.showNode.active = false;
            if (this.royalPanel) this.royalPanel.active = false;
            if (this.titleContainer) this.titleContainer.active = false;

            const btnSp = this.btnToggleSeaweed?.getComponent(Sprite);
            if (btnSp) btnSp.color = new Color(150, 150, 150);
            const swLabel = this.btnToggleSeaweed?.getComponentInChildren(Label);
            if (swLabel) swLabel.string = "投喂仙草";

        } else {
            const lobster = this.player.lobsters[this.selectedLobsterIndex];
            const currentGrade = lobster.grade;

            if (currentGrade === 'royal') {
                failReason = "灵螯已达最高品级，无法继续培养";
                canConfirm = false;
                this.useSeaweed = false;
                const btnSp = this.btnToggleSeaweed?.getComponent(Sprite);
                if (btnSp) btnSp.color = new Color(150, 150, 150);
            } else {
                const canUseSeaweed = (currentGrade !== 'grade1');

                if (!canUseSeaweed && this.useSeaweed) this.useSeaweed = false;

                const swLabel = this.btnToggleSeaweed?.getComponentInChildren(Label);
                if (swLabel) {
                    if (!canUseSeaweed) swLabel.string = "无需投喂";
                    else swLabel.string = "投喂仙草";
                }

                const btnSp = this.btnToggleSeaweed?.getComponent(Sprite);
                if (btnSp) btnSp.color = (!canUseSeaweed) ? new Color(150, 150, 150) : (this.useSeaweed ? new Color(100, 200, 100) : new Color(220, 220, 220));

                let gradeIdx = GRADE_ORDER.indexOf(currentGrade);
                let jump = this.useSeaweed ? 2 : 1;
                let targetIdx = Math.min(gradeIdx + jump, GRADE_ORDER.length - 1);
                let targetGrade = GRADE_ORDER[targetIdx];

                // this.previewLabel.string = `预测: ${GRADE_NAMES[currentGrade]} ➡️ ${GRADE_NAMES[targetGrade]}`;
                this.isTargetRoyal = (currentGrade !== 'royal' && targetGrade === 'royal');

                // --- 刷新 Show 节点的动态图片展示 ---
                if (this.showNode) {
                    const curCfg = GRADE_MAP[currentGrade];
                    const tgtCfg = GRADE_MAP[targetGrade];
                    this.loadRemoteImg(this.Sprite_left, curCfg.longBg);
                    this.loadRemoteImg(this.Sprite_level_low, curCfg.sprite);
                    if (this.Label_level_low) this.Label_level_low.string = curCfg.name;

                    this.loadRemoteImg(this.Sprite_right, tgtCfg.longBg);
                    this.loadRemoteImg(this.Sprite_level_high, tgtCfg.sprite);
                    if (this.Label_level_high) this.Label_level_high.string = tgtCfg.name;
                }

                if (this.useSeaweed && this.player.seaweed < 1) {
                    failReason = "仙草数量不足";
                } else {
                    canConfirm = true; // 第一阶段满足条件
                }
            }
        }

        // ==========================================
        // ★ 核心状态机控制逻辑 ★
        // ==========================================
        if (this.isTargetRoyal && this.isWaitingForRoyalConfirm) {
            // 【状态2】玩家已确认过升虾王，展示册封选项面板
            if (this.showNode) this.showNode.active = false;
            if (this.royalPanel) this.royalPanel.active = true;
            if (this.titleContainer) this.titleContainer.active = true;

            if(this.btnCostCage) this.btnCostCage.getComponent(Sprite).color = (this.royalCost === 'cage') ? new Color(255, 150, 50) : new Color(220, 220, 220);
            if(this.btnCostCoin) this.btnCostCoin.getComponent(Sprite).color = (this.royalCost === 'coin') ? new Color(255, 150, 50) : new Color(220, 220, 220);
            if(this.btnRewardDe) this.btnRewardDe.getComponent(Sprite).color = (this.royalReward === 'de') ? new Color(100, 200, 255) : new Color(220, 220, 220);
            if(this.btnRewardWang) this.btnRewardWang.getComponent(Sprite).color = (this.royalReward === 'wang') ? new Color(100, 200, 255) : new Color(220, 220, 220);

            const hasTitles = this.filteredTitles.length > 0;

            if (this.Button_shenqi_left) {
                const tId = this.filteredTitles[0]?.id;
                this.Button_shenqi_left.getComponent(Sprite).color = (tId && tId === this.selectedTitleId) ? new Color(255, 215, 0) : new Color(220, 220, 220);
            }
            if (this.Button_shenqi_right) {
                const tId = this.filteredTitles[1]?.id;
                this.Button_shenqi_right.getComponent(Sprite).color = (tId && tId === this.selectedTitleId) ? new Color(255, 215, 0) : new Color(220, 220, 220);
            }

            if (!this.royalCost) failReason = "请选择神器与消耗";
            else if (this.royalCost === 'cage' && this.player.cages < 1) failReason = "灵鼎不足(需1个)";
            else if (this.royalCost === 'coin' && this.player.coins < 3) failReason = "贝币不足(需3枚)";
            else if (!this.royalReward) failReason = "请选择神器奖励";
            else if (hasTitles && !this.selectedTitleId) failReason = "请选择神器";
            else canConfirm = true;

            if (failReason) canConfirm = false;

        } else {
            // 【状态1】正常预览阶段（即使马上要变虾王，也先走这个状态预览）
            if (this.showNode) this.showNode.active = (this.selectedLobsterIndex !== -1);
            if (this.royalPanel) this.royalPanel.active = false;
            if (this.titleContainer) this.titleContainer.active = false;

        }

        this.btnConfirm.interactable = canConfirm;
        if (!canConfirm && this.selectedLobsterIndex !== -1) {
            this.previewLabel.string = `⚠️ ${failReason}`;
        }
    }

    // =========================================================================
    // 【老代码原汁原味的保留区】
    // 下面所有的点击事件、发包逻辑100%保留你老代码里能够成功通信的写法！
    // =========================================================================

    public onBtnToggleSeaweedClicked() {
        const lobster = this.player.lobsters[this.selectedLobsterIndex];
        if (!lobster || lobster.grade === 'grade1' || lobster.grade === 'royal') return; // 防护：部分品级不可吃草

        // ★ 玩家修改了仙草状态，重置回第一阶段
        this.isWaitingForRoyalConfirm = false;
        this.useSeaweed = !this.useSeaweed;
        this.refreshUI();
    }

    public onBtnCostCageClicked() { this.royalCost = 'cage'; this.refreshUI(); }
    public onBtnCostCoinClicked() { this.royalCost = 'coin'; this.refreshUI(); }
    public onBtnRewardDeClicked() { this.royalReward = 'de'; this.refreshUI(); }
    public onBtnRewardWangClicked() { this.royalReward = 'wang'; this.refreshUI(); }

    public onBtnConfirmClicked() {
        if (!this.btnConfirm.interactable) return;

        // ==========================================
        // ★ 两段式确认拦截
        // ==========================================
        if (this.isTargetRoyal && !this.isWaitingForRoyalConfirm) {
            // 拦截：如果是要升虾王，且还没选过神器，则切换UI面板并打断网络发送！
            this.isWaitingForRoyalConfirm = true;
            this.refreshUI();
            return;
        }

        // 走到这里说明：要么不是升虾王，要么是升虾王且已经在第二阶段选好神器了
        this.btnConfirm.interactable = false;
        this.btnSkip.interactable = false;

        // ★ 核心：完全使用老代码的双层 Payload 嵌套写法
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
        // ★ 核心：完全使用老代码的双层 Payload 嵌套写法
        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: { actionType: 'skip', payload: {} }
        });
    }
}