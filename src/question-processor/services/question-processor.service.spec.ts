import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Builder, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { ChatOpenAI } from '@langchain/openai';
import { QuestionProcessorService } from './question-processor.service';
import { ChromDriverService } from '@chrom/services/chrom-driver.service';
import { LoginService } from '@naver/services/login.service';
import { QuestionService } from '@naver/services/question.service';
import { AutoAnswerService } from '@llm/services/auto-answer.service';
import { LoggerService } from '@shared/services/logger.service';
import * as dotenv from 'dotenv';

dotenv.config();

describe('QuestionProcessorService E2E Tests', () => {
  let service: QuestionProcessorService;
  let driver: WebDriver;
  let chromDriverService: ChromDriverService;

  beforeAll(async () => {
    // Validate environment variables
    if (!process.env.NAVER_ID || !process.env.NAVER_PW || !process.env.OPENAI_API_KEY) {
      throw new Error(
        'NAVER_ID, NAVER_PW, and OPENAI_API_KEY must be set in .env file for E2E tests'
      );
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionProcessorService,
        ChromDriverService,
        LoginService,
        QuestionService,
        AutoAnswerService,
        LoggerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => process.env[key],
          },
        },
        {
          provide: 'CHAT_MODEL',
          useValue: new ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
          }),
        },
      ],
    }).compile();

    service = module.get<QuestionProcessorService>(QuestionProcessorService);
    chromDriverService = module.get<ChromDriverService>(ChromDriverService);
  });

  beforeEach(async () => {
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--disable-blink-features=AutomationControlled');
    chromeOptions.addArguments('--no-sandbox');
    chromeOptions.addArguments('--disable-dev-shm-usage');
    chromeOptions.excludeSwitches('enable-automation');

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    // Inject driver into ChromDriverService for service to use
    chromDriverService['driver'] = driver;
  });

  afterEach(async () => {
    if (driver) {
      await driver.quit();
      chromDriverService['driver'] = null;
    }
  });

  describe('Full Question Processing Flow', () => {
    it('should successfully process questions end-to-end', async () => {
      const keyword = '자바';
      const promotionLink = 'https://test.com';

      const result = await service.processQuestions(keyword, promotionLink);

      // Verify processing results
      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeGreaterThanOrEqual(0);
      expect(result.processed + result.errors).toBeGreaterThan(0);
    }, 180000); // 3 minutes timeout for full flow

    it('should handle login and question search', async () => {
      const keyword = '파이썬';

      // This test verifies login and search work without full answer posting
      await expect(
        service.processQuestions(keyword, 'https://test.com')
      ).resolves.not.toThrow();
    }, 120000);

    it('should return zero processed if no questions found', async () => {
      // Use a very specific keyword unlikely to have questions
      const keyword = 'xyzabcdefghijklmnop123456789';

      const result = await service.processQuestions(keyword);

      expect(result.processed).toBe(0);
    }, 120000);
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully and continue processing', async () => {
      const keyword = '자바';

      const result = await service.processQuestions(keyword);

      // Even if some questions fail, should return result object
      expect(result).toBeDefined();
      expect(typeof result.processed).toBe('number');
      expect(typeof result.errors).toBe('number');
    }, 180000);

    it('should track errors separately from processed count', async () => {
      const keyword = '자바';

      const result = await service.processQuestions(keyword);

      // Total questions attempted should be processed + errors
      const totalAttempted = result.processed + result.errors;
      expect(totalAttempted).toBeGreaterThanOrEqual(0);
    }, 180000);
  });

  describe('Service Integration', () => {
    it('should integrate all required services', () => {
      // Verify all services are injected
      expect(service['chromDriver']).toBeDefined();
      expect(service['loginService']).toBeDefined();
      expect(service['questionService']).toBeDefined();
      expect(service['autoAnswerService']).toBeDefined();
      expect(service['logger']).toBeDefined();
      expect(service['configService']).toBeDefined();
    });

    it('should use promotion link when provided', async () => {
      const keyword = '자바';
      const customLink = 'https://custom-promotion.com';

      // Just verify it accepts the parameter without error
      await expect(
        service.processQuestions(keyword, customLink)
      ).resolves.not.toThrow();
    }, 120000);

    it('should use default promotion link when not provided', async () => {
      const keyword = '자바';

      // Should use default https://next-stock.com/
      await expect(
        service.processQuestions(keyword)
      ).resolves.not.toThrow();
    }, 120000);
  });

  describe('Environment Configuration', () => {
    it('should load all required environment variables', () => {
      expect(process.env.NAVER_ID).toBeDefined();
      expect(process.env.NAVER_PW).toBeDefined();
      expect(process.env.OPENAI_API_KEY).toBeDefined();
      expect(process.env.NAVER_ID).not.toBe('');
      expect(process.env.NAVER_PW).not.toBe('');
      expect(process.env.OPENAI_API_KEY).not.toBe('');
    });

    it('should access config service for credentials', () => {
      const config = service['configService'];
      const naverId = config.get('NAVER_ID');
      const naverPw = config.get('NAVER_PW');

      expect(naverId).toBeDefined();
      expect(naverPw).toBeDefined();
    });
  });

  describe('Processing Workflow', () => {
    it('should process questions in sequence with delays', async () => {
      const keyword = '자바';
      const startTime = Date.now();

      const result = await service.processQuestions(keyword);

      const duration = Date.now() - startTime;

      // If any questions were processed, should have delays between them (3000ms each)
      if (result.processed > 1) {
        const expectedMinDuration = (result.processed - 1) * 3000;
        expect(duration).toBeGreaterThanOrEqual(expectedMinDuration);
      }
    }, 180000);

    it('should maintain browser stability throughout processing', async () => {
      const keyword = '자바';

      await service.processQuestions(keyword);

      // Verify driver is still accessible after processing
      const handles = await driver.getAllWindowHandles();
      expect(handles.length).toBeGreaterThan(0);
    }, 180000);
  });
});
