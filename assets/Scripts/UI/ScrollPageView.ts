import { _decorator, Component, Node, ScrollView, Vec3, UITransform, Sprite, Color, SpriteFrame, Button } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ScrollPageView')
export class ScrollPageView extends Component {

    @property(ScrollView)
    scrollView: ScrollView = null!;

    @property([Node])
    tabButtons: Node[] = [];    // 五个 Tab 按钮节点

    @property
    scrollTime: number = 0.4;   // 自动滚动动画时长

    @property([SpriteFrame])
    activeSpriteFrames: SpriteFrame[] = [];    // 选中状态背景图数组（对应每个按钮）

    @property([SpriteFrame])
    inactiveSpriteFrames: SpriteFrame[] = [];  // 未选中状态背景图数组（对应每个按钮）

    private currentPage: number = 0;
    private pageWidth: number = 0;
    private isAutoScrolling: boolean = false;
    private isSnapping: boolean = false;

    onLoad() {
        // 获取单页宽度，即视口宽度
        const bgOffset = 18;
        this.pageWidth = this.scrollView.node.getComponent(UITransform).width + bgOffset;

        // 动态设置 content 宽度（确保与页面数量一致）
        const content = this.scrollView.content;
        if (content) {
            const contentTransform = content.getComponent(UITransform);
            contentTransform.width = this.pageWidth * this.tabButtons.length;
            // 同时更新所有子页面宽度
            content.children.forEach((child) => {
                const childTransform = child.getComponent(UITransform);
                if (childTransform) childTransform.width = this.pageWidth - bgOffset;
            });
        }

        // 绑定 Tab 点击事件
        this.tabButtons.forEach((btn, index) => {
            btn.on(Node.EventType.TOUCH_END, () => {
                this.scrollToPage(index);
            }, this);
        });

        // 监听用户手动滑动，实时更新 Tab 高亮
        this.scrollView.node.on('scrolling', this.onScrolling, this);

        // 监听滑动结束，自动吸附到最近页面
        this.scrollView.node.on('scroll-ended', this.onScrollEnd, this);

        // 初始状态：第 0 页，第一个 Tab 高亮
        this.updateTabHighlight(0);
    }

    scrollToPage(index: number) {
        if (!this.scrollView || !this.scrollView.content) return;
        
        if (index < 0 || index >= this.tabButtons.length) {
            console.warn(`ScrollPageView: Invalid page index ${index}`);
            return;
        }
        
        if (index === this.currentPage || this.isAutoScrolling) return;
        
        this.isAutoScrolling = true;

        const widthWithBgOffset = this.pageWidth; 
        const targetOffset = new Vec3(widthWithBgOffset * index, 0, 0);
        this.scrollView.scrollToOffset(targetOffset, this.scrollTime);

        this.currentPage = index;
        this.updateTabHighlight(index);

        this.scheduleOnce(() => {
            this.isAutoScrolling = false;
        }, this.scrollTime + 0.1);
    }

    onScrolling() {
        if (!this.scrollView || this.isAutoScrolling) return;
        
        const offsetX = this.scrollView.getScrollOffset().x;
        let page = Math.round(offsetX / this.pageWidth);
        page = Math.max(0, Math.min(page, this.tabButtons.length - 1));
        
        if (page !== this.currentPage) {
            this.currentPage = page;
            this.updateTabHighlight(page);
        }
    }

    onScrollEnd() {
        if (!this.scrollView || this.isAutoScrolling || this.isSnapping) return;
        
        const offsetX = this.scrollView.getScrollOffset().x;
        let targetPage = Math.round(Math.abs(offsetX) / this.pageWidth);
        targetPage = Math.max(0, Math.min(targetPage, this.tabButtons.length - 1));
        
        const targetOffset = new Vec3(this.pageWidth * targetPage, 0, 0);
        const currentOffset = this.scrollView.getScrollOffset();
        
        if (Math.abs(targetOffset.x - currentOffset.x) < 1) {
            this.currentPage = targetPage;
            this.updateTabHighlight(targetPage);
            return;
        }
        
        this.isSnapping = true;
        this.scrollView.scrollToOffset(targetOffset, 0.2);
        
        this.scheduleOnce(() => {
            this.isSnapping = false;
            this.currentPage = targetPage;
            this.updateTabHighlight(targetPage);
        }, 0.3);
    }

    updateTabHighlight(activeIndex: number) {
        if (!this.tabButtons || this.tabButtons.length === 0) return;
        
        this.tabButtons.forEach((btn, index) => {
            if (!btn) return;
            
            const sprite = btn.getComponent(Sprite);
            if (sprite) {
                sprite.color = (index === activeIndex) 
                    ? new Color(255, 255, 255, 255) 
                    : new Color(128, 128, 128, 255);
            }
            
            const button = btn.getComponent(Button);
            if (button) {
                if (index === activeIndex && this.activeSpriteFrames[index]) {
                    button.normalSprite = this.activeSpriteFrames[index];
                } else if (this.inactiveSpriteFrames[index]) {
                    button.normalSprite = this.inactiveSpriteFrames[index];
                }
            }
        });
    }

    onDestroy() {
        this.scrollView.node.off('scrolling', this.onScrolling, this);
        this.scrollView.node.off('scroll-ended', this.onScrollEnd, this);
    }
}