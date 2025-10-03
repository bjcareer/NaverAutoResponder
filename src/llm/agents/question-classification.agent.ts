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

    // 3. Create prompt template
    const prompt = new PromptTemplate({
      template: `당신은 질문 분류 전문가입니다. 주어진 질문을 분석하여 다음 기준으로 분류하세요.

【분류 기준】
isTarget = true 조건:
- 적금, 예금, 저축 상품 추천 요청
- 부업, 사이드잡, 투잡 추천 요청
- 재테크, 투자 방법 고민 및 추천 요청
- 금융 상품 비교 및 선택 고민
- 돈 벌기, 수익 창출 방법 문의

isTarget = false 조건:
- 위 키워드가 포함되어도 실제 추천 요청이 아닌 경우
  예) "적금 이자 계산 방법", "재테크 공부 책 추천", "부업으로 번 돈 세금 신고 방법"
- 완전히 다른 주제의 질문

【카테고리 정의】
- SAVINGS: 적금/예금/저축 관련
- SIDE_BUSINESS: 부업/투잡/사이드잡 관련
- INVESTMENT: 재테크/투자 관련
- GENERAL: 위 카테고리에 해당하지 않음

【질문】
{question}

{format_instructions}

분석을 수행하고 JSON 형식으로 응답하세요.`,
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
