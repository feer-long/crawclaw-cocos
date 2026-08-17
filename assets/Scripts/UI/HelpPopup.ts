import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HelpPopup')
export class HelpPopup extends Component {

    /**
     * 关闭按钮点击事件
     */
    public onCloseButtonClicked() {
        // 如果你的帮助页每次打开都是通过代码动态 instantiate 生成的，使用 destroy() 销毁节点以释放内存
        this.node.destroy();

        // 【补充说明】：
        // 如果你的帮助页是提前摆在场景里，通过设置 active 属性来显示隐藏的，
        // 请把上面那句删掉，换成下面这句：
        // this.node.active = false;
    }
}