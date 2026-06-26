import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite, SpriteFrame } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { GRADE_NAMES, GRADE_NAMES_WITH_SCORE, getGradeValue } from '../Data/GameConstants';
const { ccclass, property } = _decorator;

@ccclass('TributePopup')
export class TributePopup extends Component {

    @property(Label) public resourceLabel: Label = null;
    @property(Label) public hintLabel: Label = null;

    @property(Node) public tavernScrollViewContent: Node = null;
    // 【修改点1】将原来的单独模板替换为整组的 oneTavern 模板
    @property(Node) public oneTavernTemplate: Node = null;

    @property(Node) public inventoryScrollView: Node = null;
    @property(Node) public inventoryContent: Node = null;
    @property(Node) public itemTemplate: Node = null;

    // ================= 【修改点2】动态绑定的素材框与图片 =================
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
    // ======================================================================

    @property(Button) public btnToggleNaked: Button = null;
    @property(Button) public btnRewardDe: Button = null;
    @property(Button) public btnRewardWang: Button = null;

    @property(Button) public btnBonusDe: Button = null;
    @property(Button) public btnBonusWang: Button = null;

    @property(Button) public btnConfirm: Button = null;
    @property(Button) public btnSkip: Button = null;

    @property(Node) public choiceContainer: Node = null;
    @property(Node) public choiceBtnTemplate: Node = null;
    @property(Node) public waitingChoiceNode: Node = null;
    @property(Label) public waitingChoiceLabel: Label = null;

    private isWaitingChoice: boolean = false;
    private pendingChoiceTaskId: string | null = null;
    private pendingChoiceType: string | null = null;
    private choiceOptions: any[] = [];

    private rawData: any = null;
    private player: any = null;
    private taverns: any[] = [];
    private myInventory: any[] = [];

    private selectedTavernId: number = -1;
    private selectedCardIds: string[] = [];

    private selectedItemIds: string[] = [];
    private isNakedTribute: boolean = false;
    private rewardChoice: 'de' | 'wang' = 'de';
    private bonusChoice: 'de' | 'wang' = 'de';
    private isConfirmed: boolean = false;

    // 依然用数组存起来方便 refreshUI 统一管理颜色
    private tavernGroupNodes: Node[] = [];
    private headerNodes: Node[] = [];
    private cardNodes: Node[] = [];
    private itemNodes: Node[] = [];

    private reqLobsterCount: number = 0;

    public init(data: any) {
        this.rawData = data;
        this.player = data.player;
        this.taverns = data.taverns || [];
        this.node.active = true;

        this.selectedTavernId = -1;
        this.selectedCardIds = [];
        this.selectedItemIds = [];
        this.isNakedTribute = false;
        this.rewardChoice = 'de';
        this.bonusChoice = 'de';
        this.reqLobsterCount = 0;
        this.isWaitingChoice = false;
        this.isConfirmed = false;
        this.pendingChoiceTaskId = null;
        this.pendingChoiceType = null;
        this.choiceOptions = [];

        this._cleanupChoiceUI();

        this.buildInventory();
        this.renderTaverns();
        this.renderInventory();
        this.refreshUI();

        NetworkManager.instance.eventTarget.on('tributeChoiceRequired', this._onTributeChoiceRequired, this);
        NetworkManager.instance.eventTarget.on('error', this._onError, this);
    }

    private _cleanupChoiceUI() {
        if (this.waitingChoiceNode) this.waitingChoiceNode.active = false;
        if (this.waitingChoiceLabel) this.waitingChoiceLabel.string = "";
        if (this.btnConfirm && this.btnConfirm.node) {
            this.btnConfirm.node.active = true;
            this.btnConfirm.interactable = true;
        }
        if (this.btnSkip && this.btnSkip.node) {
            this.btnSkip.node.active = true;
            this.btnSkip.interactable = true;
        }
    }

    private buildInventory() {
        this.myInventory = [];
        const lobsters = this.player.lobsters || [];
        const titles = this.player.titleCards || [];

        lobsters.forEach((l: any, idx: number) => {
            this.myInventory.push({ data: l, originalIndex: idx, id: l.id });
        });
        titles.forEach((t: any, idx: number) => {
            this.myInventory.push({ data: t, originalIndex: lobsters.length + idx, id: t.id });
        });
    }

    private createDynamicChoiceBtn(btnText: string, action: string, costOrTarget: any, interactable: boolean = true) {
        if (!this.choiceBtnTemplate || !this.choiceContainer) return;

        const btnNode = instantiate(this.choiceBtnTemplate);
        btnNode.active = true;

        const label = btnNode.getComponentInChildren(Label);
        if (label) label.string = btnText;

        const btn = btnNode.getComponent(Button);
        if (btn) btn.interactable = interactable;

        btnNode.on(Button.EventType.CLICK, () => {
            this._submitChoice(action, costOrTarget);
        }, this);

        this.choiceContainer.addChild(btnNode);
    }

    private checkResources(cards: any[]): boolean {
        let reqCoins = 0, reqSeaweed = 0, reqCages = 0;
        let reqLobsters: { [grade: string]: number } = {};

        for (const card of cards) {
            const req = card.requirements || {};
            reqCoins += req.coins || 0;
            reqSeaweed += req.seaweed || 0;
            reqCages += req.cages || 0;
            if (req.lobsters) {
                for (const grade in req.lobsters) {
                    reqLobsters[grade] = (reqLobsters[grade] || 0) + req.lobsters[grade];
                }
            }
        }

        if (this.player.coins < reqCoins) return false;
        if (this.player.seaweed < reqSeaweed) return false;
        if (this.player.cages < reqCages) return false;

        let myLobs = this.myInventory.map(item => getGradeValue(item.data.grade));
        myLobs.sort((a, b) => a - b);

        let reqLobs: number[] = [];
        for (const g in reqLobsters) {
            for (let i = 0; i < reqLobsters[g]; i++) reqLobs.push(getGradeValue(g));
        }
        reqLobs.sort((a, b) => b - a);

        let usedIndices = new Set<number>();
        for (const reqVal of reqLobs) {
            let satisfied = false;
            for (let i = 0; i < myLobs.length; i++) {
                if (!usedIndices.has(i) && myLobs[i] >= reqVal) {
                    usedIndices.add(i);
                    satisfied = true;
                    break;
                }
            }
            if (!satisfied) return false;
        }

        return true;
    }

    private getCardById(cardId: string): any {
        for (const tavern of this.taverns) {
            for (const card of tavern.cards || []) {
                if (card.id === cardId) return card;
            }
        }
        return null;
    }

    // 【修改点3】：渲染酒楼，改用 oneTavernTemplate
    private renderTaverns() {
        this.tavernGroupNodes.forEach(n => n.destroy());
        this.tavernGroupNodes = [];
        this.headerNodes = [];
        this.cardNodes = [];

        // 辅助函数：专门用来配置一张具体的卡牌节点（左或右）
        const setupCardNode = (node: Node, card: any, tId: number, hasCompleted: boolean, isDummy: boolean) => {
            node.active = true;
            const nameLabel = node.getChildByName('NameLabel')?.getComponent(Label);
            const reqLabel = node.getChildByName('ReqLabel')?.getComponent(Label);
            const effectLabel = node.getChildByName('EffectLabel')?.getComponent(Label);

            if (isDummy || !card) {
                if (nameLabel) nameLabel.string = "【暂无卡牌】";
                if (reqLabel) reqLabel.string = "";
                if (effectLabel) effectLabel.string = "";
                const btn = node.getComponent(Button);
                if (btn) btn.interactable = false;
                (node as any)._cardData = { tavernId: tId, isDummy: true, hasCompleted: true };
                this.cardNodes.push(node);
                return;
            }

            let rewardStr = "";
            if (card.reward) {
                if (card.reward.de) rewardStr += `道+${card.reward.de} `;
                if (card.reward.wang) rewardStr += `运+${card.reward.wang} `;
            }
            if (nameLabel) nameLabel.string = `【${card.name}】 🎁${rewardStr}`;

            let reqStr = "消耗: ";
            const reqs = card.requirements || {};
            if (reqs.coins) reqStr += `贝币x${reqs.coins} `;
            if (reqs.seaweed) reqStr += `仙草x${reqs.seaweed} `;
            if (reqs.cages) reqStr += `灵鼎x${reqs.cages} `;
            if (reqs.lobsters) {
                Object.keys(reqs.lobsters).forEach(k => {
                    reqStr += `${GRADE_NAMES[k] ? GRADE_NAMES[k].split('(')[0] : k}x${reqs.lobsters[k]} `;
                });
            }
            if (reqLabel) reqLabel.string = reqStr;
            if (effectLabel) effectLabel.string = card.effectDesc ? `效果: ${card.effectDesc}` : "";

            node.on(Button.EventType.CLICK, () => {
                if (hasCompleted) return;
                if (this.isNakedTribute) {
                    this.selectedTavernId = tId;
                    this.refreshUI();
                    return;
                }

                const btn = node.getComponent(Button);
                if (!btn || !btn.interactable) return;

                if (this.selectedTavernId !== tId) {
                    if (!this.checkResources([card])) {
                        this.hintLabel.string = "❌ 资源不足，无法完成该卡牌";
                        return;
                    }
                    this.selectedTavernId = tId;
                    this.selectedCardIds = [card.id];
                } else {
                    const idx = this.selectedCardIds.indexOf(card.id);
                    if (idx > -1) {
                        this.selectedCardIds.splice(idx, 1);
                        if (this.selectedCardIds.length === 0) this.selectedTavernId = -1;
                    } else {
                        const selectedCardsObjs = this.selectedCardIds.map(cid => this.getCardById(cid));
                        selectedCardsObjs.push(card);
                        if (!this.checkResources(selectedCardsObjs)) {
                            this.hintLabel.string = "❌ 资源不足以同时献祭这两张卡牌";
                            return;
                        }
                        this.selectedCardIds.push(card.id);
                    }
                }
                this.refreshUI();
            }, this);

            (node as any)._cardData = { tavernId: tId, cardObj: card, hasCompleted: hasCompleted, isDummy: false };
            this.cardNodes.push(node);
        };

        for (let tId = 0; tId < this.taverns.length; tId++) {
            const tavern = this.taverns[tId];
            const cards = tavern.cards || [];

            const gs = NetworkManager.instance.getGameState();
            const tavernOrder = gs.tavernCompletionOrder || {};
            const totalOccupants = (tavernOrder[tId] || tavernOrder[tId.toString()] || []).length;
            const nextScore = Math.max(0, 3 - totalOccupants);
            const hasCompleted = this.player.tavernCompletions && this.player.tavernCompletions[tId] !== undefined;

            let myScore = 0;
            if (hasCompleted) {
                const compVal = this.player.tavernCompletions[tId];
                if (typeof compVal === 'number') {
                    myScore = Math.max(0, 4 - compVal);
                } else {
                    const orderList = (tavernOrder[tId] || tavernOrder[tId.toString()] || []);
                    const rank = orderList.findIndex((pid: any) => Number(pid) === Number(this.player.id));
                    myScore = rank !== -1 ? Math.max(0, 3 - rank) : 0;
                }
            }

            // 为了应对未来可能多于2张卡牌的情况，按每2张卡切割成一组生成
            const pairs = [];
            for (let i = 0; i < Math.max(1, cards.length); i += 2) {
                pairs.push(cards.slice(i, i + 2));
            }

            for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
                const pair = pairs[pIdx];

                // 实例化整组
                const groupNode = instantiate(this.oneTavernTemplate);
                groupNode.active = true;
                this.tavernScrollViewContent.addChild(groupNode);
                this.tavernGroupNodes.push(groupNode);

                const headerNode = groupNode.getChildByName('TavernHeaderTemplate');
                const cardLeft = groupNode.getChildByName('CardTemplate_left');
                const cardRight = groupNode.getChildByName('CardTemplate_right');

                // 设置表头 (只在第一排显示酒楼表头)
                if (pIdx === 0 && headerNode) {
                    headerNode.on(Button.EventType.CLICK, () => {
                        if (hasCompleted) return;
                        if (this.selectedTavernId === tId) {
                            this.selectedTavernId = -1;
                            this.selectedCardIds = [];
                        } else {
                            this.selectedTavernId = tId;
                            this.selectedCardIds = [];
                        }
                        this.refreshUI();
                    }, this);

                    (headerNode as any)._tavernData = { tId, nextScore, hasCompleted, myScore };
                    this.headerNodes.push(headerNode);
                } else if (headerNode) {
                    headerNode.active = false;
                }

                // 注入卡牌数据
                if (cards.length === 0) {
                    if (cardLeft) setupCardNode(cardLeft, null, tId, true, true);
                    if (cardRight) cardRight.active = false;
                } else {
                    if (cardLeft) setupCardNode(cardLeft, pair[0], tId, hasCompleted, false);

                    if (pair.length > 1) {
                        if (cardRight) setupCardNode(cardRight, pair[1], tId, hasCompleted, false);
                    } else {
                        if (cardRight) cardRight.active = false; // 只有一张卡时，隐藏右侧
                    }
                }
            }
        }
    }

    // 【修改点4】：渲染背包，动态替换底框和内图
    private renderInventory() {
        this.itemNodes.forEach(n => n.destroy());
        this.itemNodes = [];

        for (let i = 0; i < this.myInventory.length; i++) {
            const item = this.myInventory[i];
            const node = instantiate(this.itemTemplate);
            node.active = true;
            this.inventoryContent.addChild(node);

            // 获取节点：假设底图在根节点，里面的虾图在名为 'Sprite' 的子节点
            const frameSprite = node.getComponent(Sprite);
            const iconSprite = node.getChildByName('Sprite')?.getComponent(Sprite);

            const label = node.getComponentInChildren(Label);
            if (label) {
                if (item.data.grade) {
                    label.string = GRADE_NAMES_WITH_SCORE[item.data.grade] || item.data.grade;
                } else {
                    label.string = `🔖[${item.data.name}](4分)`;
                }
            }

            // 核心逻辑：根据 grade 切换预加载好的图片
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

            const val = getGradeValue(item.data.grade);
            (node as any)._itemData = { id: item.id, val: val, originalIndex: item.originalIndex, isTitle: !item.data.grade };

            node.on(Button.EventType.CLICK, () => {
                if (this.isConfirmed) return;
                
                const idxInSelected = this.selectedItemIds.indexOf(item.id);
                if (idxInSelected > -1) {
                    this.selectedItemIds.splice(idxInSelected, 1);
                } else {
                    if (this.reqLobsterCount <= 1) {
                        this.selectedItemIds = [item.id];
                    } else {
                        this.selectedItemIds.push(item.id);
                        if (this.selectedItemIds.length > this.reqLobsterCount) {
                            this.selectedItemIds.shift();
                        }
                    }
                }
                this.refreshUI();
            }, this);

            this.itemNodes.push(node);
        }
    }

    private refreshUI() {
        this.resourceLabel.string = `拥有: 贝币:${this.player.coins} 仙草:${this.player.seaweed} 灵鼎:${this.player.cages} 灵螯:${this.player.lobsters?.length || 0} | 道:${this.player.de} 运:${this.player.wang}`;

        const nakedLabel = this.btnToggleNaked.getComponentInChildren(Label);
        if (nakedLabel) nakedLabel.string = this.isNakedTribute ? "直接献祭 (开)" : "直接献祭 (关)";
        this.btnToggleNaked.getComponent(Sprite).color = this.isNakedTribute ? new Color(255, 100, 100) : new Color(220, 220, 220);

        this.btnRewardDe.interactable = this.isNakedTribute;
        this.btnRewardWang.interactable = this.isNakedTribute;
        if (this.isNakedTribute) {
            this.btnRewardDe.getComponent(Sprite).color = (this.rewardChoice === 'de') ? new Color(100, 200, 255) : new Color(220, 220, 220);
            this.btnRewardWang.getComponent(Sprite).color = (this.rewardChoice === 'wang') ? new Color(100, 200, 255) : new Color(220, 220, 220);
        } else {
            this.btnRewardDe.getComponent(Sprite).color = new Color(200, 200, 200, 150);
            this.btnRewardWang.getComponent(Sprite).color = new Color(200, 200, 200, 150);
        }

        let hasTitleBonus = false;
        for (const itemId of this.selectedItemIds) {
            const item = this.myInventory.find(i => i.id === itemId);
            if (item) {
                if (!item.data.grade || item.data.name) {
                    hasTitleBonus = true;
                    break;
                }
            }
        }

        if (this.btnBonusDe && this.btnBonusWang) {
            this.btnBonusDe.node.active = hasTitleBonus;
            this.btnBonusWang.node.active = hasTitleBonus;

            if (hasTitleBonus) {
                this.btnBonusDe.interactable = true;
                this.btnBonusWang.interactable = true;
                this.btnBonusDe.getComponent(Sprite).color = (this.bonusChoice === 'de') ? new Color(255, 200, 100) : new Color(220, 220, 220);
                this.btnBonusWang.getComponent(Sprite).color = (this.bonusChoice === 'wang') ? new Color(255, 200, 100) : new Color(220, 220, 220);
            }
        }

        this.headerNodes.forEach(node => {
            const hData = (node as any)._tavernData;
            const label = node.getComponent(Label);
            if (label) {
                if (hData.hasCompleted) {
                    // label.string = `[${hData.tId + 1}号楼] (你已入驻) 席位分: ${hData.myScore}分`;
                    label.string = `此祭坛你已献祭过`;
                    label.color = new Color(136, 104, 165);
                } else {
                    const isSelected = (this.selectedTavernId === hData.tId);
                    // label.string = `${isSelected ? "👉 " : ""}[${hData.tId + 1}号楼] 剩余席位分: ${hData.nextScore}分`;
                    label.string = `[${hData.tId + 1}号祭坛] (${hData.nextScore}分)`;
                    label.color = isSelected ? new Color(231, 231, 77) : new Color(255, 255, 255);
                }
            }
        });

        let needsLobster = false;
        let minReqVal = 0;
        this.reqLobsterCount = 0;

        if (this.isNakedTribute) {
            needsLobster = true;
            minReqVal = 1;
            this.reqLobsterCount = 1;
        } else if (this.selectedCardIds.length > 0) {
            let minFound = 999;
            for (const cid of this.selectedCardIds) {
                const card = this.getCardById(cid);
                if (card && card.requirements && card.requirements.lobsters) {
                    needsLobster = true;
                    for (const grade in card.requirements.lobsters) {
                        const v = getGradeValue(grade);
                        if (v < minFound) minFound = v;
                        this.reqLobsterCount += card.requirements.lobsters[grade];
                    }
                }
            }
            if (needsLobster) minReqVal = minFound;
        }

        if (this.selectedItemIds.length > this.reqLobsterCount) {
            this.selectedItemIds = this.selectedItemIds.slice(this.selectedItemIds.length - this.reqLobsterCount);
        }

        this.cardNodes.forEach(node => {
            const cData = (node as any)._cardData;
            const sprite = node.getComponent(Sprite);
            const btn = node.getComponent(Button);

            if (cData.isDummy) {
                if(sprite) sprite.color = new Color(220, 220, 220);
                if (btn) btn.interactable = false;
            } else if (cData.hasCompleted) {
                if(sprite) sprite.color = new Color(200, 200, 200);
                if (btn) btn.interactable = false;
            } else if (this.isNakedTribute) {
                if(sprite) sprite.color = (this.selectedTavernId === cData.tavernId) ? new Color(235, 235, 235) : new Color(245, 245, 245);
                if (btn) btn.interactable = true;
            } else {
                const canAffordSingle = this.checkResources([cData.cardObj]);
                if (!canAffordSingle) {
                    if(sprite) sprite.color = new Color(255, 235, 235);
                    if (btn) btn.interactable = false;
                } else {
                    if (btn) btn.interactable = true;
                    const isSelected = this.selectedTavernId === cData.tavernId && this.selectedCardIds.includes(cData.cardObj.id);
                    if(sprite) sprite.color = isSelected ? new Color(255, 200, 100) : new Color(240, 240, 240);
                }
            }
        });

        this.inventoryScrollView.active = needsLobster;

        let visibleItemCount = 0;
        this.itemNodes.forEach(node => {
            const itemData = (node as any)._itemData;
            const isValid = itemData.val >= minReqVal;
            node.active = isValid;
            if (isValid) visibleItemCount++;

            if (!isValid && this.selectedItemIds.includes(itemData.id)) {
                this.selectedItemIds = this.selectedItemIds.filter(id => id !== itemData.id);
            }

            const sprite = node.getComponent(Sprite);
            if (sprite) {
                const isSelected = this.selectedItemIds.includes(itemData.id);
                sprite.color = isSelected ? new Color(100, 200, 100) : new Color(255, 255, 255);
            }
        });

        let canConfirm = false;

        if (this.isNakedTribute) {
            if (this.selectedTavernId === -1) {
                this.hintLabel.string = "直接献祭：请先选择你要封禅的祭坛";
            } else if (needsLobster && visibleItemCount === 0) {
                this.hintLabel.string = "❌ 你的背包中没有【3级以上】的灵螯，无法直接献祭！";
            } else if (this.selectedItemIds.length === this.reqLobsterCount) {
                this.hintLabel.string = `✅ 确认献祭此祭品，直接献祭封禅 ${this.selectedTavernId + 1} 号祭坛吗？`;
                canConfirm = true;
            } else {
                this.hintLabel.string = "直接献祭：请在下方选择【1只】3级以上灵螯";
            }
        } else {
            if (this.selectedTavernId === -1 || this.selectedCardIds.length === 0) {
                this.hintLabel.string = "请先选择祭坛，再选择石板";
            } else {
                if (needsLobster) {
                    if (visibleItemCount === 0) {
                        this.hintLabel.string = "❌ 你的背包中没有符合该卡牌品级要求的祭品！";
                    } else if (this.selectedItemIds.length === this.reqLobsterCount) {
                        if (this.validateSelectedLobsters()) {
                            this.hintLabel.string = `✅ 已选择 ${this.selectedCardIds.length} 张卡牌与 ${this.reqLobsterCount} 个祭品，点击确认！`;
                            canConfirm = true;
                        } else {
                            this.hintLabel.string = "❌ 所选祭品种类不足以满足卡牌品级要求！";
                        }
                    } else {
                        this.hintLabel.string = `👇 此卡牌需要 ${this.reqLobsterCount} 个祭品，请在下方选择 (已选: ${this.selectedItemIds.length}/${this.reqLobsterCount})`;
                    }
                } else {
                    this.hintLabel.string = `✅ 已选择 ${this.selectedCardIds.length} 张卡牌，点击确认上交资源！`;
                    canConfirm = true;
                }
            }
        }

        if (this.isWaitingChoice) {
            this.hintLabel.string = "⏳ 等待选择结果...";
            this.btnConfirm.interactable = false;
        } else {
            this.btnConfirm.interactable = canConfirm;
        }
    }

    public onBtnToggleNakedClicked() {
        this.isNakedTribute = !this.isNakedTribute;
        this.selectedTavernId = -1;
        this.selectedCardIds = [];
        this.selectedItemIds = [];
        this.refreshUI();
    }

    public onBtnRewardDeClicked() { this.rewardChoice = 'de'; this.refreshUI(); }
    public onBtnRewardWangClicked() { this.rewardChoice = 'wang'; this.refreshUI(); }

    public onBtnBonusDeClicked() { this.bonusChoice = 'de'; this.refreshUI(); }
    public onBtnBonusWangClicked() { this.bonusChoice = 'wang'; this.refreshUI(); }

    private validateSelectedLobsters(): boolean {
        if (this.isNakedTribute || this.selectedCardIds.length === 0) return true;

        const reqLobsters: { [grade: string]: number } = {};
        for (const cid of this.selectedCardIds) {
            const card = this.getCardById(cid);
            if (card && card.requirements && card.requirements.lobsters) {
                for (const grade in card.requirements.lobsters) {
                    reqLobsters[grade] = (reqLobsters[grade] || 0) + card.requirements.lobsters[grade];
                }
            }
        }
        if (Object.keys(reqLobsters).length === 0) return true;

        const selectedValues = this.selectedItemIds.map(id => {
            const item = this.myInventory.find(i => i.id === id);
            return item ? getGradeValue(item.data.grade) : 0;
        }).filter(v => v >= 0);
        selectedValues.sort((a, b) => a - b);

        const reqValues: number[] = [];
        for (const grade in reqLobsters) {
            for (let i = 0; i < reqLobsters[grade]; i++) {
                reqValues.push(getGradeValue(grade));
            }
        }
        reqValues.sort((a, b) => b - a);

        const usedIndices = new Set<number>();
        for (const reqVal of reqValues) {
            let matched = false;
            for (let i = 0; i < selectedValues.length; i++) {
                if (!usedIndices.has(i) && selectedValues[i] >= reqVal) {
                    usedIndices.add(i);
                    matched = true;
                    break;
                }
            }
            if (!matched) return false;
        }
        return true;
    }

    public onBtnConfirmClicked() {
        this.isConfirmed = true;
        this.btnConfirm.interactable = false;

        if (!this.isNakedTribute) {
            if (!this.validateSelectedLobsters()) {
                this.hintLabel.string = "❌ 所选祭品种类不足以满足卡牌品级要求！";
                this.btnConfirm.interactable = true;
                return;
            }
        }

        let hasTitleBonus = false;
        for (const itemId of this.selectedItemIds) {
            const item = this.myInventory.find(i => i.id === itemId);
            if (item && (!item.data.grade || item.data.name)) {
                hasTitleBonus = true;
                break;
            }
        }

        let payloadData: any = {
            isNaked: this.isNakedTribute,
            nakedRewardType: this.isNakedTribute ? this.rewardChoice : null,
            bonusTributeChoice: hasTitleBonus ? this.bonusChoice : null
        };

        if (this.isNakedTribute) {
            const itemId = this.selectedItemIds[0];
            const item = this.myInventory.find(i => i.id === itemId);
            payloadData.nakedLobsterIndex = item.originalIndex;
            payloadData.tavernId = this.selectedTavernId;
        } else {
            payloadData.tavernId = this.selectedTavernId;
            payloadData.cardIds = this.selectedCardIds;
            payloadData.selectedLobsterIds = this.selectedItemIds;
        }

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: {
                actionType: 'submitTribute',
                payload: payloadData
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

    private _onTributeChoiceRequired = (data: any) => {
        const payload = data.data || data;

        if (payload.playerId !== this.player.id) {
            return;
        }

        this.isWaitingChoice = true;
        this.pendingChoiceTaskId = payload.taskId;
        this.pendingChoiceType = payload.choiceType;
        this.choiceOptions = payload.options || [];

        if (this.btnConfirm && this.btnConfirm.node) this.btnConfirm.node.active = false;
        if (this.btnSkip && this.btnSkip.node) this.btnSkip.node.active = false;

        if (this.waitingChoiceNode) {
            this.waitingChoiceNode.active = true;
        }

        if (this.choiceContainer) {
            this.choiceContainer.removeAllChildren();
            this.choiceContainer.active = true;
        }

        if (this.pendingChoiceType === 'buy_advanced_lobster') {
            this.waitingChoiceLabel.string = "🎁 上供触发效果：请选择购买高级龙虾的品级";
            this.choiceOptions.forEach(opt => {
                const cost = opt.grade === 'grade1' ? 3 : (opt.grade === 'grade2' ? 2 : 1);
                const canAfford = this.player.coins >= cost;
                this.createDynamicChoiceBtn(`花费${cost}金购买 ${GRADE_NAMES[opt.grade]}`, opt.grade, cost, canAfford);
            });
        }
        else if (this.pendingChoiceType === 'discard_attack') {
            this.waitingChoiceLabel.string = "🎁 上供触发效果：请选择其他玩家弃置的资源类型";
            this.createDynamicChoiceBtn("弃置龙虾 🦞", "discard", "lobster");
            this.createDynamicChoiceBtn("弃置虾笼 🛒", "discard", "cage");
        }
    }

    private _submitChoice(action: string, gradeCost: number | string | null) {
        if (!this.pendingChoiceTaskId) {
            return;
        }

        if (this.choiceContainer) this.choiceContainer.active = false;

        if (this.waitingChoiceLabel) {
            this.waitingChoiceLabel.string = "⏳ 选项提交中，等待结算...";
        }

        const choicePayload: any = { action };

        if (action === 'discard') {
            choicePayload.targetType = gradeCost;
        } else {
            choicePayload.grade = action;
            choicePayload.cost = gradeCost as number;
        }

        NetworkManager.instance.send('clientGameAction', 'areaAction', {
            payload: {
                actionType: 'submitTributeChoice',
                payload: {
                    taskId: this.pendingChoiceTaskId,
                    choice: choicePayload
                }
            }
        });
    }

    private _hideChoiceUI() {
        this.isWaitingChoice = false;
        this.pendingChoiceType = null;
        this.choiceOptions = [];

        this._cleanupChoiceUI();
    }

    private _onError = (data: any) => {
        if (data.message && data.message.indexOf('金币不足') !== -1 && this.isWaitingChoice) {
            this.waitingChoiceLabel.string = "⚠️ 金币不足，购买取消";
            this._hideChoiceUI();
            return;
        }
        if (data.code === 'DUPLICATE_REQUEST' && this.pendingChoiceTaskId) {
            setTimeout(() => {
                if (this.pendingChoiceTaskId && this.pendingChoiceType && this.choiceOptions) {
                    let choice: any = { action: 'retry' };
                    if (this.pendingChoiceType === 'discard_attack') {
                        choice = { action: 'discard', targetType: 'lobster' };
                    } else if (this.pendingChoiceType === 'buy_advanced_lobster' && this.choiceOptions[0]) {
                        choice = this.choiceOptions[0];
                        choice.action = choice.grade;
                    }
                    NetworkManager.instance.send('clientGameAction', 'areaAction', {
                        payload: {
                            actionType: 'submitTributeChoice',
                            payload: {
                                taskId: this.pendingChoiceTaskId,
                                choice: choice
                            }
                        }
                    });
                }
            }, 600);
        }
    }

    protected onDestroy() {
        this._cleanup();
        this.isWaitingChoice = false;
        this.pendingChoiceTaskId = null;
        this.pendingChoiceType = null;
        this.choiceOptions = [];
        this._cleanupChoiceUI();
    }

    private _cleanup() {
        NetworkManager.instance.eventTarget.off('tributeChoiceRequired', this._onTributeChoiceRequired, this);
        NetworkManager.instance.eventTarget.off('error', this._onError, this);
    }
}