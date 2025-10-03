import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import {
  ClassificationResult,
  QuestionCategory,
} from '../domain/classification-result';

@Injectable()
export class QuestionClassificationAgent {
  constructor(
    @Inject('CHAT_MODEL') private readonly chatModel: ChatOpenAI,
  ) {}

  async classify(questionText: string): Promise<ClassificationResult> {
    // 1. Define output schema with Zod
    const classificationSchema = z.object({
      isTarget: z
        .boolean()
        .describe(
          '질문이 적금/부업/재테크 추천 요청이면 true, 아니면 false',
        ),
      category: z
        .nativeEnum(QuestionCategory)
        .describe('질문의 카테고리'),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe('분류 신뢰도 (0.0 ~ 1.0)'),
      reasoning: z.string().describe('분류 근거 설명'),
    });

    // 2. Create parser
    const parser = StructuredOutputParser.fromZodSchema(classificationSchema);

    // 3. Create prompt template with few-shot examples
    const prompt = new PromptTemplate({
      template: `당신은 질문 분류 전문가입니다. 주어진 질문을 분석하여 다음 기준으로 분류하세요.

【분류 기준】
isTarget = true 조건:
- 적금, 예금, 저축 상품 추천 요청
- 부업, 사이드잡, 투잡 추천 요청 (단, 금전적 수익이 목적인 경우만)
- 재테크, 투자 방법 고민 및 추천 요청
- 금융 상품 비교 및 선택 고민
- 돈 벌기, 수익 창출 방법 문의

isTarget = false 조건:
- 위 키워드가 포함되어도 실제 추천 요청이 아닌 경우
  예) "적금 이자 계산 방법", "재테크 공부 책 추천", "부업으로 번 돈 세금 신고 방법"
- 취미, 커리어 상담, 학업 고민 등 금전적 수익이 주목적이 아닌 경우
- 유튜브, 창작 활동 등이 취미나 자기개발 목적인 경우
- 완전히 다른 주제의 질문

【카테고리 정의】
- SAVINGS: 적금/예금/저축 관련
- SIDE_BUSINESS: 부업/투잡/사이드잡 관련 (금전적 수익 창출이 명확한 목적)
- INVESTMENT: 재테크/투자 관련
- GENERAL: 위 카테고리에 해당하지 않음

【Few-shot 예시】

예시 1:
질문: "월급이 적어서 투잡 알아보는데 추천 좀 해주세요"
분류: {{"isTarget": true, "category": "SIDE_BUSINESS", "confidence": 0.95, "reasoning": "투잡으로 수익 창출이 명확한 목적"}}

예시 2:
질문: "적금 이자율 높은 곳 추천해주세요"
분류: {{"isTarget": true, "category": "SAVINGS", "confidence": 0.95, "reasoning": "적금 상품 추천 요청"}}

예시 3:
질문: "주식 vs 펀드 어디에 투자하는게 나을까요?"
분류: {{"isTarget": true, "category": "INVESTMENT", "confidence": 0.9, "reasoning": "투자 방법 추천 요청"}}

예시 4:
질문: "클래식 기타 배워서 유튜브 찍으려는데 어떤가요?"
분류: {{"isTarget": false, "category": "GENERAL", "confidence": 0.85, "reasoning": "취미와 자기개발 목적, 금전적 수익이 주목적 아님"}}

예시 5:
질문: "재테크 공부하려고 하는데 책 추천 부탁드려요"
분류: {{"isTarget": false, "category": "GENERAL", "confidence": 0.8, "reasoning": "재테크 키워드는 있지만 책 추천 요청으로 상품 추천 아님"}}

예시 6:
질문: "퇴근 후 시간 활용해서 부업 하고 싶은데 뭐가 좋을까요"
분류: {{"isTarget": true, "category": "SIDE_BUSINESS", "confidence": 0.9, "reasoning": "부업으로 수익 창출 목적 명확"}}

【분류할 질문】
{question}

{format_instructions}

위 예시를 참고하여 분석을 수행하고 JSON 형식으로 응답하세요.`,
      inputVariables: ['question'],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    // 4. Create chain
    const chain = prompt.pipe(this.chatModel).pipe(parser);

    // 5. Invoke and return
    const result = await chain.invoke({ question: questionText });

    return {
      isTarget: result.isTarget,
      category: result.category,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  }
}
