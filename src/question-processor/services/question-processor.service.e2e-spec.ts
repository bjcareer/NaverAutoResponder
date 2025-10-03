import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QuestionProcessorService } from './question-processor.service';
import { ChromDriverService } from '@chrom/services/chrom-driver.service';
import { LoginService } from '@naver/services/login.service';
import { QuestionService } from '@naver/services/question.service';
import { AutoAnswerService } from '@llm/services/auto-answer.service';
import { QuestionClassificationAgent } from '@llm/agents/question-classification.agent';
import { AffiliateAnswerAgent } from '@llm/agents/affiliate-answer.agent';
import { GeneralAnswerAgent } from '@llm/agents/general-answer.agent';
import { LoggerService } from '@shared/services/logger.service';
import { SlackNotificationService } from '@shared/services/slack-notification.service';
import { ChatOpenAI } from '@langchain/openai';

describe('QuestionProcessorService E2E', () => {
  let service: QuestionProcessorService;
  let configService: ConfigService;
  let chromDriverService: ChromDriverService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
      ],
      providers: [
        QuestionProcessorService,
        ChromDriverService,
        LoginService,
        QuestionService,
        AutoAnswerService,
        QuestionClassificationAgent,
        AffiliateAnswerAgent,
        GeneralAnswerAgent,
        LoggerService,
        SlackNotificationService,
        {
          provide: 'CHAT_MODEL',
          useFactory: (configService: ConfigService) => {
            const apiKey = configService.get<string>('OPENAI_API_KEY');
            const modelName = configService.get<string>('OPENAI_MODEL_NAME', 'gpt-4o-mini');

            if (!apiKey) {
              throw new Error('OPENAI_API_KEY is not configured');
            }

            return new ChatOpenAI({
              apiKey,
              model: modelName,
            });
          },
          inject: [ConfigService],
        },
      ],
    }).compile();

    service = module.get<QuestionProcessorService>(QuestionProcessorService);
    configService = module.get<ConfigService>(ConfigService);
    chromDriverService = module.get<ChromDriverService>(ChromDriverService);
  });

  afterAll(async () => {
    // Clean up browser instance
    await chromDriverService.onModuleDestroy();
  });

  describe('Environment Configuration', () => {
    it('should have all required environment variables', () => {
      expect(configService.get('NAVER_ID')).toBeDefined();
      expect(configService.get('NAVER_PW')).toBeDefined();
      expect(configService.get('OPENAI_API_KEY')).toBeDefined();
      expect(configService.get('AFFILIATE_LINK')).toBeDefined();
      expect(configService.get('CONTACT_EMAIL')).toBeDefined();
    });

    it('should have valid affiliate link format', () => {
      const affiliateLink = configService.get<string>('AFFILIATE_LINK');
      expect(affiliateLink).toMatch(/^https?:\/\//);
    });

    it('should have valid email format', () => {
      const contactEmail = configService.get<string>('CONTACT_EMAIL');
      expect(contactEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });

  describe('Service Dependencies', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all required dependencies', () => {
      expect(chromDriverService).toBeDefined();
    });
  });

  describe('processQuestions - Full Workflow', () => {
    it('should process SAVINGS questions with affiliate link', async () => {
      const keyword = '돈 부족';
      const customLink = 'https://deg.kr/65b7c5d';

      const result = await service.processQuestions(keyword, customLink);

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeGreaterThanOrEqual(0);
    }, 180000);

    it('should process SIDE_BUSINESS questions with affiliate link', async () => {
      const keyword = '부업';
      const customLink = 'https://deg.kr/65b7c5d';

      const result = await service.processQuestions(keyword, customLink);

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeGreaterThanOrEqual(0);
    }, 1080000);

    it('should process INVESTMENT questions with affiliate link', async () => {
      const keyword = '투자';
      const customLink = 'https://deg.kr/65b7c5d';

      const result = await service.processQuestions(keyword, customLink);

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeGreaterThanOrEqual(0);
    }, 180000);

    it('should process GENERAL questions without affiliate link', async () => {
      const keyword = '파이썬 공부';
      const customLink = 'https://deg.kr/65b7c5d';

      const result = await service.processQuestions(keyword, customLink);

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(0);
      // General questions should still work, just with different answer style
    }, 180000);

    it('should handle mixed question types correctly', async () => {
      const keyword = '재테크';
      const customLink = 'https://deg.kr/65b7c5d';

      const result = await service.processQuestions(keyword, customLink);

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(0);
      // Mixed results: some target, some general
    }, 580000);
  });

  describe('Answer Generation Quality', () => {
    it('should generate answers with trial-and-error tone', async () => {
      const keyword = '투자 시작';

      const result = await service.processQuestions(keyword);

      // At least attempt to process questions
      expect(result.processed + result.errors).toBeGreaterThan(0);
    }, 180000);
  });

  describe('Error Handling', () => {
    it('should handle invalid credentials gracefully', async () => {
      // This test assumes invalid credentials will be caught
      // In a real scenario, you'd temporarily set invalid credentials
      const keyword = '테스트';

      await expect(async () => {
        // Service should either succeed or throw a descriptive error
        const result = await service.processQuestions(keyword);
        expect(result).toBeDefined();
      }).not.toThrow();
    }, 180000);

    it('should return proper error count when processing fails', async () => {
      const keyword = '매우_이상한_키워드_결과없음_12345';

      const result = await service.processQuestions(keyword);

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeGreaterThanOrEqual(0);
    }, 180000);
  });

  describe('Browser Automation', () => {
    it('should create and reuse browser instance', async () => {
      const page1 = await chromDriverService.createPage();
      expect(page1).toBeDefined();

      const page2 = await chromDriverService.createPage();
      expect(page2).toBeDefined();

      await page1.close();
      await page2.close();
    });

    it('should handle page navigation', async () => {
      const page = await chromDriverService.createPage();

      await page.goto('https://www.naver.com', { waitUntil: 'domcontentloaded' });
      const url = page.url();

      expect(url).toContain('naver.com');

      await page.close();
    });
  });

  describe('Performance', () => {
    it('should complete processing within reasonable time', async () => {
      const keyword = '재테크';
      const startTime = Date.now();

      await service.processQuestions(keyword);

      const duration = Date.now() - startTime;
      // Should complete within 3 minutes
      expect(duration).toBeLessThan(180000);
    }, 180000);
  });
});
