import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite, UITransform, Layout } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

const GRADE_NAMES: any = { 'normal': '普通龙虾', 'grade3': '三品龙虾', 'grade2': '二品龙虾', 'grade1': '一品龙虾', 'royal': '👑皇家龙虾' };

@ccclass('LobsterSelectPopup')
export class LobsterSelectPopup extends Component {
    @property(Label) public titleLabel: Label = null;
    @property(Label) public vsLabel: Label = null;
    @property(Label) public hintLabel: Label = null;

    @property(Node) public lobsterScrollViewNode: Node = null;
    @property(Node) public lobsterScrollViewContent: Node = null;
    @property(Node) public itemTemplate: Node = null;

    @property(Button) public btnConfirm: Button = null;

    private currentBattle: any = null;
    private localPlayerId: number = -1;
    private isChallenger: boolean = false;
    private isDefender: boolean = false;

    private myInventory: any[] = [];
    private selectedItemIndex: number = -1;
    private itemNodes: Node[] = [];

    private myValidCount: number = 0;
    private oppValidCount: number = 0;

    public init(data: any) {
        try {
            const stateStr = cc.sys.localStorage.getItem('localPlayerId');
            this.localPlayerId = stateStr ? parseInt(stateStr) : -1;

            this.currentBattle = data.battleQueue[0];
            if (!this.currentBattle) return;

            this.isChallenger = (this.localPlayerId === this.currentBattle.challengerId);
            this.isDefender = (this.localPlayerId === this.currentBattle.defenderId);

            const gameStateStr = cc.sys.localStorage.getItem('currentGameState');
            const gameState = gameStateStr ? JSON.parse(gameStateStr) : null;

            const pChallenger = gameState?.players.find((p:any) => p.id === this.currentBattle.challengerId);
            const pDefender = gameState?.players.find((p:any) => p.id === this.currentBattle.defenderId);

            if (pChallenger && pDefender && this.vsLabel) {
                // ==========================================
                // 【核心修复】：0,1,2 分别显示 1,2,3号，且绝对带有方括号！
                // ==========================================
                const slotNum = this.currentBattle.defenderSlot + 1;
                this.vsLabel.string = `⚔️ ${pChallenger.name} [挑战方] VS ${pDefender.name} [防守方] ⚔️\n争夺 [${slotNum}号] 槽位`;
            }

            if (!this.isChallenger && !this.isDefender) {
                if (this.hintLabel) this.hintLabel.string = "👀 观战中：正在等待双方挑选出战龙虾...";
                if (this.btnConfirm) this.btnConfirm.node.active = false;
                if (this.lobsterScrollViewNode) this.lobsterScrollViewNode.active = false;
            } else {
                if (this.btnConfirm) this.btnConfirm.node.active = true;
                if (this.lobsterScrollViewNode) this.lobsterScrollViewNode.active = true;
                this.loadAndCheckArmies(gameState);
            }
        } catch (e) {
            console.error("🚨 [LobsterSelectPopup] 初始化报错：", e);
        }
    }

    private getGradeValue(grade: string): number {
        if (!grade) return 0;
        if (grade === 'normal') return 0;
        if (grade === 'grade3') return 1;
        if (grade === 'grade2') return 2;
        if (grade === 'grade1') return 3;
        if (grade === 'royal') return 4;
        return 4;
    }

    private loadAndCheckArmies(gameState: any) {
        if (!gameState) return;
        const me = gameState.players.find((p:any) => p.id === this.localPlayerId);
        const oppId = this.isChallenger ? this.currentBattle.defenderId : this.currentBattle.challengerId;
        const opponent = gameState.players.find((p:any) => p.id === oppId);

        if (!me) return;

        this.myInventory = [];
        this.myValidCount = 0;
        const lobsters = me.lobsters || [];
        const titles = me.titleCards || [];

        lobsters.forEach((l: any) => { this.myInventory.push({ type: 'lobster', data: l }); });
        titles.forEach((t: any) => { this.myInventory.push({ type: 'title', data: t }); });

        this.oppValidCount = 0;
        if (opponent) {
            const oppLobsters = opponent.lobsters || [];
            const oppTitles = opponent.titleCards || [];
            oppLobsters.forEach((l:any) => {
                if (this.getGradeValue(l.grade) >= 1 && l.used !== true) this.oppValidCount++;
            });
            oppTitles.forEach((t:any) => {
                if (t.used !== true) this.oppValidCount++;
            });
        }

        if (this.lobsterScrollViewContent && this.itemTemplate) {
            this.itemTemplate.active = false;
            this.renderLobsters();
            this.refreshUI();
        }
    }

    private renderLobsters() {
        if (this.lobsterScrollViewNode && this.lobsterScrollViewContent) {
            const svTrans = this.lobsterScrollViewNode.getComponent(UITransform);
            const viewTrans = this.lobsterScrollViewContent.parent?.getComponent(UITransform);
            const contentTrans = this.lobsterScrollViewContent.getComponent(UITransform);

            if (svTrans && viewTrans && contentTrans) {
                viewTrans.width = svTrans.width;
                viewTrans.height = svTrans.height;
                contentTrans.width = svTrans.width;
            }

            let layout = this.lobsterScrollViewContent.getComponent(Layout);
            if (layout) {
                layout.type = Layout.Type.GRID;
                layout.resizeMode = Layout.ResizeMode.CONTAINER;
                layout.startAxis = Layout.AxisDirection.HORIZONTAL;
                layout.constraint = Layout.Constraint.FIXED_COL;
                layout.constraintNum = 2;
                layout.spacingX = 15;
                layout.spacingY = 15;
            }
        }

        this.lobsterScrollViewContent.removeAllChildren();

        this.itemNodes = [];
        this.selectedItemIndex = -1;
        this.myValidCount = 0;

        for (let i = 0; i < this.myInventory.length; i++) {
            const item = this.myInventory[i];

            const node = instantiate(this.itemTemplate);
            node.active = true;
            this.lobsterScrollViewContent.addChild(node);

            let baseName = "";
            let val = 0;
            if (item.type === 'lobster') {
                val = this.getGradeValue(item.data.grade);
                if (GRADE_NAMES[item.data.grade]) {
                    baseName = GRADE_NAMES[item.data.grade];
                    if (item.data.grade === 'royal' && (item.data.title || item.data.name)) {
                        baseName = `🔖[${item.data.title || item.data.name}]`;
                        val = 4;
                    }
                } else {
                    baseName = `🔖[${item.data.grade || item.data.name}]`;
                    val = 4;
                }
            } else {
                baseName = `🔖[${item.data.name}]`;
                val = 4;
            }

            const isUsed = item.data.used === true;
            const canFight = val >= 1 && !isUsed;
            if (canFight) this.myValidCount++;

            (node as any)._itemData = { index: i, canFight: canFight, isUsed: isUsed, val: val, baseName: baseName };

            node.on(Button.EventType.CLICK, () => {
                if (!canFight) return;
                this.selectedItemIndex = i;
                this.refreshUI();
            }, this);

            this.itemNodes.push(node);
        }
    }

    private refreshUI() {
        this.itemNodes.forEach((node, idx) => {
            const itemData = (node as any)._itemData;
            const sprite = node.getComponent(Sprite);
            const btn = node.getComponent(Button);

            const allLabels = node.getComponentsInChildren(Label);
            let targetLabel = node.getChildByName('Label')?.getComponent(Label);
            if (!targetLabel && allLabels.length > 0) targetLabel = allLabels[0];

            let finalString = itemData.baseName;

            if (!itemData.canFight) {
                if (sprite) sprite.color = new Color(200, 200, 200, 150);
                if (btn) btn.interactable = false;

                if (itemData.isUsed) {
                    finalString += '(已战)';
                } else if (itemData.val < 1) {
                    finalString += '(不够格)';
                }
            } else {
                if (btn) btn.interactable = true;
                const isSelected = (idx === this.selectedItemIndex);
                if (sprite) sprite.color = isSelected ? new Color(255, 100, 100) : new Color(220, 240, 255);
            }

            allLabels.forEach(l => {
                if (l === targetLabel) l.string = finalString;
                else l.string = "";
            });
        });

        if (!this.btnConfirm || !this.hintLabel) return;
        const btnLabel = this.btnConfirm.getComponentInChildren(Label);

        if (this.myValidCount === 0) {
            this.hintLabel.string = "❌ 你没有符合条件(3品以上且未战)的龙虾，只能认输";
            this.btnConfirm.interactable = true;
            this.btnConfirm.getComponent(Sprite).color = new Color(200, 100, 100);
            if (btnLabel) btnLabel.string = "无出战龙虾 (点击判负)";
        } else {
            if (this.selectedItemIndex === -1) {
                this.hintLabel.string = "👇 请在下方选择要派遣出战的龙虾";
                this.btnConfirm.interactable = false;
                this.btnConfirm.getComponent(Sprite).color = new Color(200, 200, 200);
                if (btnLabel) btnLabel.string = "请选择龙虾";
            } else {
                this.hintLabel.string = "✅ 已点将完毕，点击确认出击！";
                this.btnConfirm.interactable = true;
                this.btnConfirm.getComponent(Sprite).color = new Color(100, 200, 100);
                if (btnLabel) btnLabel.string = "确认出战";
            }
        }
    }

    public onBtnConfirmClicked() {
        if (!this.btnConfirm) return;
        this.btnConfirm.interactable = false;

        if (this.myValidCount === 0) {
            if (this.hintLabel) this.hintLabel.string = "🏳️ 已认输，正在结算槽位归属...";

            let finalWinner = '';
            if (this.oppValidCount === 0) {
                finalWinner = 'defender';
            } else {
                finalWinner = this.isChallenger ? 'defender' : 'challenge';
            }

            NetworkManager.instance.send('clientBattleAction', 'no_lobster_forfeit', {
                winner: finalWinner,
                challengeSlot: this.currentBattle.challengeSlot
            });
            return;
        }

        const selectedItem = this.myInventory[this.selectedItemIndex];
        if (this.hintLabel) this.hintLabel.string = "⏳ 已准备就绪，正在等待对手选择...";

        NetworkManager.instance.send('clientBattleAction', 'lobster_selected', {
            battleId: this.currentBattle.challengeSlot.toString(),
            challengerId: this.currentBattle.challengerId,
            defenderId: this.currentBattle.defenderId,
            lobster: selectedItem.data
        });
    }
}