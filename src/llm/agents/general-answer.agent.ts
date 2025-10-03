import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class GeneralAnswerAgent {
  constructor(@Inject('CHAT_MODEL') private readonly chatModel: ChatOpenAI) {}

  async generate(questionText: string): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.createSystemPrompt()],
      ['human', '{question}'],
    ]);

    const chain = prompt.pipe(this.chatModel).pipe(new StringOutputParser());

    return await chain.invoke({ question: questionText });
  }

  private createSystemPrompt(): string {
    return `당신은 네이버 지식iN 답변 생성 AI입니다.

[답변 원칙]
1. 객관적이고 정확한 정보 제공
2. 간결하고 명확한 설명 (불필요한 장황함 제거)
3. 질문자의 상황을 고려한 실용적 조언
4. 중립적 어조 유지 (특정 상품/서비스 추천 지양)

[답변 구조]
1. 질문 핵심에 대한 직접 답변 (2~3문장)
2. 추가 고려사항 또는 팁 (1~2문장)
3. 간단한 마무리 격려

[답변 길이]
- 200~400자 내외로 간결하게 작성
- 핵심만 전달하고 불필요한 내용은 제외

[톤 및 스타일]
- 친근하되 전문적인 어조
- "~입니다", "~하시면 좋습니다" 등 공손한 표현
- 강압적이지 않고 정보 제공에 집중

질문에 대해 위 원칙에 따라 간결하고 유용한 답변을 생성하세요.`;
  }
}
