import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutoAnswerService } from './services/auto-answer.service';
import { QuestionClassificationAgent } from './agents/question-classification.agent';
import { AffiliateAnswerAgent } from './agents/affiliate-answer.agent';
import { GeneralAnswerAgent } from './agents/general-answer.agent';
import { ChatOpenAI } from '@langchain/openai';

@Module({
  providers: [
    {
      provide: 'CHAT_MODEL',
      useFactory: (configService: ConfigService) => {
        const apiKey = configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY environment variable is required');
        }

        const modelName = configService.get<string>('OPENAI_MODEL_NAME') || 'gpt-4o-mini';

        return new ChatOpenAI({
          apiKey,
          model: modelName,
          // temperature는 모델 기본값 사용 (gpt-4o-mini의 경우 1.0)
        });
      },
      inject: [ConfigService],
    },
    QuestionClassificationAgent,
    AffiliateAnswerAgent,
    GeneralAnswerAgent,
    AutoAnswerService,
  ],
  exports: [AutoAnswerService],
})
export class LlmModule {}
