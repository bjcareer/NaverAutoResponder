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
        const apiKey = configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY environment variable is required');
        }

        const modelName = configService.get<string>('OPENAI_MODEL_NAME') || 'gpt-5-mini';
        const temperatureStr = configService.get<string>('OPENAI_TEMPERATURE') || '0.7';
        const temperature = parseFloat(temperatureStr);

        if (isNaN(temperature)) {
          throw new Error('OPENAI_TEMPERATURE must be a valid number');
        }

        return new ChatOpenAI({
          apiKey,
          model: modelName,
          temperature,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AutoAnswerService],
})
export class LlmModule {}
