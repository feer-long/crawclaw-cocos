import { _decorator, Component, ProgressBar, Animation, Node, director, assetManager, profiler, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LoadingSceneController')
export class LoadingSceneController extends Component {

    @property({ type: ProgressBar, tooltip: '进度条组件' })
    public progressBar: ProgressBar | null = null;

    @property({ tooltip: '★手动指定游标爬行的总距离（像素宽度，填你肉眼看到的进度条宽度，比如600）' })
    public crawlDistance: number = 600;

    @property({ type: Node, tooltip: '背后缓缓旋转的光轮节点' })
    public ringNode: Node | null = null;

    @property({ type: Node, tooltip: '游标(爬行小灵螯)节点' })
    public clawWalkerNode: Node | null = null;

    @property({ type: Animation, tooltip: '游标上的爬行动画组件' })
    public walkLoopAnim: Animation | null = null;

    @property({ type: Animation, tooltip: '中间打坐灵螯的睁眼动画组件' })
    public clawOpenAnim: Animation | null = null;

    @property({ tooltip: '加载完毕后要跳转的场景名字(默认备用)' })
    public targetSceneName: string = 'Lobby';

    private actualProgress: number = 0; // 真实的底层加载进度
    private displayProgress: number = 0; // UI显示的平滑进度
    private hasReached100: boolean = false;

    onLoad() {
        // ★ 从本地缓存读取目的地路牌（Login进就是Lobby，Room进就是Game）
        const dynamicTarget = sys.localStorage.getItem("TargetSceneName");
        if (dynamicTarget) {
            this.targetSceneName = dynamicTarget;
            sys.localStorage.removeItem("TargetSceneName");
            console.log(`[智能加载页] 本次目的地设定为: ${this.targetSceneName}`);
        }

        if (this.progressBar) {
            this.progressBar.progress = 0;
        }
    }

    start() {
        profiler.hideStats();
        const bundle = assetManager.getBundle('remote_assets');
        if (bundle) {
            // ★ 开始在后台静默拉取目标场景（Lobby 或 Game）的所有资源
            bundle.preloadScene(this.targetSceneName,
                (finished, total) => {
                    if (total > 0) {
                        this.actualProgress = finished / total;
                    }
                },
                (err) => {
                    if (!err) {
                        this.actualProgress = 1;
                    } else {
                        console.error(`预加载 ${this.targetSceneName} 失败:`, err);
                        this.actualProgress = 1;
                    }
                }
            );
        } else {
            console.warn('未找到 remote_assets bundle，退回模拟加载模式');
            this.actualProgress = 1;
        }
    }

    update(dt: number) {
        if (this.ringNode) {
            let angle = this.ringNode.angle;
            angle -= 15 * dt;
            this.ringNode.angle = angle;
        }

        if (this.hasReached100) return;

        if (this.displayProgress < this.actualProgress) {
            this.displayProgress += dt * 0.5;
            if (this.displayProgress > this.actualProgress) {
                this.displayProgress = this.actualProgress;
            }
        }

        if (this.progressBar) {
            this.progressBar.progress = this.displayProgress;
        }
        this.syncClawWalkerPosition();

        if (this.displayProgress >= 1 && !this.hasReached100) {
            this.displayProgress = 1;
            this.handle100PercentLogic();
        }
    }

    private syncClawWalkerPosition() {
        if (!this.progressBar || !this.clawWalkerNode) return;

        const progressPercent = this.progressBar.progress;
        const startX = -this.crawlDistance / 2;
        const finalX = startX + (progressPercent * this.crawlDistance);

        // 更新坐标
        this.clawWalkerNode.setPosition(finalX, this.clawWalkerNode.position.y);
    }

    private handle100PercentLogic() {
        this.hasReached100 = true;
        console.log('加载达到 100%，立刻开始播放睁眼动画...');

        // 【修改点1】：不再等待，进度条拉满后，立刻调用播放睁眼动画的函数
        this.playClawOpenAnimation();
    }

    private playClawOpenAnimation() {
        if (this.clawOpenAnim) {
            this.clawOpenAnim.play('claw_open');
            // 睁眼动画播完，去等待 1.5 秒
            this.clawOpenAnim.once('finished', this.onAnimationFinished, this);
        } else {
            console.warn('没有配置睁眼动画，直接准备跳转');
            this.onAnimationFinished();
        }
    }

    private onAnimationFinished() {
        console.log('睁眼动画播放完毕，等待 1.5 秒后跳转场景...');

        // 【修改点3】：把 1.5 秒的等待转移到这里，等待结束后执行真正的场景跳转
        this.scheduleOnce(() => {
            this.onLoadComplete();
        }, 1.5);
    }

    private onLoadComplete() {
        console.log(`资源拉取完毕，准备进入 ${this.targetSceneName} 场景...`);
        const bundle = assetManager.getBundle('remote_assets');
        if (bundle) {
            // 因为前面已经 preload 过了，这一步瞬间就能切进去，完美无卡顿
            bundle.loadScene(this.targetSceneName, (err, sceneAsset) => {
                if (err) {
                    console.error('切换目标场景失败:', err);
                    return;
                }
                director.runScene(sceneAsset);
            });
        }
    }
}