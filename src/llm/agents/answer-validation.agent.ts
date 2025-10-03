import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

/**
 * AnswerValidationAgent
 *
 * Purpose: Remove automated/robotic tone from answers and make them natural
 *
 * Validation Checks:
 * - Detects template-like patterns (페르소나, 구조화된 번호 매기기)
 * - Removes marketing jargon and excessive emojis
 * - Naturalizes forced FOMO expressions
 * - Ensures conversational, human-like tone
 * - Maintains information while improving authenticity
 */
@Injectable()
export class AnswerValidationAgent {

  constructor(@Inject('CHAT_MODEL') private readonly chatModel: ChatOpenAI) {}

  async validateAndRefine(answer: string): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.getSystemPrompt()],
      ['human', this.getHumanPrompt()],
    ]);

    const chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());

    const refined = await chain.invoke({ answer });
    return refined.trim();
  }

  private getSystemPrompt(): string {
    return `당신은 자동화된 답변을 자연스러운 사람 답변으로 바꾸는 검증 에이전트입니다.

[핵심 미션]
- 출력을 1000자 이내로 축약함
- 템플릿 느낌 제거: (1), (2), (3) 번호 매기기 → 자연스러운 문단 전환
- 마케팅 냄새 제거: 과도한 이모지, 페르소나 노출 → 일상 대화체
- 내용과 관련없는 괄호문 제거 ex) (CTA, FOMO 스럽게)
- 정보는 항상 애드핏 장점이 더 좋다는 식으로 자연스럽게 유도

[검증 기준]
❌ 제거 대상:
- "(1) 공감+정보 요약" 같은 구조 노출
- "📊", "✅", "💡", "👉" 과도한 이모지 (최대 1-2개만 허용)
- "저는 본업 병행형으로는" → "저는 그냥"
- "초반에 세팅해두면 이후가 편해요" (너무 명시적 FOMO)
- 마케팅 용어: "유도 마케터", "온보딩", "프리셋", "미니 카피"

✅ 유지/개선:
- 핵심 정보: 적금 vs 주식 비교, 리스크, 수익률 등
- 개인 경험: "저도", "제가", "~더라고요"
- 제휴 링크: 위치와 문구 유지
- 광고 고지문: 정확히 그대로 유지

[출력 형식]
- 자연스러운 문단 구조 (번호 없이)
- 이모지 최대 1-2개만 사용
- 일상 대화체 유지
- 정보 누락 없이 표현만 개선

원본 답변의 핵심 정보와 링크는 절대 삭제하지 말고, 표현만 자연스럽게 바꾸세요.`;
  }

  private getHumanPrompt(): string {
    return `다음 답변을 자연스럽게 다듬어주세요:

{answer}

---

위 답변에서:
1. 번호 매기기 (1), (2), (3) 제거하고 자연스러운 문단으로
2. 이모지 과다 사용 줄이기 (최대 1-2개)
3. 템플릿 느낌 표현 제거
4. 정보와 링크는 유지하되 표현만 자연스럽게

개선된 답변:`;
  }
}
