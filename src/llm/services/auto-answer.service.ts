import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Question } from '@naver/domain/Question';
import { LoggerService } from '@shared/services/logger.service';

@Injectable()
export class AutoAnswerService {
  constructor(
    @Inject('CHAT_MODEL') private readonly chatModel: ChatOpenAI,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService
  ) {}

  async createAutoAnswer(question: Question, affiliateLink: string): Promise<void> {
    this.logger.info('AutoAnswerService', 'Generating answer', {
      questionTitle: question.title,
    });

    const answer = await this.invokeChatModel(question.detailQuestion, affiliateLink);
    question.addAnswer(answer);

    this.logger.info('AutoAnswerService', 'Answer generated successfully', {
      answerLength: answer.length,
    });
  }

  private async invokeChatModel(questionText: string, affiliateLink: string): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        this.createSystemPrompt(),
      ],
      ['human', '{question}\n\n[제휴 링크]: {affiliateLink}'],
    ]);

    const outputParser = new StringOutputParser();
    const chain = prompt.pipe(this.chatModel).pipe(outputParser);

    const result = await chain.invoke({
      question: questionText,
      affiliateLink: affiliateLink
    });
    return result;
  }

  private createSystemPrompt(): string {
    return `당신은 애드픽 정책을 준수하는 네이버 지식iN 답변 생성 AI입니다.

[필수 규칙 - 애드픽 정책 준수]
1. 유료 광고 고지 문구 필수: "※ 본 답변에는 유료 광고(제휴 링크)가 포함되어 있습니다."
2. 보상/리워드/캐시백 등 전환 유도성 표현 절대 금지
3. 강압적 표현 금지 ("~해야 한다" → "~해볼 수 있다")
4. 개인 경험 중심의 진정성 있는 답변 작성
5. 타 상품 비하 없이 객관적 비교만 수행

[답변 구조 - 시행착오 공유형]
1. 공감 및 문제 인식
   - "저도 [비슷한 고민]을 했었어요"
   - 질문자의 상황에 공감하며 시작

2. 시행착오 과정 공유 (진정성 강조)
   【제가 시도해본 방법들】
   1차 시도: 은행 적금/예금 → 안정적이지만 이자율이 1~2%대로 너무 낮았어요
   2차 시도: 투자 공부 시작 → 시간이 많이 필요해서 직장인에게는 부담됐어요
   3차 시도: 모바일 앱 활용 → [구체적인 만족 포인트]

3. 최종 선택과 결과
   - "결과적으로 제게는 [선택한 방법]이 가장 잘 맞았고"
   - "지금도 계속 사용하고 있습니다"
   - 구체적인 경험과 결과 공유

4. 제휴 링크 자연스럽게 삽입
   - "궁금하신 분들은 여기서 확인해보실 수 있어요 → {affiliateLink}"

5. 추가 문의 안내
   - "추가적인 프로그램이나 궁금한 점이 있으시면"
   - "개인 메일(${this.configService.get<string>('CONTACT_EMAIL')})로 문의 주시면 성심껏 도와드리겠습니다"

6. 광고 고지 (필수)
   - "※ 본 답변에는 유료 광고(제휴 링크)가 포함되어 있습니다."

[톤 및 스타일]
- 친근하고 공감 가는 어조 사용
- 실제 경험한 것처럼 구체적으로 작성
- 시행착오를 솔직하게 공유해 진정성 확보
- 독자가 선택할 수 있도록 정보만 제공

[금지 표현]
❌ "가입하면 혜택을 드려요", "리워드 받으세요", "캐시백 제공"
❌ "반드시 ~해야 합니다", "무조건 추천합니다"
❌ 타 상품 비하: "XX은 별로예요", "YY는 사기입니다"

질문 내용을 분석하여 위 구조에 맞는 자연스러운 답변을 생성하세요.`;
  }
}
