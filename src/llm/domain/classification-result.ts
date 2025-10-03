export enum QuestionCategory {
  SAVINGS = 'SAVINGS', // 적금 관련
  SIDE_BUSINESS = 'SIDE_BUSINESS', // 부업 관련
  INVESTMENT = 'INVESTMENT', // 재테크 관련
  PART_TIME_JOB = 'PART_TIME_JOB', // 알바 추천 관련
  GENERAL = 'GENERAL', // 일반 질문
}

export interface ClassificationResult {
  isTarget: boolean; // true: 제휴 링크 삽입 대상
  category: QuestionCategory; // 질문 카테고리
  confidence: number; // 분류 신뢰도 (0.0 ~ 1.0)
  reasoning?: string; // 분류 근거 (디버깅용)
}
