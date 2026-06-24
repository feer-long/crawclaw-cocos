import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite, UITransform, Layout, SpriteFrame, Vec3 } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

import { GRADE_NAMES, getGradeValue } from '../Data/GameConstants';

@ccclass('LobsterSelectPopup')
export class LobsterSelectPopup extends Component {
    @property(Label) public titleLabel: Label = null;
    @property(Label) public vsLabel: Label = null;
    @property(Label) public hintLabel: Label = null;

    @property(Node) public lobsterScrollViewNode: Node = null;
    @property(Node) public lobsterScrollViewContent: Node = null;
    @property(Node) public itemTemplate: Node = null;

    @property(Button) public btnConfirm: Button = null;

    @property({ type: SpriteFrame, tooltip: '0级金底框' }) public frameGold: SpriteFrame = null;
    @property({ type: SpriteFrame, tooltip: '0级山海龙螯' }) public iconRoyal: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: '1级红底框' }) public frameRed: SpriteFrame = null;
    @property({ type: SpriteFrame, tooltip: '1级祝融赤焰螯' }) public iconGrade1: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: '2级蓝底框' }) public frameBlue: SpriteFrame = null;
    @property({ type: SpriteFrame, tooltip: '2级昆仑冰晶螯' }) public iconGrade2: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: '3级灰底框' }) public frameGrey: SpriteFrame = null;
    @property({ type: SpriteFrame, tooltip: '3级磐石玄甲螯' }) public iconGrade3: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: '4级绿底框' }) public frameGreen: SpriteFrame = null;
    @property({ type: SpriteFrame, tooltip: '4级幼型灵螯' }) public iconNormal: SpriteFrame = null;

    private currentBattle: any = null;
    private localPlayerId: number = -1;
    private isChallenger: boolean = false;
    private isDefender: boolean = false;
    private isViewOnly: boolean = false;

    private myInventory: any[] = [];
    private selectedItemIndex: number = -1;
    private itemNodes: Node[] = [];

    private myValidCount: number = 0;
    private oppValidCount: number = 0;
    private isConfirmed: boolean = false;

    public init(data: any) {
        try {
            const stateStr = cc.sys.localStorage.getItem('localPlayerId');
            this.localPlayerId = stateStr ? parseInt(stateStr) : -1;
            this.isConfirmed = false;

            // 监听lobsterSelected消息
            NetworkManager.instance.eventTarget.on('lobsterSelected', this._onLobsterSelected, this);

            this.isViewOnly = (data.viewOnly === true);
            if (this.isViewOnly) {
                this.isChallenger = false;
                this.isDefender = false;

                if (this.titleLabel) this.titleLabel.string = '';
                if (this.vsLabel) this.vsLabel.string = `👀 正在查看 [${data.playerName}] 的灵螯图鉴`;
                if (this.hintLabel) this.hintLabel.string = `共拥有 ${data.lobsters.length + (data.titles ? data.titles.length : 0)} 只灵螯/神器`;
                if (this.btnConfirm) {
                    this.btnConfirm.node.active = true;
                    const btnLabel = this.btnConfirm.getComponentInChildren(Label);
                    if (btnLabel) btnLabel.string = "关闭";
                }

                this.myInventory = [];
                if (data.lobsters) data.lobsters.forEach((l: any) => this.myInventory.push({ data: l }));
                if (data.titles) data.titles.forEach((t: any) => this.myInventory.push({ data: t }));

                if (this.lobsterScrollViewNode) this.lobsterScrollViewNode.active = true;
                if (this.itemTemplate) this.itemTemplate.active = false;
                this.renderLobsters();
                return;
            }

            this.currentBattle = data.battleQueue[0];
            if (!this.currentBattle) return;

            this.isChallenger = (this.localPlayerId === this.currentBattle.challengerId);
            this.isDefender = (this.localPlayerId === this.currentBattle.defenderId);

            const gameStateStr = cc.sys.localStorage.getItem('currentGameState');
            const gameState = gameStateStr ? JSON.parse(gameStateStr) : null;

            const pChallenger = gameState?.players.find((p: any) => p.id === this.currentBattle.challengerId);
            const pDefender = gameState?.players.find((p: any) => p.id === this.currentBattle.defenderId);

            if (pChallenger && pDefender && this.vsLabel) {
                const slotNum = this.currentBattle.defenderSlot + 1;
                this.vsLabel.string = `⚔️ ${pChallenger.name} [挑战方] VS ${pDefender.name} [防守方] ⚔️\n争夺 [${slotNum}号] 槽位`;
            }

            if (!this.isChallenger && !this.isDefender) {
                if (this.hintLabel) this.hintLabel.string = "观战中：正在等待双方挑选出战灵螯...";
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

    private loadAndCheckArmies(gameState: any) {
        if (!gameState) return;
        const me = gameState.players.find((p: any) => p.id === this.localPlayerId);
        const oppId = this.isChallenger ? this.currentBattle.defenderId : this.currentBattle.challengerId;
        const opponent = gameState.players.find((p: any) => p.id === oppId);

        if (!me) return;

        this.myInventory = [];
        this.myValidCount = 0;
        const lobsters = me.lobsters || [];
        const titles = me.titleCards || [];

        lobsters.forEach((l: any) => { this.myInventory.push({ data: l }); });
        titles.forEach((t: any) => { this.myInventory.push({ data: t }); });

        this.oppValidCount = 0;
        if (opponent) {
            const oppLobsters = opponent.lobsters || [];
            const oppTitles = opponent.titleCards || [];
            oppLobsters.forEach((l: any) => {
                if (getGradeValue(l.grade) >= 1 && l.used !== true) this.oppValidCount++;
            });
            oppTitles.forEach((t: any) => {
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

            const frameSprite = node.getComponent(Sprite);
            const iconSprite = node.getChildByName('Sprite')?.getComponent(Sprite);

            if (item.data.grade) {
                let targetFrame = this.frameGreen;
                let targetIcon = this.iconNormal;

                switch (item.data.grade) {
                    case 'royal':
                        targetFrame = this.frameGold; targetIcon = this.iconRoyal; break;
                    case 'grade1':
                        targetFrame = this.frameRed; targetIcon = this.iconGrade1; break;
                    case 'grade2':
                        targetFrame = this.frameBlue; targetIcon = this.iconGrade2; break;
                    case 'grade3':
                        targetFrame = this.frameGrey; targetIcon = this.iconGrade3; break;
                    case 'normal':
                    default:
                        targetFrame = this.frameGreen; targetIcon = this.iconNormal; break;
                }

                if (frameSprite && targetFrame) frameSprite.spriteFrame = targetFrame;
                if (iconSprite && targetIcon) iconSprite.spriteFrame = targetIcon;
            }

            const baseName = item.data.name || GRADE_NAMES[item.data.grade];
            const val = getGradeValue(item.data.grade) || 0;

            const isUsed = item.data.used === true;
            const canFight = this.isViewOnly ? true : (val >= 1 && !isUsed);
            if (canFight) this.myValidCount++;

            const skillDesc = item.data.description || "";

            (node as any)._itemData = { index: i, canFight: canFight, isUsed: isUsed, val: val, baseName: baseName, skillDesc: skillDesc };

            if (!this.isViewOnly) {
                node.on(Button.EventType.CLICK, () => {
                    if (this.isConfirmed) return;
                    if (!canFight) return;
                    this.selectedItemIndex = i;
                    this.refreshUI();
                }, this);
            }

            this.itemNodes.push(node);
        }

        this.refreshUI();
    }

    private refreshUI() {
        this.itemNodes.forEach((node, idx) => {
            const itemData = (node as any)._itemData;

            const btn = node.getComponent(Button);
            const frameSprite = node.getComponent(Sprite);

            const allLabels = node.getComponentsInChildren(Label);
            let targetLabel = node.getChildByName('Label')?.getComponent(Label);
            if (!targetLabel && allLabels.length > 0) targetLabel = allLabels[0];

            let finalString = itemData.baseName;
            let needsSmallFont = false;

            // 【新增】定义文字的颜色变量，默认白色
            let targetLabelColor = new Color(255, 255, 255, 255);

            if (!itemData.canFight) {
                if (frameSprite) frameSprite.color = new Color(150, 150, 150, 200);
                if (btn) btn.interactable = false;

                // 不可用时，文字变灰
                targetLabelColor = new Color(180, 180, 180, 255);

                if (!this.isViewOnly) {
                    if (itemData.isUsed) {
                        finalString += '(已战)';
                        needsSmallFont = true;
                    } else if (itemData.val < 1) {
                        finalString += '(不够格)';
                        needsSmallFont = true;
                    }
                }
            } else {
                if (this.isViewOnly) {
                    if (btn) btn.interactable = false;
                    if (frameSprite) frameSprite.color = new Color(255, 255, 255, 255);
                } else {
                    if (btn) btn.interactable = true;

                    const isSelected = (idx === this.selectedItemIndex);
                    if (frameSprite) {
                        frameSprite.color = isSelected ? new Color(255, 255, 200, 255) : new Color(255, 255, 255, 255);
                    }
                    node.setScale(isSelected ? new Vec3(1.05, 1.05, 1) : new Vec3(1, 1, 1));

                    // 【新增】如果是选中状态，名字变为金色
                    if (isSelected) {
                        targetLabelColor = new Color(255, 215, 0, 255);
                    }
                }
            }

            allLabels.forEach(l => {
                if (l === targetLabel) {
                    l.string = finalString;
                    l.fontSize = needsSmallFont ? 30 : 50;
                    l.lineHeight = needsSmallFont ? 30 : 50;
                    // 【新增】应用颜色到名字 Label
                    l.color = targetLabelColor;
                } else if (l.node.name === 'EffectLabel' || l.node.name === 'DescLabel') {
                    l.string = itemData.skillDesc || "";
                } else if (allLabels.length > 1 && l !== targetLabel) {
                    if (l.string === "" || l.string === finalString) {
                        l.string = itemData.skillDesc || "";
                    }
                } else {
                    l.string = "";
                }
            });
        });

        if (this.isViewOnly) return;

        if (!this.btnConfirm || !this.hintLabel) return;
        const btnLabel = this.btnConfirm.getComponentInChildren(Label);

        if (this.myValidCount === 0) {
            this.hintLabel.string = "❌ 你没有符合条件(3级以上且未战)的灵螯，只能认输";
            this.btnConfirm.interactable = true;
            if (btnLabel) btnLabel.string = "无出战灵螯 (点击判负)";
        } else {
            if (this.selectedItemIndex === -1) {
                this.hintLabel.string = "👇 请在下方选择要派遣出战的灵螯";
                this.btnConfirm.interactable = false;
                if (btnLabel) btnLabel.string = "请选择灵螯";
            } else {
                this.hintLabel.string = "✅ 已点将完毕，点击确认出击！";
                this.btnConfirm.interactable = true;
                if (btnLabel) btnLabel.string = "确认出战";
            }
        }
    }

    public onBtnConfirmClicked() {
        if (!this.btnConfirm) return;

        if (this.isViewOnly) {
            this.node.destroy();
            return;
        }

        this.isConfirmed = true;
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

        const gameStateStr = cc.sys.localStorage.getItem('currentGameState');
        const gameState = gameStateStr ? JSON.parse(gameStateStr) : null;
        const playerCount = gameState?.players?.length || 2;
        const hasSpectators = playerCount > 2;

        if (this.hintLabel) {
            this.hintLabel.string = hasSpectators
                ? "已准备就绪，等待观战玩家下注..."
                : "已准备就绪，正在等待对手选择...";
        }

        const spectatorIds: number[] = [];
        if (hasSpectators && gameState) {
            for (const p of gameState.players) {
                if (p.id !== this.currentBattle.challengerId && p.id !== this.currentBattle.defenderId) {
                    spectatorIds.push(p.id);
                }
            }
        }

        NetworkManager.instance.send('clientBattleAction', 'lobster_selected', {
            battleId: this.currentBattle.challengeSlot.toString(),
            challengerId: this.currentBattle.challengerId,
            defenderId: this.currentBattle.defenderId,
            lobster: selectedItem.data,
            spectators: spectatorIds
        });
    }

    private _onLobsterSelected(data: any) {
        // 如果是自己选择的，保持当前状态
        if (data.playerId === this.localPlayerId) {
            return;
        }

        // 更新对手已选择的状态显示
        if (this.hintLabel) {
            this.hintLabel.string = "✅ 对手已选择灵螯，等待战斗开始...";
        }

        // 禁用确认按钮，防止重复选择
        if (this.btnConfirm) {
            this.btnConfirm.interactable = false;
        }
    }

    protected onDestroy() {
        NetworkManager.instance.eventTarget.off('lobsterSelected', this._onLobsterSelected, this);
    }
}