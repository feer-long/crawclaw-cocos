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

/**
 * 获取品级对应的数值
 */
export function getGradeValue(grade: string): number {
    return GRADE_VALUES[grade] || 0;
}
