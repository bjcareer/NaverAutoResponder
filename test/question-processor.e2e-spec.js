"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const supertest_1 = __importDefault(require("supertest"));
const app_module_1 = require("../src/app.module");
const chrom_driver_service_1 = require("../src/chrom/services/chrom-driver.service");
describe('QuestionProcessor E2E Test (실제 네이버 지식인 자동 답변)', () => {
    let app;
    let chromDriverService;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        const moduleFixture = yield testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new common_1.ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        yield app.init();
        chromDriverService = moduleFixture.get(chrom_driver_service_1.ChromDriverService);
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        if (chromDriverService) {
            yield chromDriverService.onModuleDestroy();
        }
        yield app.close();
    }));
    describe('POST /questions/process', () => {
        it('should process questions and post answers (REAL E2E TEST)', () => __awaiter(void 0, void 0, void 0, function* () {
            expect(process.env.NAVER_ID).toBeDefined();
            expect(process.env.NAVER_PW).toBeDefined();
            expect(process.env.OPENAI_API_KEY).toBeDefined();
            const response = yield (0, supertest_1.default)(app.getHttpServer())
                .post('/questions/process')
                .send({
                keyword: '주식',
                promotionLink: 'https://next-stock.com/',
            })
                .expect(201);
            expect(response.body).toHaveProperty('processed');
            expect(response.body).toHaveProperty('errors');
            expect(response.body.processed).toBeGreaterThanOrEqual(0);
            expect(response.body.errors).toBeGreaterThanOrEqual(0);
            console.log('E2E Test Result:', response.body);
        }), 300000);
        it('should validate DTO and reject invalid requests', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app.getHttpServer())
                .post('/questions/process')
                .send({
                promotionLink: 'https://next-stock.com/',
            })
                .expect(400);
            expect(response.body.message).toBeDefined();
        }));
        it('should accept request without promotion link', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app.getHttpServer())
                .post('/questions/process')
                .send({
                keyword: '주식',
            })
                .expect(201);
            expect(response.body).toHaveProperty('processed');
            expect(response.body).toHaveProperty('errors');
        }), 300000);
    });
    describe('GET /', () => {
        it('should return API information', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app.getHttpServer())
                .get('/')
                .expect(200);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('version');
            expect(response.body.message).toBe('Naver Auto Responder API');
        }));
    });
    describe('GET /health', () => {
        it('should return health status', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app.getHttpServer())
                .get('/health')
                .expect(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body.status).toBe('ok');
        }));
    });
});
//# sourceMappingURL=question-processor.e2e-spec.js.map