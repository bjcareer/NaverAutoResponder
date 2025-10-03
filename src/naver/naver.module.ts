import { Module } from '@nestjs/common';
import { LoginService } from './services/login.service';
import { QuestionService } from './services/question.service';

@Module({
  providers: [LoginService, QuestionService],
  exports: [LoginService, QuestionService],
})
export class NaverModule {}
