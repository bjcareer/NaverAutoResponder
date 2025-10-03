# NestJS Migration Architecture Design

## 1. Architecture Overview

### 1.1 Current vs Target Architecture

```
Current (Plain TypeScript):
┌──────────────────────────────────────┐
│          app.ts (main)               │
│  - Manual dependency creation        │
│  - Sequential execution              │
│  - No modularization                 │
└────────┬─────────────────────────────┘
         │
         ├─── ChromDriver (new instance)
         ├─── Login (new instance)
         ├─── QuestionService (new instance)
         ├─── AutoAnswerService (new instance)
         └─── Direct execution


Target (NestJS Framework):
┌──────────────────────────────────────┐
│         NestJS Application           │
│  - Dependency Injection (IoC)        │
│  - Module-based architecture         │
│  - Lifecycle hooks                   │
│  - Interceptors & Guards             │
└────────┬─────────────────────────────┘
         │
         ├─── AppModule (root)
         │    ├─── NaverModule
         │    │    ├─── LoginService
         │    │    └─── QuestionService
         │    ├─── LlmModule
         │    │    └─── AutoAnswerService
         │    ├─── ChromModule
         │    │    └─── ChromDriverService
         │    └─── AdpickModule (future)
         │         ├─── AdpickService
         │         └─── LinkMatchingService
         │
         └─── Lambda Handler (AWS deployment)
              └─── Controller (REST API)
```

### 1.2 NestJS Module Structure

```
src/
├── main.ts                             # NestJS bootstrap entry
├── app.module.ts                       # Root application module
├── app.controller.ts                   # Root controller (health check)
├── app.service.ts                      # Root service (orchestration)
│
├── naver/                              # Naver domain module
│   ├── naver.module.ts                 # Module definition
│   ├── controllers/
│   │   └── naver.controller.ts         # REST API endpoints
│   ├── services/
│   │   ├── login.service.ts            # Login logic (Injectable)
│   │   └── question.service.ts         # Question logic (Injectable)
│   ├── domain/
│   │   └── Question.ts                 # Domain entity (unchanged)
│   └── dto/
│       ├── login.dto.ts                # LoginCommand → DTO
│       └── question.dto.ts             # QuestionCommand → DTO
│
├── llm/                                # LLM domain module
│   ├── llm.module.ts                   # Module definition
│   ├── services/
│   │   └── auto-answer.service.ts      # AI answer generation (Injectable)
│   └── dto/
│       └── answer.dto.ts               # Answer request/response DTOs
│
├── chrom/                              # Chrome driver module
│   ├── chrom.module.ts                 # Module definition
│   ├── services/
│   │   └── chrom-driver.service.ts     # WebDriver factory (Injectable)
│   └── config/
│       └── chrom.config.ts             # Chrome configuration
│
├── adpick/                             # Adpick affiliate module (future)
│   ├── adpick.module.ts                # Module definition
│   ├── services/
│   │   ├── adpick.service.ts           # Adpick integration
│   │   ├── link-cache.service.ts       # Link caching
│   │   └── link-matching.service.ts    # Link matching logic
│   ├── domain/
│   │   └── AffiliateLink.ts            # Domain entity
│   └── dto/
│       └── link-search.dto.ts          # Search DTOs
│
├── shared/                             # Shared utilities module
│   ├── shared.module.ts                # Global module
│   ├── services/
│   │   └── logger.service.ts           # Winston logger (Injectable)
│   ├── interceptors/
│   │   ├── logging.interceptor.ts      # Request logging
│   │   └── error.interceptor.ts        # Error handling
│   ├── filters/
│   │   └── http-exception.filter.ts    # Exception filter
│   └── config/
│       └── config.module.ts            # Configuration management
│
└── lambda.ts                           # AWS Lambda handler (optional)
```

## 2. NestJS Module Definitions

### 2.1 Root Module

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NaverModule } from './naver/naver.module';
import { LlmModule } from './llm/llm.module';
import { ChromModule } from './chrom/chrom.module';
import { SharedModule } from './shared/shared.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Domain modules
    SharedModule,
    ChromModule,
    NaverModule,
    LlmModule,
    // AdpickModule, // Add when implementing
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 2.2 Domain Modules

#### Naver Module

```typescript
// src/naver/naver.module.ts
import { Module } from '@nestjs/common';
import { LoginService } from './services/login.service';
import { QuestionService } from './services/question.service';
import { NaverController } from './controllers/naver.controller';
import { ChromModule } from '../chrom/chrom.module';

@Module({
  imports: [ChromModule], // Import WebDriver dependency
  controllers: [NaverController],
  providers: [LoginService, QuestionService],
  exports: [LoginService, QuestionService], // Export for other modules
})
export class NaverModule {}
```

#### LLM Module

```typescript
// src/llm/llm.module.ts
import { Module } from '@nestjs/common';
import { AutoAnswerService } from './services/auto-answer.service';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [
    AutoAnswerService,
    {
      provide: 'CHAT_MODEL',
      useFactory: (configService: ConfigService) => {
        return new ChatOpenAI({
          apiKey: configService.get<string>('OPENAI_API_KEY'),
          model: 'gpt-4o-mini',
          temperature: 0.7,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AutoAnswerService],
})
export class LlmModule {}
```

#### Chrome Module

```typescript
// src/chrom/chrom.module.ts
import { Module, Global } from '@nestjs/common';
import { ChromDriverService } from './services/chrom-driver.service';

@Global() // Make WebDriver globally available
@Module({
  providers: [ChromDriverService],
  exports: [ChromDriverService],
})
export class ChromModule {}
```

#### Shared Module

```typescript
// src/shared/shared.module.ts
import { Module, Global } from '@nestjs/common';
import { LoggerService } from './services/logger.service';

@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class SharedModule {}
```

## 3. Service Implementation (NestJS Style)

### 3.1 Injectable Services

#### Login Service

```typescript
// src/naver/services/login.service.ts
import { Injectable } from '@nestjs/common';
import { WebDriver, By, until, Key } from 'selenium-webdriver';
import clipboardy from 'clipboardy';
import { LoggerService } from '@shared/services/logger.service';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginService {
  private static readonly LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
  private static readonly ID_XPATH = '//*[@id="id"]';
  private static readonly PW_XPATH = '//*[@id="pw"]';
  private static readonly LOGIN_BUTTON_ID = 'log.login';

  constructor(private readonly logger: LoggerService) {}

  async login(loginDto: LoginDto, driver: WebDriver): Promise<void> {
    this.logger.info('LoginService', 'Starting Naver login', {
      username: loginDto.username,
    });

    await driver.get(LoginService.LOGIN_URL);
    await driver.wait(until.elementLocated(By.xpath(LoginService.ID_XPATH)), 10000);

    // ID / PW clipboard input
    await this.clipboardInput(driver, LoginService.ID_XPATH, loginDto.username);
    await this.clipboardInput(driver, LoginService.PW_XPATH, loginDto.password);

    // Click login button
    const loginBtn = await driver.wait(
      until.elementLocated(By.id(LoginService.LOGIN_BUTTON_ID)),
      10000
    );
    await loginBtn.click();

    await this.skipDeviceRegistration(driver);

    this.logger.info('LoginService', 'Login completed successfully');
  }

  private async clipboardInput(
    driver: WebDriver,
    xpath: string,
    text: string
  ): Promise<void> {
    const el = await driver.wait(until.elementLocated(By.xpath(xpath)), 10000);
    await el.click();
    await clipboardy.writeSync(text);
    const pasteKey = process.platform === 'darwin' ? Key.COMMAND : Key.CONTROL;
    const pasteChord = Key.chord(pasteKey, 'v');
    await el.sendKeys(pasteChord);
  }

  private async skipDeviceRegistration(driver: WebDriver): Promise<void> {
    try {
      const dontSaveBtn = await driver.wait(
        until.elementLocated(By.id('new.dontsave')),
        10000
      );
      await driver.wait(until.elementIsVisible(dontSaveBtn), 5000);
      await dontSaveBtn.click();
      this.logger.info('LoginService', 'Device registration skipped');
    } catch (e) {
      this.logger.warn('LoginService', 'No device registration button found');
    }
  }
}
```

#### Auto Answer Service

```typescript
// src/llm/services/auto-answer.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Question } from '@naver/domain/Question';
import { LoggerService } from '@shared/services/logger.service';

@Injectable()
export class AutoAnswerService {
  constructor(
    @Inject('CHAT_MODEL') private readonly chatModel: ChatOpenAI,
    private readonly logger: LoggerService
  ) {}

  async createAutoAnswer(question: Question): Promise<void> {
    this.logger.info('AutoAnswerService', 'Generating answer', {
      questionTitle: question.title,
    });

    const answer = await this.invokeChatModel(question.detailQuestion);
    question.addAnswer(answer);

    this.logger.info('AutoAnswerService', 'Answer generated successfully', {
      answerLength: answer.length,
    });
  }

  private async invokeChatModel(questionText: string): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        '당신은 네이버 지식iN의 전문 답변자입니다. 정확하고 유용한 정보를 제공하며, 친절하고 전문적인 어조로 답변합니다.',
      ],
      ['human', '{question}'],
    ]);

    const outputParser = new StringOutputParser();
    const chain = prompt.pipe(this.chatModel).pipe(outputParser);

    const result = await chain.invoke({ question: questionText });
    return result;
  }
}
```

#### Chrome Driver Service

```typescript
// src/chrom/services/chrom-driver.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Builder, WebDriver } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import { LoggerService } from '@shared/services/logger.service';

@Injectable()
export class ChromDriverService implements OnModuleDestroy {
  private driver: WebDriver | null = null;

  constructor(private readonly logger: LoggerService) {}

  async createDriver(): Promise<WebDriver> {
    if (this.driver) {
      return this.driver;
    }

    this.logger.info('ChromDriverService', 'Creating Chrome WebDriver');

    const options = new chrome.Options();
    options.addArguments('--disable-blink-features=AutomationControlled');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.excludeSwitches('enable-automation');
    options.setUserPreferences({ 'credentials_enable_service': false });

    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    return this.driver;
  }

  async getDriver(): Promise<WebDriver> {
    if (!this.driver) {
      return this.createDriver();
    }
    return this.driver;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.driver) {
      this.logger.info('ChromDriverService', 'Closing WebDriver');
      await this.driver.quit();
      this.driver = null;
    }
  }
}
```

### 3.2 Controllers (REST API)

#### App Controller

```typescript
// src/app.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { ProcessQuestionDto } from './dto/process-question.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('process-questions')
  async processQuestions(
    @Body() dto: ProcessQuestionDto
  ): Promise<{ processed: number; errors: number }> {
    return this.appService.processQuestions(dto);
  }
}
```

#### Naver Controller

```typescript
// src/naver/controllers/naver.controller.ts
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { QuestionService } from '../services/question.service';
import { LoginService } from '../services/login.service';
import { ChromDriverService } from '@chrom/services/chrom-driver.service';
import { LoginDto } from '../dto/login.dto';
import { QuestionSearchDto } from '../dto/question.dto';
import { Question } from '../domain/Question';

@Controller('naver')
export class NaverController {
  constructor(
    private readonly loginService: LoginService,
    private readonly questionService: QuestionService,
    private readonly chromDriver: ChromDriverService
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<{ success: boolean }> {
    const driver = await this.chromDriver.getDriver();
    await this.loginService.login(loginDto, driver);
    return { success: true };
  }

  @Get('questions')
  async getQuestions(
    @Query() searchDto: QuestionSearchDto
  ): Promise<Question[]> {
    const driver = await this.chromDriver.getDriver();
    return this.questionService.getQuestions(searchDto, driver);
  }
}
```

### 3.3 Application Service (Orchestration)

```typescript
// src/app.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromDriverService } from '@chrom/services/chrom-driver.service';
import { LoginService } from '@naver/services/login.service';
import { QuestionService } from '@naver/services/question.service';
import { AutoAnswerService } from '@llm/services/auto-answer.service';
import { LoggerService } from '@shared/services/logger.service';
import { ProcessQuestionDto } from './dto/process-question.dto';
import { LoginDto } from '@naver/dto/login.dto';
import { QuestionSearchDto } from '@naver/dto/question.dto';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly chromDriver: ChromDriverService,
    private readonly loginService: LoginService,
    private readonly questionService: QuestionService,
    private readonly autoAnswerService: AutoAnswerService,
    private readonly logger: LoggerService
  ) {}

  async processQuestions(
    dto: ProcessQuestionDto
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Get WebDriver
      const driver = await this.chromDriver.getDriver();

      // Login to Naver
      const loginDto: LoginDto = {
        username: this.configService.get<string>('NAVER_ID')!,
        password: this.configService.get<string>('NAVER_PW')!,
      };
      await this.loginService.login(loginDto, driver);

      // Get questions
      const searchDto: QuestionSearchDto = {
        query: dto.keyword,
      };
      const questions = await this.questionService.getQuestions(searchDto, driver);

      this.logger.info('AppService', `Found ${questions.length} questions`);

      // Process each question
      for (const question of questions) {
        try {
          await this.questionService.getQuestionDetail(driver, question);
          await this.autoAnswerService.createAutoAnswer(question);
          await this.questionService.postAnswer(
            driver,
            question,
            dto.promotionLink || 'https://next-stock.com/'
          );

          processed++;
          this.logger.info('AppService', `Processed question ${question.title}`);

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          errors++;
          this.logger.error(
            'AppService',
            `Failed to process question ${question.title}`,
            error
          );
        }
      }

      return { processed, errors };
    } catch (error) {
      this.logger.error('AppService', 'Fatal error in processQuestions', error);
      throw error;
    }
  }
}
```

## 4. DTOs (Data Transfer Objects)

### 4.1 Login DTO

```typescript
// src/naver/dto/login.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
```

### 4.2 Question DTOs

```typescript
// src/naver/dto/question.dto.ts
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class QuestionSearchDto {
  @IsString()
  @IsNotEmpty()
  query: string;
}

export class ProcessQuestionDto {
  @IsString()
  @IsNotEmpty()
  keyword: string;

  @IsString()
  @IsOptional()
  promotionLink?: string;
}
```

## 5. Configuration Management

### 5.1 Environment Configuration

```typescript
// src/shared/config/configuration.ts
export default () => ({
  naver: {
    id: process.env.NAVER_ID,
    password: process.env.NAVER_PW,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    environment: process.env.NODE_ENV || 'development',
  },
});
```

## 6. Entry Points

### 6.1 Standard NestJS Entry

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggerService } from '@shared/services/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // Use custom logger
  });

  // Use custom logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // CORS (if needed)
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.info('NestApplication', `Application running on port ${port}`);
}

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
```

### 6.2 AWS Lambda Handler

```typescript
// src/lambda.ts
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Context, Handler } from 'aws-lambda';
import * as serverlessExpress from '@vendia/serverless-express';
import * as express from 'express';

let cachedServer: Handler;

async function bootstrapServer(): Promise<Handler> {
  if (!cachedServer) {
    const expressApp = express();
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      { logger: false }
    );

    await nestApp.init();
    cachedServer = serverlessExpress({ app: expressApp });
  }

  return cachedServer;
}

export const handler: Handler = async (event: any, context: Context) => {
  const server = await bootstrapServer();
  return server(event, context);
};
```

## 7. Testing Updates

### 7.1 NestJS Testing Module

```typescript
// src/llm/services/__tests__/auto-answer.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AutoAnswerService } from '../auto-answer.service';
import { ChatOpenAI } from '@langchain/openai';
import { Question } from '@naver/domain/Question';
import { LoggerService } from '@shared/services/logger.service';

describe('AutoAnswerService', () => {
  let service: AutoAnswerService;
  let mockChatModel: jest.Mocked<ChatOpenAI>;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    mockChatModel = {
      invoke: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoAnswerService,
        {
          provide: 'CHAT_MODEL',
          useValue: mockChatModel,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AutoAnswerService>(AutoAnswerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate answer and add to question', async () => {
    const mockAnswer = '주식 투자는 기본적인 지식 습득부터 시작하세요.';
    mockChatModel.invoke.mockResolvedValue({ content: mockAnswer } as any);

    const question = new Question('주식 투자 방법', 'https://kin.naver.com/test', 0);
    question.addDetailQuestion('주식 투자를 시작하려고 하는데 어떻게 시작해야 할까요?');

    await service.createAutoAnswer(question);

    expect(question.answer).toBe(mockAnswer);
    expect(mockLogger.info).toHaveBeenCalledTimes(2);
  });
});
```

## 8. Package.json Updates

```json
{
  "name": "naver-auto-responder",
  "version": "2.0.0",
  "description": "NestJS-based Naver KIN Auto Responder",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@vendia/serverless-express": "^4.10.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1",
    "@langchain/openai": "^0.5.7",
    "cheerio": "^1.0.0",
    "chromedriver": "^135.0.4",
    "clipboardy": "^4.0.0",
    "dotenv": "^16.5.0",
    "html-entities": "^2.6.0",
    "langchain": "^0.3.24",
    "openai": "^4.96.0",
    "selenium-webdriver": "^4.31.0",
    "winston": "^3.18.3"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/node": "^20.3.1",
    "@types/jest": "^29.5.2",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.42.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.0",
    "jest": "^29.5.0",
    "prettier": "^3.0.0",
    "source-map-support": "^0.5.21",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.3",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3"
  }
}
```

## 9. NestJS Configuration Files

### 9.1 nest-cli.json

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": false,
    "tsConfigPath": "tsconfig.json"
  }
}
```

### 9.2 Updated tsconfig.json

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./src",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "paths": {
      "@/*": ["./*"],
      "@naver/*": ["naver/*"],
      "@llm/*": ["llm/*"],
      "@chrom/*": ["chrom/*"],
      "@adpick/*": ["adpick/*"],
      "@shared/*": ["shared/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

## 10. Migration Strategy

### Phase 1: Setup NestJS Foundation (Week 1)
1. ✅ Install NestJS dependencies
2. ✅ Create module structure
3. ✅ Configure NestJS CLI
4. ✅ Setup ConfigModule for environment variables

### Phase 2: Migrate Services (Week 2)
1. ✅ Convert services to @Injectable()
2. ✅ Setup dependency injection
3. ✅ Create DTOs with validation
4. ✅ Update imports and exports

### Phase 3: Add Controllers (Week 3)
1. ✅ Create REST API endpoints
2. ✅ Add interceptors and filters
3. ✅ Setup validation pipes
4. ✅ Add health checks

### Phase 4: Testing & Lambda (Week 4)
1. ✅ Migrate tests to NestJS testing
2. ✅ Create Lambda handler
3. ✅ Test serverless deployment
4. ✅ Performance optimization

## 11. Benefits of NestJS Migration

### Development Benefits
- ✅ **Automatic Dependency Injection**: No manual service instantiation
- ✅ **Modular Architecture**: Clear separation of concerns
- ✅ **Type Safety**: Full TypeScript support with decorators
- ✅ **Built-in Validation**: Class-validator integration
- ✅ **Interceptors & Middleware**: Cross-cutting concerns handling
- ✅ **Testing Support**: Comprehensive testing utilities

### Operational Benefits
- ✅ **Lambda Ready**: Easy AWS Lambda deployment
- ✅ **Scalability**: Microservices-ready architecture
- ✅ **Observability**: Built-in logging and monitoring hooks
- ✅ **Documentation**: Swagger/OpenAPI auto-generation
- ✅ **Error Handling**: Global exception filters

### Code Quality Benefits
- ✅ **SOLID Principles**: Enforced by framework design
- ✅ **Testability**: Mock-friendly DI container
- ✅ **Maintainability**: Clear module boundaries
- ✅ **Extensibility**: Plugin and middleware system

## Summary

이 설계는 다음을 제공합니다:

- **모듈화된 구조**: Domain별 명확한 경계
- **의존성 주입**: NestJS IoC Container 활용
- **REST API**: Controller 기반 엔드포인트
- **Lambda 지원**: Serverless 배포 준비
- **테스트 가능성**: NestJS Testing 모듈 활용
- **확장성**: Adpick 모듈 추가 준비

다음 단계는 실제 구현으로 진행할 수 있습니다.
