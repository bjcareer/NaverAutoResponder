import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { ChromModule } from './chrom/chrom.module';
import { NaverModule } from './naver/naver.module';
import { LlmModule } from './llm/llm.module';
import { QuestionProcessorModule } from './question-processor/question-processor.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SharedModule,
    ChromModule,
    NaverModule,
    LlmModule,
    QuestionProcessorModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
