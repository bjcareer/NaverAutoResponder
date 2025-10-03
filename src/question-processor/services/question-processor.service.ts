import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromDriverService } from '@chrom/services/chrom-driver.service';
import { LoginService } from '@naver/services/login.service';
import { QuestionService } from '@naver/services/question.service';
import { AutoAnswerService } from '@llm/services/auto-answer.service';
import { LoggerService } from '@shared/services/logger.service';
import { SlackNotificationService } from '@shared/services/slack-notification.service';
import { LoginDto } from '@naver/dto/login.dto';
import { QuestionSearchDto } from '@naver/dto/question.dto';

@Injectable()
export class QuestionProcessorService {
  constructor(
    private readonly configService: ConfigService,
    private readonly chromDriver: ChromDriverService,
    private readonly loginService: LoginService,
    private readonly questionService: QuestionService,
    private readonly autoAnswerService: AutoAnswerService,
    private readonly logger: LoggerService,
    private readonly slackNotification: SlackNotificationService,
  ) {}

  async processQuestions(
    keyword: string,
    promotionLink?: string
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      const page = await this.chromDriver.createPage();

      const loginDto: LoginDto = {
        username: this.configService.get<string>('NAVER_ID')!,
        password: this.configService.get<string>('NAVER_PW')!,
      };
      await this.loginService.login(loginDto, page);

      const searchDto: QuestionSearchDto = { query: keyword };
      const questions = await this.questionService.getQuestions(searchDto, page);

      this.logger.info('QuestionProcessorService', `Found ${questions.length} questions`);

      for (const question of questions) {
        try {
          await this.questionService.getQuestionDetail(page, question);

          const affiliateLink = promotionLink || this.configService.get<string>('AFFILIATE_LINK') || 'https://adpick.co.kr/track/xxxxxx';
          const classification = await this.autoAnswerService.createAutoAnswer(question, affiliateLink);

          // Skip GENERAL category questions
          if (!classification.isTarget) {
            this.logger.info('QuestionProcessorService', `Skipping GENERAL question: ${question.title}`);
            continue;
          }

          await this.questionService.postAnswer(
            page,
            question,
            affiliateLink
          );

          processed++;
          this.logger.info('QuestionProcessorService', `Processed question: ${question.title}`);

          // Send Slack notification
          await this.slackNotification.notifyAnswerPosted(question);

          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (error) {
          errors++;
          this.logger.error(
            'QuestionProcessorService',
            `Failed to process question: ${question.title}`,
            error instanceof Error ? error.stack : String(error)
          );
        }
      }

      return { processed, errors };
    } catch (error) {
      this.logger.error(
        'QuestionProcessorService',
        'Fatal error in processQuestions',
        error instanceof Error ? error.stack : String(error)
      );
      throw error;
    }
  }
}
