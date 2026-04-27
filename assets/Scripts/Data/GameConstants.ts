/**
 * 游戏通用常量与工具函数
 */

export const GRADE_NAMES: Record<string, string> = {
    'normal': '普虾',
    'grade3': '三品',
    'grade2': '二品',
    'grade1': '一品',
    'royal': '👑虾王'
};

export const GRADE_NAMES_WITH_SCORE: Record<string, string> = {
    'normal': '普虾(0分)',
    'grade3': '三品(1分)',
    'grade2': '二品(2分)',
    'grade1': '一品(3分)',
    'royal': '👑虾王(4分)'
};

export const GRADE_ORDER = ['normal', 'grade3', 'grade2', 'grade1', 'royal'];

export const GRADE_VALUES: Record<string, number> = {
    'normal': 0,
    'grade3': 1,
    'grade2': 2,
    'grade1': 3,
    'royal': 4
};

// 对应的映射分数，下标 0-15 对应这 16 个值
export const VALUE_MAP = [1, 2, 3, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 10];

/**
 * 获取品级对应的数值
 */
export function getGradeValue(grade: string): number {
    return GRADE_VALUES[grade] || 0;
}
/**
 * 计算预估得分（对齐终局结算逻辑）
 */
export function calculateEstimatedScore(player: any, gameState: any): any {
    if (!player || !gameState) return { total: 0 };

    const getBonus = (idx: number) => {
        if (idx >= 14) return 5;
        if (idx >= 13) return 4;
        if (idx >= 11) return 3;
        if (idx >= 9) return 2;
        if (idx >= 7) return 1;
        return 0;
    };

    const deIdx = Math.min(Math.max(player.de || 0, 0), 15);
    const wangIdx = Math.min(Math.max(player.wang || 0, 0), 15);

    const deValue = VALUE_MAP[deIdx];
    const wangValue = VALUE_MAP[wangIdx];
    const deBonus = getBonus(deIdx);
    const wangBonus = getBonus(wangIdx);

    const coreScore = (deValue * wangValue) + deBonus + wangBonus;

    // 2. 上供席位分
    const tavernScores: number[] = [];
    let tavernTotal = 0;
    const tavernCompletionOrder = gameState.tavernCompletionOrder || {};
    const scoreMap = [3, 2, 1, 0];

    for (const key in tavernCompletionOrder) {
        const list = tavernCompletionOrder[key];
        if (Array.isArray(list)) {
            const rank = list.findIndex((pid: any) => Number(pid) === Number(player.id));
            if (rank !== -1) {
                const score = scoreMap[rank] || 0;
                tavernScores.push(score);
                tavernTotal += score;
            }
        }
    }

    // 3. 资源转换分
    const coinsScore = Math.floor((player.coins || 0) / 2);
    const seaweedScore = Math.floor((player.seaweed || 0) / 3);
    const cagesScore = (player.cages || 0) * 2;

    let lobstersScore = 0;
    (player.lobsters || []).forEach((l: any) => {
        const isRoyalTitle = (l.grade === 'royal' && (l.title || l.name)) || l.name === '红头紫' || l.name === '长鳌虾';
        if (isRoyalTitle || l.grade === 'royal') {
            lobstersScore += 8;
        } else if (l.grade === 'grade1') {
            lobstersScore += 5;
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
    const bonusPoints = player.bonusPoints || 0;

    const total = coreScore + tavernTotal + resScore + bonusPoints;

    return {
        deVal: deIdx,
        wangVal: wangIdx,
        deValue: deValue,
        wangValue: wangValue,
        deBonus: deBonus,
        wangBonus: wangBonus,
        core: coreScore,
        tavernList: tavernScores,
        tavern: tavernTotal,
        coinsScore: coinsScore,
        seaweedScore: seaweedScore,
        cagesScore: cagesScore,
        lobstersScore: lobstersScore,
        res: resScore,
        bonusPoints: bonusPoints,
        total: total
    };
}
