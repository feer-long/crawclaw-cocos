import { _decorator, Component, Label, Button, Node, instantiate } from 'cc';
const { ccclass, property } = _decorator;

import { GRADE_NAMES } from '../Data/GameConstants';

@ccclass('CardListPopup')
export class CardListPopup extends Component {
    @property(Label) public titleLabel: Label = null;
    @property(Node) public content: Node = null;
    @property(Node) public oneTavern: Node = null;
    @property(Node) public Sprite_title: Node = null;
    @property(Node) public CardTemplate_left: Node = null;
    @property(Node) public CardTemplate_right: Node = null;
    @property(Button) public btnClose: Button = null;

    private cardNodes: Node[] = [];

    public init(cards: any[], playerName?: string) {
        if (this.titleLabel) {
            this.titleLabel.string = playerName
                ? `[${playerName}] 的上供卡`
                : `我的上供卡 (${cards.length})`;
        }

        this.cardNodes.forEach(n => n.destroy());
        this.cardNodes = [];

        if (this.content && this.oneTavern && cards.length > 0) {
            this.content.removeAllChildren();

            for (let i = 0; i < cards.length; i += 2) {
                const pair = cards.slice(i, i + 2);
                const groupNode = instantiate(this.oneTavern);
                groupNode.active = true;
                this.content.addChild(groupNode);

                const leftSlot = groupNode.getChildByName('CardTemplate_left');
                const rightSlot = groupNode.getChildByName('CardTemplate_right');

                if (leftSlot) this._setupCardNode(leftSlot, pair[0]);

                if (rightSlot) {
                    if (pair.length > 1) {
                        this._setupCardNode(rightSlot, pair[1]);
                    } else {
                        rightSlot.active = false;
                    }
                }
            }
        }
    }

    private _setupCardNode(node: Node, card: any) {
        if (!node) return;
        node.active = true;
        const nameLabel = node.getChildByName('NameLabel')?.getComponent(Label) || node.getComponentInChildren(Label);
        const reqLabel = node.getChildByName('ReqLabel')?.getComponent(Label);
        const effectLabel = node.getChildByName('EffectLabel')?.getComponent(Label);

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
                const gradeName = GRADE_NAMES[k] ? GRADE_NAMES[k].split('(')[0] : k;
                reqStr += `${gradeName}x${reqs.lobsters[k]} `;
            });
        }
        if (reqLabel) reqLabel.string = reqStr;
        if (effectLabel) effectLabel.string = card.effectDesc ? `效果: ${card.effectDesc}` : "";

        this.cardNodes.push(node);
    }

    public onBtnCloseClicked() {
        this.node.destroy();
    }
}
