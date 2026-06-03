/**
 * 游戏通用常量与工具函数
 */

export const GRADE_NAMES: Record<string, string> = {
    'normal': '幼型灵螯',
    'grade3': '磐石玄甲螯',
    'grade2': '昆仑冰晶螯',
    'grade1': '祝融赤焰螯',
    'royal': '山海龙螯'
};

export const GRADE_NAMES_WITH_SCORE: Record<string, string> = {
    'normal': '幼型灵螯',
    'grade3': '磐石玄甲螯',
    'grade2': '昆仑冰晶螯',
    'grade1': '祝融赤焰螯',
    'royal': '山海龙螯'
};

export const GRADE_ORDER = ['normal', 'grade3', 'grade2', 'grade1', 'royal'];

export const GRADE_VALUES: Record<string, number> = {
    'normal': 0,
    'grade3': 1,
    'grade2': 2,
    'grade1': 3,
    'royal': 4
};

/**
 * 获取品级对应的数值
 */
export function getGradeValue(grade: string): number {
    return GRADE_VALUES[grade] || 0;
}

/**
 * 计算预估得分（对齐终局结算逻辑 - 简化版，直接数值乘积）
 */
export function calculateEstimatedScore(player: any, gameState: any): any {
    if (!player || !gameState) return { total: 0 };

    const de = player.de || 0;
    const wang = player.wang || 0;
    const coreScore = de * wang;

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
        if (l.grade === 'royal') {
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
        bonusPoints: bonusPoints,
        total: total
    };
}
