import { Module, Global } from '@nestjs/common';
import { LoggerService } from './services/logger.service';
import { SlackNotificationService } from './services/slack-notification.service';

@Global()
@Module({
  providers: [LoggerService, SlackNotificationService],
  exports: [LoggerService, SlackNotificationService],
})
export class SharedModule {}
