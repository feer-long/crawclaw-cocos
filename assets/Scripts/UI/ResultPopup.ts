import { _decorator, Component, Label, Node, instantiate, Color, director, Button, Layout } from 'cc';
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
            if (detailLabel) detailLabel.string = `德望: ${res.core}分 | 席位: ${res.tavern}分 | 资源: ${res.res}分`;

            // ==========================================
            // 详细算式渲染
            // ==========================================
            if (detailCore) detailCore.string = `核心乘积分 =（德${res.deVal} * 望${res.wangVal} = ${res.core}分）`;
            if (detailTavern) detailTavern.string = `上供席位分 =（${res.tavernList.join(' + ')} = ${res.tavern}分）`;
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
        // ==========================================
        // 1. 核心乘积分
        // ==========================================
        const de = Math.max(player.de || 0, 0);
        const wang = Math.max(player.wang || 0, 0);
        const coreScore = de * wang;

        // ==========================================
        // 2. 上供席位分 (地毯式搜索真实酒楼数据)
        // ==========================================
        const tavernScores: number[] = [];
        let tavernTotal = 0;

        // 优先查看玩家身上是否直接存了 tavernScores (有些后端的写法)
        if (player.tavernScores && player.tavernScores.length > 0) {
            for (let i = 0; i < 6; i++) {
                const score = player.tavernScores[i] || 0;
                tavernScores.push(score);
                tavernTotal += score;
            }
        } else {
            // 【核心修复2】：去 areas.tribute.taverns 中找真正的酒楼席位数组！
            const taverns = gameState.areas?.tribute?.taverns || gameState.taverns || [];

            for (let i = 0; i < 6; i++) {
                let score = 0;
                if (i < taverns.length) {
                    const tavern = taverns[i];
                    // 检查这名玩家在这家酒楼里排第几位
                    if (tavern && tavern.occupants) {
                        const rank = tavern.occupants.findIndex((occ: any) => Number(occ) === Number(player.id));
                        if (rank !== -1) {
                            score = [3, 2, 1, 0][rank] || 0; // 先到先得：3分, 2分, 1分, 0分
                        }
                    }
                }
                tavernScores.push(score);
                tavernTotal += score;
            }
        }

        // ==========================================
        // 3. 资源转换分
        // ==========================================
        const coinsScore = Math.floor((player.coins || 0) / 2);
        const seaweedScore = Math.floor((player.seaweed || 0) / 3);
        const cagesScore = (player.cages || 0) * 2;

        let lobstersScore = 0;
        (player.lobsters || []).forEach((l: any) => {
            const isRoyalTitle = (l.grade === 'royal' && (l.title || l.name)) || l.name === '红头紫' || l.name === '长鳌虾';

            if (isRoyalTitle) {
                lobstersScore += 8;
            } else if (l.grade === 'royal') {
                lobstersScore += 6;
            } else if (l.grade === 'grade1') {
                lobstersScore += 4;
            } else if (l.grade === 'grade2') {
                lobstersScore += 3;
            } else if (l.grade === 'grade3') {
                lobstersScore += 2;
            } else {
                lobstersScore += 1;
            }
        });

        (player.titleCards || []).forEach(() => {
            lobstersScore += 8;
        });

        const resScore = coinsScore + seaweedScore + cagesScore + lobstersScore;

        const total = coreScore + tavernTotal + resScore;

        return {
            deVal: de,
            wangVal: wang,
            core: coreScore,
            tavernList: tavernScores,
            tavern: tavernTotal,
            coinsScore: coinsScore,
            seaweedScore: seaweedScore,
            cagesScore: cagesScore,
            lobstersScore: lobstersScore,
            res: resScore,
            total: total
        };
    }

    public onBtnReturnClicked() {
        cc.sys.localStorage.removeItem('currentGameState');
        cc.sys.localStorage.removeItem('myLastPlacedArea');
        cc.sys.localStorage.removeItem('myLastPlacedSlot');
        director.loadScene('Lobby');
    }
}