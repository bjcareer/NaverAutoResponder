import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ChromDriverService } from '../src/chrom/services/chrom-driver.service';

describe('QuestionProcessor E2E Test (실제 네이버 지식인 자동 답변)', () => {
  let app: INestApplication;
  let chromDriverService: ChromDriverService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    await app.init();

    chromDriverService = moduleFixture.get<ChromDriverService>(ChromDriverService);
  });

  afterAll(async () => {
    // Cleanup WebDriver
    if (chromDriverService) {
      await chromDriverService.onModuleDestroy();
    }
    await app.close();
  });

  describe('POST /questions/process', () => {
    it('should process questions and post answers (REAL E2E TEST)', async () => {
      // 환경 변수 확인
      expect(process.env.NAVER_ID).toBeDefined();
      expect(process.env.NAVER_PW).toBeDefined();
      expect(process.env.OPENAI_API_KEY).toBeDefined();

      const response = await request(app.getHttpServer())
        .post('/questions/process')
        .send({
          keyword: '주식',
          promotionLink: 'https://next-stock.com/',
        })
        .expect(201);

      // 응답 검증
      expect(response.body).toHaveProperty('processed');
      expect(response.body).toHaveProperty('errors');
      expect(response.body.processed).toBeGreaterThanOrEqual(0);
      expect(response.body.errors).toBeGreaterThanOrEqual(0);

      console.log('E2E Test Result:', response.body);
    }, 300000); // 5분 타임아웃 (실제 브라우저 작업 포함)

    it('should validate DTO and reject invalid requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/questions/process')
        .send({
          // keyword 누락
          promotionLink: 'https://next-stock.com/',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should accept request without promotion link', async () => {
      const response = await request(app.getHttpServer())
        .post('/questions/process')
        .send({
          keyword: '주식',
          // promotionLink는 optional
        })
        .expect(201);

      expect(response.body).toHaveProperty('processed');
      expect(response.body).toHaveProperty('errors');
    }, 300000);
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body.message).toBe('Naver Auto Responder API');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.status).toBe('ok');
    });
  });
});
