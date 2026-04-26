import { _decorator, Component, Label, Button, Node, instantiate, Layout } from 'cc';
const { ccclass, property } = _decorator;

import { GRADE_NAMES } from '../Data/GameConstants';

@ccclass('CardListPopup')
export class CardListPopup extends Component {
    @property(Label) public titleLabel: Label = null;
    @property(Node) public content: Node = null;
    @property(Node) public itemTemplate: Node = null;
    @property(Button) public btnClose: Button = null;

    public init(cards: any[], playerName?: string) {
        if (this.titleLabel) {
            if (playerName) {
                this.titleLabel.string = `👀 正在查看 [${playerName}] 的上供卡`;
            } else {
                this.titleLabel.string = `📜 我的上供卡 (${cards.length})`;
            }
        }

        if (this.content && this.itemTemplate) {
            this.itemTemplate.active = false;
            this.content.removeAllChildren();

            // 1. 循环生成并赋值所有卡片
            cards.forEach(card => {
                const node = instantiate(this.itemTemplate);
                node.active = true;
                this.content.addChild(node);

                const nameLabel = node.getChildByName('NameLabel')?.getComponent(Label) || node.getComponentInChildren(Label);
                const reqLabel = node.getChildByName('ReqLabel')?.getComponent(Label);
                const effectLabel = node.getChildByName('EffectLabel')?.getComponent(Label);

                if (nameLabel) {
                    let rewardStr = "";
                    if (card.reward) {
                        if (card.reward.de) rewardStr += `德+${card.reward.de} `;
                        if (card.reward.wang) rewardStr += `望+${card.reward.wang} `;
                    }
                    nameLabel.string = `【${card.name}】 ${rewardStr}`;
                }

                if (reqLabel) {
                    let reqStr = "需求: ";
                    const reqs = card.requirements || {};
                    if (reqs.coins) reqStr += `💰x${reqs.coins} `;
                    if (reqs.seaweed) reqStr += `🌿x${reqs.seaweed} `;
                    if (reqs.cages) reqStr += `🛒x${reqs.cages} `;
                    if (reqs.lobsters) {
                        Object.keys(reqs.lobsters).forEach(k => {
                            const gradeName = GRADE_NAMES[k] || k;
                            reqStr += `${gradeName}x${reqs.lobsters[k]} `;
                        });
                    }
                    reqLabel.string = reqStr;
                }
                if (effectLabel) effectLabel.string = card.effectDesc ? `效果: ${card.effectDesc}` : "";
            });
        }
    }

    public onBtnCloseClicked() {
        this.node.destroy();
    }
}
