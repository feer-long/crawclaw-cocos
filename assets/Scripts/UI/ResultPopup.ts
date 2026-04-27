import { _decorator, Component, Label, Node, instantiate, Color, director, Button, Layout } from 'cc';
import { calculateEstimatedScore } from '../Data/GameConstants';
const { ccclass, property } = _decorator;

@ccclass('ResultPopup')
export class ResultPopup extends Component {

    @property(Node) public listContent: Node = null;
    @property(Node) public itemTemplate: Node = null;
    @property(Button) public btnReturn: Button = null;

    public init(data: any) {
        const gameState = data.gameState;
        if (!gameState) return;

        const players = gameState.players || [];
        
        if (gameState.status === 'waitingEndgameChoice') {
            const waitingList = gameState.waitingForEndgameChoice || [];
            const currentIndex = gameState.endgameChoiceIndex || 0;
            const currentPlayer = waitingList[currentIndex];
            if (this.btnReturn) {
                const btnLabel = this.btnReturn.getComponentInChildren(Label);
                if (btnLabel) btnLabel.string = `⏳ 等待 ${currentPlayer?.playerName || '他人'} 选择中...`;
                this.btnReturn.interactable = false;
            }
        } else {
            if (this.btnReturn) {
                const btnLabel = this.btnReturn.getComponentInChildren(Label);
                if (btnLabel) btnLabel.string = "返回大厅";
                this.btnReturn.interactable = true;
            }
        }

        // 1. 计算每个玩家的详细得分
        const results = players.map((p: any) => {
            const stats = this.calculateFinalScore(p, gameState);
            return { player: p, ...stats };
        });

        // 2. 排序：总分从大到小，同分比拼金币
        results.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            return b.player.coins - a.player.coins;
        });

        // 3. 渲染列表
        this.listContent.removeAllChildren();
        if (this.itemTemplate) this.itemTemplate.active = false;

        results.forEach((res, index) => {
            const node = instantiate(this.itemTemplate);
            node.active = true;
            this.listContent.addChild(node);

            // 兼容性抓取：无论节点是直接放在根节点下，还是放在 TopContainer 里，都能抓到！
            const topContainer = node.getChildByName('TopContainer') || node;
            const rankLabel = topContainer.getChildByName('RankLabel')?.getComponent(Label);
            const nameLabel = topContainer.getChildByName('NameLabel')?.getComponent(Label);
            const scoreLabel = topContainer.getChildByName('ScoreLabel')?.getComponent(Label);

            // 【核心修复1】：精准抓取 DetailLabel 填入总览数据
            const detailLabel = topContainer.getChildByName('DetailLabel')?.getComponent(Label)
                || topContainer.getChildByName('SummaryLabel')?.getComponent(Label);

            const btnExpand = topContainer.getChildByName('BtnExpand')?.getComponent(Button);
            const arrowLabel = btnExpand?.node.getComponentInChildren(Label);

            const detailsContainer = node.getChildByName('DetailsContainer');
            const detailCore = detailsContainer?.getChildByName('DetailCore')?.getComponent(Label);
            const detailTavern = detailsContainer?.getChildByName('DetailTavern')?.getComponent(Label);
            const detailRes = detailsContainer?.getChildByName('DetailRes')?.getComponent(Label);

            // ==========================================
            // 颜色与基础信息渲染
            // ==========================================
            if (rankLabel) {
                rankLabel.string = `第 ${index + 1} 名`;
                if (index === 0) rankLabel.color = new Color(255, 215, 0); // 金色
                else if (index === 1) rankLabel.color = new Color(200, 230, 255); // 冰蓝色
                else if (index === 2) rankLabel.color = new Color(255, 184, 115); // 亮铜色
                else rankLabel.color = new Color(255, 255, 255); // 白色
            }

            if (nameLabel) nameLabel.string = res.player.name;
            if (scoreLabel) scoreLabel.string = `${res.total} 分`;

            // 成功填充你要求的总览格式！
            const bonusStr = res.bonusPoints > 0 ? ` | 额外: ${res.bonusPoints}分` : "";
            if (detailLabel) detailLabel.string = `德望: ${res.core}分 | 席位: ${res.tavern}分 | 资源: ${res.res}分${bonusStr}`;

            // ==========================================
            // 详细算式渲染
            // ==========================================
            if (detailCore) {
                detailCore.string = `核心乘积分 =（映射值德${res.deValue} * 望${res.wangValue}）+ 德奖${res.deBonus} + 望奖${res.wangBonus} = ${res.core}分`;
            }
            if (detailTavern) detailTavern.string = `上供席位分 =（${res.tavernList.length > 0 ? res.tavernList.join(' + ') : '0'} = ${res.tavern}分）`;
            if (detailRes) detailRes.string = `资源转换分 =（金币折算${res.coinsScore} + 海草折算${res.seaweedScore} + 虾笼折算${res.cagesScore} + 龙虾折算${res.lobstersScore} = ${res.res}分）`;

            // ==========================================
            // 下拉展开交互逻辑
            // ==========================================
            let isExpanded = false;
            if (btnExpand) {
                btnExpand.node.on(Button.EventType.CLICK, () => {
                    isExpanded = !isExpanded;
                    if (detailsContainer) detailsContainer.active = isExpanded;
                    if (arrowLabel) arrowLabel.string = isExpanded ? "▲" : "▼";

                    // 强制刷新外层 ScrollView 的高度排版
                    const layout = this.listContent.getComponent(Layout);
                    if (layout) layout.updateLayout();
                }, this);
            }
        });
    }

    private calculateFinalScore(player: any, gameState: any) {
        return calculateEstimatedScore(player, gameState);
    }

    public onBtnReturnClicked() {
        cc.sys.localStorage.removeItem('currentGameState');
        cc.sys.localStorage.removeItem('myLastPlacedArea');
        cc.sys.localStorage.removeItem('myLastPlacedSlot');
        director.loadScene('Lobby');
    }
}