import { _decorator, Component, Node, Prefab, instantiate, Label, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

// 对应的映射分数，下标 0-15 对应这 16 个值
const VALUE_MAP = [1, 2, 3, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 10];

@ccclass('DeWangTrackView')
export class DeWangTrackView extends Component {
    @property(Node) public deTrackContainer: Node = null; // 德轨道容器
    @property(Node) public wangTrackContainer: Node = null; // 望轨道容器

    @property(Prefab) public trackCellPrefab: Prefab = null; // 轨道单个格子预制体
    @property(Prefab) public playerMarkerPrefab: Prefab = null; // 玩家棋子预制体

    private deCells: Node[] = [];
    private wangCells: Node[] = [];
    private playerMarkers: Node[] = []; // 用于统一管理并清理棋子

    onLoad() {
        this.buildTracks();
    }

    /**
     * 初始化构建16个格子
     */
    private buildTracks() {
        if (!this.deTrackContainer || !this.wangTrackContainer || !this.trackCellPrefab) return;

        this.deTrackContainer.removeAllChildren();
        this.wangTrackContainer.removeAllChildren();

        for (let i = 0; i < 16; i++) {
            // 生成德格子 (传入 true，展示 ValueLabel)
            const deCell = instantiate(this.trackCellPrefab);
            this.deTrackContainer.addChild(deCell);
            this.setupCell(deCell, i, true);
            this.deCells.push(deCell);

            // 生成望格子 (传入 false，隐藏 ValueLabel，避免重复)
            const wangCell = instantiate(this.trackCellPrefab);
            this.wangTrackContainer.addChild(wangCell);
            this.setupCell(wangCell, i, false);
            this.wangCells.push(wangCell);
        }
    }

    /**
     * 设置格子的文字显示
     * @param showValue 是否显示分数映射文本
     */
    private setupCell(cellNode: Node, index: number, showValue: boolean) {
        // getComponentsInChildren 会查找当前节点及其所有子层级里的 Label 组件
        const labels = cellNode.getComponentsInChildren(Label);

        let indexLabel: Label = null;
        let valueLabel: Label = null;
        let valueNode: Node = null;

        // 遍历找到对应的节点
        for (let i = 0; i < labels.length; i++) {
            if (labels[i].node.name === 'IndexLabel') {
                indexLabel = labels[i];
            } else if (labels[i].node.name === 'ValueLabel') {
                valueLabel = labels[i];
                valueNode = labels[i].node;
            }
        }

        // 赋值 Index
        if (indexLabel) {
            indexLabel.string = `${index}`;
        } else {
            console.warn(`[DeWangTrackView] 第 ${index} 个格子未找到 IndexLabel`);
        }

        // 赋值并控制 ValueLabel 显隐
        if (valueNode) {
            valueNode.active = showValue;
            if (showValue && valueLabel) {
                valueLabel.string = `${VALUE_MAP[index]}`;
            }
        } else {
            console.warn(`[DeWangTrackView] 第 ${index} 个格子未找到 ValueLabel`);
        }
    }

    /**
     * 外部调用的刷新接口
     */
    public updateTracks(players: any[]) {
        // 1. 清理上一回合的玩家棋子
        this.playerMarkers.forEach(m => {
            if (m && m.isValid) m.destroy();
        });
        this.playerMarkers = [];

        if (this.deCells.length === 0 || this.wangCells.length === 0) return;

        // 2. 统计各个分段有哪些玩家
        const deCounts: Record<number, any[]> = {};
        const wangCounts: Record<number, any[]> = {};

        players.forEach(p => {
            // 防止越界，限制在 0-15 之间
            const deScore = Math.max(0, Math.min(p.de || 0, 15));
            const wangScore = Math.max(0, Math.min(p.wang || 0, 15));

            if (!deCounts[deScore]) deCounts[deScore] = [];
            deCounts[deScore].push(p);

            if (!wangCounts[wangScore]) wangCounts[wangScore] = [];
            wangCounts[wangScore].push(p);
        });

        // 3. 放置棋子
        this.placeMarkers(deCounts, this.deCells);
        this.placeMarkers(wangCounts, this.wangCells);
    }

    /**
     * 放置并处理重叠
     */
    private placeMarkers(counts: Record<number, any[]>, cells: Node[]) {
        for (const scoreStr in counts) {
            const score = parseInt(scoreStr);
            const cell = cells[score];
            if (!cell) continue;

            const occupants = counts[score];
            const total = occupants.length;

            occupants.forEach((p, idx) => {
                if (!this.playerMarkerPrefab) return;

                const marker = instantiate(this.playerMarkerPrefab);
                cell.addChild(marker);
                this.playerMarkers.push(marker);

                // 设置玩家标识
                const nameLabel = marker.getComponentInChildren(Label);
                if (nameLabel) nameLabel.string = `P${p.id}`;

                // 计算重叠偏移
                const offset = this.calculateOffset(idx, total);
                marker.setPosition(new Vec3(offset.x, offset.y, 0));
            });
        }
    }

    /**
     * 计算重叠时的像素偏移（可根据实际UI尺寸微调数值）
     */
    private calculateOffset(index: number, total: number): { x: number, y: number } {
        if (total === 1) return { x: 0, y: 0 };
        if (total === 2) return index === 0 ? { x: -15, y: 0 } : { x: 15, y: 0 };
        if (total === 3) {
            if (index === 0) return { x: -15, y: 10 };
            if (index === 1) return { x: 15, y: 10 };
            return { x: 0, y: -10 };
        }
        // 4人或以上，按照网格排列
        const cols = 2;
        const x = (index % cols) * 20 - 10;
        const y = Math.floor(index / cols) * -20 + 10;
        return { x, y };
    }
}