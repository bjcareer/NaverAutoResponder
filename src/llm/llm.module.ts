import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutoAnswerService } from './services/auto-answer.service';
import { ChatOpenAI } from '@langchain/openai';

@Module({
  providers: [
    AutoAnswerService,
    {
      provide: 'CHAT_MODEL',
      useFactory: (configService: ConfigService) => {
        return new ChatOpenAI({
          apiKey: configService.get<string>('OPENAI_API_KEY'),
          model: 'gpt-4o-mini',
          temperature: 0.7,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AutoAnswerService],
})
export class LlmModule {}
