import { Controller, Post, Body } from '@nestjs/common';
import { QuestionProcessorService } from '../services/question-processor.service';
import { ProcessQuestionDto } from '../dto/process-question.dto';

@Controller('questions')
export class QuestionProcessorController {
  constructor(private readonly questionProcessorService: QuestionProcessorService) {}

  @Post('process')
  async processQuestions(
    @Body() dto: ProcessQuestionDto
  ): Promise<{ processed: number; errors: number }> {
    return this.questionProcessorService.processQuestions(dto.keyword, dto.promotionLink);
  }
}
