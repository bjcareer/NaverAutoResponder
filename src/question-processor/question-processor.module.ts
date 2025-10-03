import { Module } from '@nestjs/common';
import { QuestionProcessorController } from './controllers/question-processor.controller';
import { QuestionProcessorService } from './services/question-processor.service';
import { NaverModule } from '../naver/naver.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [NaverModule, LlmModule],
  controllers: [QuestionProcessorController],
  providers: [QuestionProcessorService],
  exports: [QuestionProcessorService],
})
export class QuestionProcessorModule {}
