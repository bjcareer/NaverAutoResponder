import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Question } from '@naver/domain/Question';
import { LoggerService } from '@shared/services/logger.service';
import { QuestionClassificationAgent } from '../agents/question-classification.agent';
import { AffiliateAnswerAgent } from '../agents/affiliate-answer.agent';
import { GeneralAnswerAgent } from '../agents/general-answer.agent';
import { ClassificationResult } from '../domain/classification-result';

@Injectable()
export class AutoAnswerService {
  constructor(
    private readonly classificationAgent: QuestionClassificationAgent,
    private readonly affiliateAnswerAgent: AffiliateAnswerAgent,
    private readonly generalAnswerAgent: GeneralAnswerAgent,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async createAutoAnswer(
    question: Question,
    affiliateLink?: string,
  ): Promise<ClassificationResult> {
    this.logger.info('AutoAnswerService', 'Starting answer generation', {
      questionTitle: question.title,
    });

    // Step 1: Classify question
    const classification = await this.classifyQuestion(
      question.detailQuestion,
    );

    // Step 2: Generate answer based on classification
    const answer = await this.generateAnswer(
      question.detailQuestion,
      classification,
      affiliateLink,
    );

    // Step 3: Add answer to question entity
    question.addAnswer(answer);

    this.logger.info('AutoAnswerService', 'Answer generated successfully', {
      isTarget: classification.isTarget,
      category: classification.category,
      confidence: classification.confidence,
      answer: answer,
    });

    return classification;
  }

  private async classifyQuestion(
    questionText: string,
  ): Promise<ClassificationResult> {
    this.logger.info('AutoAnswerService', 'Classifying question');

    const result = await this.classificationAgent.classify(questionText);

    this.logger.info('AutoAnswerService', 'Classification result', {
      isTarget: result.isTarget,
      category: result.category,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });

    return result;
  }

  private async generateAnswer(
    questionText: string,
    classification: ClassificationResult,
    affiliateLink?: string,
  ): Promise<string> {
    if (classification.isTarget) {
      // Use affiliate answer agent
      const link =
        affiliateLink || this.configService.get<string>('AFFILIATE_LINK') || '';

      this.logger.info('AutoAnswerService', 'Generating affiliate answer', {
        category: classification.category,
      });

      return await this.affiliateAnswerAgent.generate(
        questionText,
        link,
        classification.category,
      );
    } else {
      // Use general answer agent
      this.logger.info('AutoAnswerService', 'Generating general answer');

      return await this.generalAnswerAgent.generate(questionText);
    }
  }

  /**
   * For monitoring and debugging: Get classification without generating answer
   */
  async classifyOnly(questionText: string): Promise<ClassificationResult> {
    return await this.classificationAgent.classify(questionText);
  }
}
