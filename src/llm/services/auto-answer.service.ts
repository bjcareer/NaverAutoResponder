import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Question } from '@naver/domain/Question';
import { LoggerService } from '@shared/services/logger.service';

@Injectable()
export class AutoAnswerService {
  constructor(
    @Inject('CHAT_MODEL') private readonly chatModel: ChatOpenAI,
    private readonly logger: LoggerService
  ) {}

  async createAutoAnswer(question: Question): Promise<void> {
    this.logger.info('AutoAnswerService', 'Generating answer', {
      questionTitle: question.title,
    });

    const answer = await this.invokeChatModel(question.detailQuestion);
    question.addAnswer(answer);

    this.logger.info('AutoAnswerService', 'Answer generated successfully', {
      answerLength: answer.length,
    });
  }

  private async invokeChatModel(questionText: string): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        '당신은 네이버 지식iN의 전문 답변자입니다. 정확하고 유용한 정보를 제공하며, 친절하고 전문적인 어조로 답변합니다.',
      ],
      ['human', '{question}'],
    ]);

    const outputParser = new StringOutputParser();
    const chain = prompt.pipe(this.chatModel).pipe(outputParser);

    const result = await chain.invoke({ question: questionText });
    return result;
  }
}
