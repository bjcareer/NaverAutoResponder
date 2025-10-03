import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncomingWebhook } from '@slack/webhook';
import { LoggerService } from './logger.service';
import { Question } from '@naver/domain/Question';

@Injectable()
export class SlackNotificationService {
  private webhook: IncomingWebhook | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    const webhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
    if (webhookUrl && webhookUrl !== 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL') {
      this.webhook = new IncomingWebhook(webhookUrl);
      this.logger.info('SlackNotificationService', 'Slack webhook initialized');
    } else {
      this.logger.warn('SlackNotificationService', 'Slack webhook URL not configured - notifications disabled');
    }
  }

  async notifyAnswerPosted(question: Question): Promise<void> {
    if (!this.webhook) {
      this.logger.debug('SlackNotificationService', 'Slack notifications disabled - skipping');
      return;
    }

    try {
      const answer = question.answer || '답변 내용 없음';

      await this.webhook.send({
        text: '✅ 네이버 지식iN 답변 등록 완료',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '✅ 네이버 지식iN 답변 등록',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*질문 제목:*\n${question.title}`,
              },
              {
                type: 'mrkdwn',
                text: `*답변 개수:*\n${question.answerCount}개`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*질문 내용:*\n${this.truncate(question.detailQuestion, 200)}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*답변 내용:*\n${this.truncate(answer, 300)}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*질문 링크:*\n<${question.link}|바로가기>`,
            },
          },
          {
            type: 'divider',
          },
        ],
      });

      this.logger.info('SlackNotificationService', 'Slack notification sent successfully', {
        questionTitle: question.title,
      });
    } catch (error) {
      this.logger.error(
        'SlackNotificationService',
        'Failed to send Slack notification',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
}
