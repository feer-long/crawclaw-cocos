import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
import { GRADE_NAMES, getGradeValue } from '../Data/GameConstants';
const { ccclass, property } = _decorator;



@ccclass('TributePopup')
export class TributePopup extends Component {

    @property(Label) public resourceLabel: Label = null;
    @property(Label) public hintLabel: Label = null;

    @property(Node) public tavernScrollViewContent: Node = null;
    @property(Node) public tavernHeaderTemplate: Node = null;
    @property(Node) public cardTemplate: Node = null;

    @property(Node) public inventoryScrollView: Node = null;
    @property(Node) public inventoryContent: Node = null;
    @property(Node) public itemTemplate: Node = null;

    @property(Button) public btnToggleNaked: Button = null;
    @property(Button) public btnRewardDe: Button = null;
    @property(Button) public btnRewardWang: Button = null;

    @property(Button) public btnBonusDe: Button = null;
    @property(Button) public btnBonusWang: Button = null;

    @property(Button) public btnConfirm: Button = null;
    @property(Button) public btnSkip: Button = null;

    @property(Button) public btnBuyGrade3: Button = null;
    @property(Button) public btnBuyGrade2: Button = null;
    @property(Button) public btnBuyGrade1: Button = null;
    @property(Button) public btnDiscardLobster: Button = null;
    @property(Button) public btnDiscardCage: Button = null;
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
        try {
            if (this.waitingChoiceNode) {
                this.waitingChoiceNode.active = false;
            }
            if (this.waitingChoiceLabel) {
                this.waitingChoiceLabel.string = "";
            }
            if (this.btnBuyGrade3 && this.btnBuyGrade3.node) this.btnBuyGrade3.node.active = false;
            if (this.btnBuyGrade2 && this.btnBuyGrade2.node) this.btnBuyGrade2.node.active = false;
            if (this.btnBuyGrade1 && this.btnBuyGrade1.node) this.btnBuyGrade1.node.active = false;
            if (this.btnDiscardLobster && this.btnDiscardLobster.node) this.btnDiscardLobster.node.active = false;
            if (this.btnDiscardCage && this.btnDiscardCage.node) this.btnDiscardCage.node.active = false;
            if (this.btnConfirm && this.btnConfirm.node) this.btnConfirm.node.active = true;
            if (this.btnSkip && this.btnSkip.node) this.btnSkip.node.active = true;
        } catch (e) {
            console.error('清理选择 UI 时出错:', e);
        }
    }

    private buildInventory() {
        this.myInventory = [];
        const lobsters = this.player.lobsters || [];
        const titles = this.player.titleCards || [];

        lobsters.forEach((l: any, idx: number) => {
            this.myInventory.push({ type: 'lobster', data: l, originalIndex: idx, id: l.id || `lob_${idx}` });
        });
        titles.forEach((t: any, idx: number) => {
            this.myInventory.push({ type: 'title', data: t, originalIndex: lobsters.length + idx, id: t.id || `title_${idx}` });
        });
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

        let myLobs = this.myInventory.map(item => item.type === 'title' ? 4 : getGradeValue(item.data.grade));
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

    private renderTaverns() {
        this.headerNodes.forEach(n => n.destroy());
        this.cardNodes.forEach(n => n.destroy());
        this.headerNodes = [];
        this.cardNodes = [];

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
                    // 服务器传来的是入驻次序 (1, 2, 3, 4)，需转换为分数 (3, 2, 1, 0)
                    myScore = Math.max(0, 4 - compVal);
                } else {
                    const orderList = (tavernOrder[tId] || tavernOrder[tId.toString()] || []);
                    const rank = orderList.findIndex((pid: any) => Number(pid) === Number(this.player.id));
                    myScore = rank !== -1 ? Math.max(0, 3 - rank) : 0;
                }
            }

            const headerNode = instantiate(this.tavernHeaderTemplate);
            headerNode.active = true;
            this.tavernScrollViewContent.addChild(headerNode);

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

            if (cards.length === 0) {
                const node = instantiate(this.cardTemplate);
                node.active = true;
                this.tavernScrollViewContent.addChild(node);

                const nameLabel = node.getChildByName('NameLabel')?.getComponent(Label);
                const reqLabel = node.getChildByName('ReqLabel')?.getComponent(Label);
                const effectLabel = node.getChildByName('EffectLabel')?.getComponent(Label);
                if (nameLabel) nameLabel.string = "【暂无卡牌】";
                if (reqLabel) reqLabel.string = "";
                if (effectLabel) effectLabel.string = "";

                const btn = node.getComponent(Button);
                if (btn) btn.interactable = false;

                (node as any)._cardData = { tavernId: tId, isDummy: true, hasCompleted: true };
                this.cardNodes.push(node);
                continue;
            }

            for (let cId = 0; cId < cards.length; cId++) {
                const card = cards[cId];
                const node = instantiate(this.cardTemplate);
                node.active = true;
                this.tavernScrollViewContent.addChild(node);

                const nameLabel = node.getChildByName('NameLabel')?.getComponent(Label);
                const reqLabel = node.getChildByName('ReqLabel')?.getComponent(Label);
                const effectLabel = node.getChildByName('EffectLabel')?.getComponent(Label);

                let rewardStr = "";
                if (card.reward) {
                    if (card.reward.de) rewardStr += `德+${card.reward.de} `;
                    if (card.reward.wang) rewardStr += `望+${card.reward.wang} `;
                }
                if (nameLabel) nameLabel.string = `【${card.name}】 🎁${rewardStr}`;

                let reqStr = "消耗: ";
                const reqs = card.requirements || {};
                if (reqs.coins) reqStr += `💰x${reqs.coins} `;
                if (reqs.seaweed) reqStr += `🌿x${reqs.seaweed} `;
                if (reqs.cages) reqStr += `🛒x${reqs.cages} `;
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
                                this.hintLabel.string = "❌ 资源不足以同时上供这两张卡牌";
                                return;
                            }
                            this.selectedCardIds.push(card.id);
                        }
                    }
                    this.refreshUI();
                }, this);

                (node as any)._cardData = { tavernId: tId, cardObj: card, hasCompleted: hasCompleted, isDummy: false };
                this.cardNodes.push(node);
            }
        }
    }

    private renderInventory() {
        this.itemNodes.forEach(n => n.destroy());
        this.itemNodes = [];

        for (let i = 0; i < this.myInventory.length; i++) {
            const item = this.myInventory[i];
            const node = instantiate(this.itemTemplate);
            node.active = true;
            this.inventoryContent.addChild(node);

            const label = node.getComponentInChildren(Label);
            if (label) {
                if (item.type === 'lobster') {
                    if (item.data.grade === 'royal' && (item.data.title || item.data.name)) {
                        label.string = `🔖[${item.data.title || item.data.name}](4分)`;
                    } else {
                        label.string = GRADE_NAMES[item.data.grade] || item.data.grade;
                    }
                } else {
                    label.string = `🔖[${item.data.name}](4分)`;
                }
            }

            const val = item.type === 'title' ? 4 : getGradeValue(item.data.grade);
            (node as any)._itemData = { id: item.id, val: val, originalIndex: item.originalIndex, isTitle: item.type === 'title' };

            node.on(Button.EventType.CLICK, () => {
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
        this.resourceLabel.string = `拥有: 💰${this.player.coins} 🌿${this.player.seaweed} 🛒${this.player.cages} 🦞${this.player.lobsters?.length || 0} | 德:${this.player.de} 望:${this.player.wang}`;

        const nakedLabel = this.btnToggleNaked.getComponentInChildren(Label);
        if (nakedLabel) nakedLabel.string = this.isNakedTribute ? "🔘 裸交模式 (已开启)" : "🔘 裸交模式 (关闭)";
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
                if (item.type === 'title' || (item.type === 'lobster' && (item.data.title || item.data.name))) {
                    hasTitleBonus = true;
                    break;
                }
            }
        }

        // 【关键排错】：如果在编辑器里没拖入节点，就在控制台报错提醒！
        if (this.btnBonusDe && this.btnBonusWang) {
            this.btnBonusDe.node.active = hasTitleBonus;
            this.btnBonusWang.node.active = hasTitleBonus;

            if (hasTitleBonus) {
                this.btnBonusDe.interactable = true;
                this.btnBonusWang.interactable = true;
                this.btnBonusDe.getComponent(Sprite).color = (this.bonusChoice === 'de') ? new Color(255, 200, 100) : new Color(220, 220, 220);
                this.btnBonusWang.getComponent(Sprite).color = (this.bonusChoice === 'wang') ? new Color(255, 200, 100) : new Color(220, 220, 220);
            }
        } else {
            console.error("❌ 严重错误: 称号额外加成按钮 btnBonusDe 或 btnBonusWang 未在 Cocos 面板绑定！");
        }

        this.headerNodes.forEach(node => {
            const hData = (node as any)._tavernData;
            const label = node.getComponent(Label);
            if (label) {
                if (hData.hasCompleted) {
                    label.string = `[${hData.tId + 1}号楼] (你已入驻) 席位分: ${hData.myScore}分`;
                    label.color = new Color(160, 160, 160);
                } else {
                    const isSelected = (this.selectedTavernId === hData.tId);
                    label.string = `${isSelected ? "👉 " : ""}[${hData.tId + 1}号楼] 剩余席位分: ${hData.nextScore}分`;
                    label.color = isSelected ? new Color(255, 100, 0) : new Color(0, 0, 0);
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
                sprite.color = new Color(220, 220, 220);
                if (btn) btn.interactable = false;
            } else if (cData.hasCompleted) {
                sprite.color = new Color(200, 200, 200);
                if (btn) btn.interactable = false;
            } else if (this.isNakedTribute) {
                sprite.color = (this.selectedTavernId === cData.tavernId) ? new Color(235, 235, 235) : new Color(245, 245, 245);
                if (btn) btn.interactable = true;
            } else {
                const canAffordSingle = this.checkResources([cData.cardObj]);
                if (!canAffordSingle) {
                    sprite.color = new Color(255, 235, 235);
                    if (btn) btn.interactable = false;
                } else {
                    if (btn) btn.interactable = true;
                    const isSelected = this.selectedTavernId === cData.tavernId && this.selectedCardIds.includes(cData.cardObj.id);
                    sprite.color = isSelected ? new Color(255, 200, 100) : new Color(240, 240, 240);
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
                sprite.color = isSelected ? new Color(100, 200, 100) : new Color(220, 240, 255);
            }
        });

        let canConfirm = false;

        if (this.isNakedTribute) {
            if (this.selectedTavernId === -1) {
                this.hintLabel.string = "👈 裸交模式：请先在上方点击表头选择你要入驻的【酒楼】";
            } else if (needsLobster && visibleItemCount === 0) {
                this.hintLabel.string = "❌ 你的背包中没有【3品及以上】的祭品，无法裸交！";
            } else if (this.selectedItemIds.length === this.reqLobsterCount) {
                this.hintLabel.string = `✅ 确认献祭此祭品，裸交入驻 ${this.selectedTavernId + 1} 号楼吗？`;
                canConfirm = true;
            } else {
                this.hintLabel.string = "👇 裸交模式：请在下方选择【1只】3品以上祭品";
            }
        } else {
            if (this.selectedTavernId === -1 || this.selectedCardIds.length === 0) {
                this.hintLabel.string = "👈 请先选择要入驻的酒楼，并勾选要完成的卡牌";
            } else {
                if (needsLobster) {
                    if (visibleItemCount === 0) {
                        this.hintLabel.string = "❌ 你的背包中没有符合该卡牌品级要求的祭品！";
                    } else if (this.selectedItemIds.length === this.reqLobsterCount) {
                        this.hintLabel.string = `✅ 已选择 ${this.selectedCardIds.length} 张卡牌与 ${this.reqLobsterCount} 个祭品，点击确认！`;
                        canConfirm = true;
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

    public onBtnConfirmClicked() {
        this.btnConfirm.interactable = false;

        let hasTitleBonus = false;
        for (const itemId of this.selectedItemIds) {
            const item = this.myInventory.find(i => i.id === itemId);
            if (item && (item.type === 'title' || (item.type === 'lobster' && (item.data.title || item.data.name)))) {
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
        console.log('🎁 收到服务器 tributeChoiceRequired 数据:', data);
        const payload = data.data || data;
        console.log('🎁 parsed payload:', payload);

        if (payload.playerId !== this.player.id) {
            console.log('❌ playerId 不匹配:', payload.playerId, 'vs', this.player.id);
            return;
        }

        this.isWaitingChoice = true;
        this.pendingChoiceTaskId = payload.taskId;
        this.pendingChoiceType = payload.choiceType;
        this.choiceOptions = payload.options || [];

        console.log('✅ 保存的选择信息:', {
            taskId: this.pendingChoiceTaskId,
            choiceType: this.pendingChoiceType,
            options: this.choiceOptions
        });

        if (this.btnConfirm && this.btnConfirm.node) this.btnConfirm.node.active = false;
        if (this.btnSkip && this.btnSkip.node) this.btnSkip.node.active = false;

        if (this.waitingChoiceNode) {
            this.waitingChoiceNode.active = true;
        }

        if (this.pendingChoiceType === 'buy_advanced_lobster') {
            if (this.btnBuyGrade3 && this.btnBuyGrade3.node) this.btnBuyGrade3.node.active = false;
            if (this.btnBuyGrade2 && this.btnBuyGrade2.node) this.btnBuyGrade2.node.active = false;
            if (this.btnBuyGrade1 && this.btnBuyGrade1.node) this.btnBuyGrade1.node.active = false;

            this.choiceOptions.forEach(opt => {
                if (opt.grade === 'grade3' && this.btnBuyGrade3 && this.btnBuyGrade3.node) {
                    this.btnBuyGrade3.node.active = true;
                }
                if (opt.grade === 'grade2' && this.btnBuyGrade2 && this.btnBuyGrade2.node) {
                    this.btnBuyGrade2.node.active = true;
                }
                if (opt.grade === 'grade1' && this.btnBuyGrade1 && this.btnBuyGrade1.node) {
                    this.btnBuyGrade1.node.active = true;
                }
            });

            if (this.waitingChoiceLabel) {
                this.waitingChoiceLabel.string = "🎁 上供触发效果：请选择购买高级龙虾的品级";
            }
        } else if (this.pendingChoiceType === 'discard_attack') {
            if (this.btnDiscardLobster && this.btnDiscardLobster.node) this.btnDiscardLobster.node.active = true;
            if (this.btnDiscardCage && this.btnDiscardCage.node) this.btnDiscardCage.node.active = true;

            if (this.waitingChoiceLabel) {
                this.waitingChoiceLabel.string = "🎁 上供触发效果：请选择其他玩家弃置的资源类型";
            }
        }
    }

    public onBtnBuyGrade3Clicked() {
        this._submitChoice('grade3', 1);
    }

    public onBtnBuyGrade2Clicked() {
        this._submitChoice('grade2', 2);
    }

    public onBtnBuyGrade1Clicked() {
        this._submitChoice('grade1', 3);
    }

    public onBtnDiscardLobsterClicked() {
        this._submitChoice('discard', 'lobster');
    }

    public onBtnDiscardCageClicked() {
        this._submitChoice('discard', 'cage');
    }

    private _submitChoice(action: string, gradeCost: number | string | null) {
        if (!this.pendingChoiceTaskId) {
            console.error('❌ 没有待处理的选择任务 ID');
            return;
        }

        this._hideChoiceUI();

        const choicePayload: any = { action };

        if (action === 'discard') {
            choicePayload.targetType = gradeCost;
        } else {
            choicePayload.grade = action;
            choicePayload.cost = gradeCost as number;
        }

        console.log('📤 提交上供选择:', { taskId: this.pendingChoiceTaskId, choice: choicePayload });

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
        if (data.code === 'DUPLICATE_REQUEST' && this.pendingChoiceTaskId) {
            setTimeout(() => {
                if (this.pendingChoiceTaskId && this.pendingChoiceType && this.choiceOptions) {
                    let choice: any = { action: 'retry' };
                    if (this.pendingChoiceType === 'discard_attack') {
                        choice = { action: 'discard', targetType: 'lobster' };
                    } else if (this.pendingChoiceType === 'buy_advanced_lobster' && this.choiceOptions[0]) {
                        // 默认选择第一个选项
                        choice = this.choiceOptions[0];
                        choice.action = choice.grade;
                    }
                    console.log('🔄 重试上供选择:', { taskId: this.pendingChoiceTaskId, choice });
                    NetworkManager.instance.send('clientGameAction', 'submitTributeChoice', {
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
        // 清空所有 pending 状态
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