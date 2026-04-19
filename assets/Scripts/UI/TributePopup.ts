import { _decorator, Component, Label, Button, Node, instantiate, Color, Sprite } from 'cc';
import { NetworkManager } from '../Network/NetworkManager';
const { ccclass, property } = _decorator;

const GRADE_NAMES: any = { 'normal': '普虾(0分)', 'grade3': '三品(1分)', 'grade2': '二品(2分)', 'grade1': '一品(3分)', 'royal': '👑虾王(4分)' };

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

        this.buildInventory();
        this.renderTaverns();
        this.renderInventory();
        this.refreshUI();
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

    private getGradeValue(grade: string): number {
        const gradeValues: any = { 'normal': 0, 'grade3': 1, 'grade2': 2, 'grade1': 3, 'royal': 4 };
        return gradeValues[grade] || 0;
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

        let myLobs = this.myInventory.map(item => item.type === 'title' ? 4 : this.getGradeValue(item.data.grade));
        myLobs.sort((a, b) => a - b);

        let reqLobs: number[] = [];
        for (const g in reqLobsters) {
            for (let i = 0; i < reqLobsters[g]; i++) reqLobs.push(this.getGradeValue(g));
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

            const occupants = tavern.occupants || [];
            const nextScore = Math.max(0, 4 - occupants.length);
            const hasCompleted = this.player.tavernCompletions && this.player.tavernCompletions[tId] !== undefined;

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

            (headerNode as any)._tavernData = { tId, nextScore, hasCompleted };
            this.headerNodes.push(headerNode);

            if (cards.length === 0) {
                const node = instantiate(this.cardTemplate);
                node.active = true;
                this.tavernScrollViewContent.addChild(node);

                const nameLabel = node.getChildByName('NameLabel')?.getComponent(Label);
                const reqLabel = node.getChildByName('ReqLabel')?.getComponent(Label);
                if (nameLabel) nameLabel.string = "【暂无卡牌】";
                if (reqLabel) reqLabel.string = "";

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

            const val = item.type === 'title' ? 4 : this.getGradeValue(item.data.grade);
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
                    label.string = `[${hData.tId + 1}号楼] (你已入驻) 席位分: ${hData.nextScore}分`;
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
                        const v = this.getGradeValue(grade);
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

        this.btnConfirm.interactable = canConfirm;
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
}