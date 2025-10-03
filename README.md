# 🤖 Naver Auto Responder

네이버 지식iN 질문에 AI 기반 자동 답변을 제공하는 NestJS 애플리케이션입니다.
Selenium WebDriver, Cheerio, LangChain(OpenAI)을 활용하여 네이버 로그인부터 질문 검색, AI 답변 생성, 자동 게시까지 전 과정을 자동화합니다.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.1-red)](https://nestjs.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT-green)](https://openai.com/)

---

## 📋 목차

1. [프로젝트 개요](#-프로젝트-개요)
2. [주요 기능](#-주요-기능)
3. [시스템 아키텍처](#-시스템-아키텍처)
4. [사전 준비](#-사전-준비)
5. [설치 및 실행](#-설치-및-실행)
6. [환경 변수 설정](#-환경-변수-설정)
7. [API 사용 방법](#-api-사용-방법)
8. [프로젝트 구조](#-프로젝트-구조)
9. [테스트](#-테스트)
10. [기술 스택](#-기술-스택)
11. [주의사항](#-주의사항)

---

## 🎯 프로젝트 개요

네이버 지식iN에서 특정 키워드로 질문을 검색하고, AI(GPT)를 활용하여 자동으로 답변을 생성 및 게시하는 자동화 시스템입니다.

### 핵심 목표
- **자동화**: 네이버 로그인 → 질문 검색 → 답변 생성 → 게시 전 과정 자동화
- **AI 기반 답변**: LangChain + OpenAI를 통한 자연스럽고 정확한 답변 생성
- **확장성**: NestJS 모듈 구조로 유지보수 및 기능 확장 용이

---

## ⚡ 주요 기능

### 1. 네이버 자동 로그인
- Selenium WebDriver를 통한 실제 브라우저 제어
- 자동 로그인 및 세션 유지
- 보안 검증 우회 로직 포함

### 2. 질문 검색 및 크롤링
- 키워드 기반 지식iN 질문 검색
- Cheerio를 활용한 HTML 파싱
- 질문 제목, 본문, 답변 수 등 메타데이터 수집
- 답변 대상 필터링 (답변 수 기준)

### 3. AI 답변 생성
- LangChain + OpenAI GPT 모델 활용
- 질문 컨텍스트 기반 맞춤형 답변 생성
- 전문적이고 친절한 어조 자동 적용
- 프롬프트 엔지니어링 최적화

### 4. 자동 답변 게시
- Selenium을 통한 답변 입력 자동화
- 프로모션 링크 자동 삽입
- 게시 후 검증 로직
- 에러 처리 및 재시도 메커니즘

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐
│  HTTP Request   │ ← POST /process-questions
└────────┬────────┘
         ↓
┌─────────────────────────────────────┐
│   QuestionProcessorController       │
└────────┬────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│   QuestionProcessorService          │ ← 전체 워크플로우 오케스트레이션
└──┬──────┬──────┬──────┬─────────────┘
   ↓      ↓      ↓      ↓
   1      2      3      4

1. ChromDriverService      → Selenium 브라우저 제어
2. LoginService            → 네이버 로그인
3. QuestionService         → 질문 크롤링 & 답변 게시
4. AutoAnswerService       → AI 답변 생성 (LangChain + OpenAI)
```

### 데이터 흐름
```
사용자 요청 (keyword)
  → 네이버 로그인
  → 키워드로 질문 검색
  → 각 질문별로:
     ├─ 질문 상세 파싱
     ├─ AI 답변 생성
     └─ 답변 자동 게시
  → 결과 반환 (성공/실패 개수)
```

---

## 📦 사전 준비

### 필수 요구사항
- **Node.js**: v20 이상
- **npm**: v10 이상 (또는 pnpm)
- **Chrome/Chromium**: 최신 버전 설치
- **OpenAI API Key**: [OpenAI Platform](https://platform.openai.com/)에서 발급

### 계정 준비
- 네이버 계정 (로그인용)
- OpenAI API 계정 및 API Key

---

## 🚀 설치 및 실행

### 1. 레포지토리 클론
```bash
git clone https://github.com/bjcareer/NaverAutoResponder.git
cd NaverAutoResponder
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 입력합니다:

```env
# 네이버 계정 정보
NAVER_ID=your_naver_id
NAVER_PW=your_naver_password

# OpenAI API 키
OPENAI_API_KEY=sk-your-openai-api-key

# 애플리케이션 설정
PORT=3000
```

### 4. 빌드 및 실행

#### 개발 모드 (Hot Reload)
```bash
npm run start:dev
```

#### 프로덕션 모드
```bash
# 빌드
npm run build

# 실행
npm run start:prod
```

서버가 시작되면: `http://localhost:3000` 에서 API 사용 가능

---

## 🔧 환경 변수 설정

| 변수명 | 설명 | 필수 여부 | 예시 |
|--------|------|----------|------|
| `NAVER_ID` | 네이버 로그인 아이디 | ✅ 필수 | `myid@naver.com` |
| `NAVER_PW` | 네이버 로그인 비밀번호 | ✅ 필수 | `mypassword123` |
| `OPENAI_API_KEY` | OpenAI API 키 | ✅ 필수 | `sk-proj-...` |
| `PORT` | 서버 포트 | ⚠️ 선택 | `3000` (기본값) |

---

## 📡 API 사용 방법

### POST /process-questions
네이버 지식iN에서 특정 키워드로 질문을 검색하고 AI 답변을 자동 게시합니다.

#### Request
```bash
curl -X POST http://localhost:3000/process-questions \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "Node.js 에러",
    "promotionLink": "https://your-blog.com"
  }'
```

#### Request Body
```typescript
{
  keyword: string;          // 검색할 키워드 (필수)
  promotionLink?: string;   // 답변에 포함할 프로모션 링크 (선택, 기본값: https://next-stock.com/)
}
```

#### Response
```json
{
  "processed": 5,  // 성공적으로 처리된 질문 수
  "errors": 1      // 실패한 질문 수
}
```

#### 예시: Postman 사용
1. Method: `POST`
2. URL: `http://localhost:3000/process-questions`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "keyword": "TypeScript 오류",
  "promotionLink": "https://myblog.com/typescript-guide"
}
```

---

## 📂 프로젝트 구조

```
NaverAutoResponder/
├── src/
│   ├── app.module.ts                    # 루트 모듈
│   ├── main.ts                          # 애플리케이션 진입점
│   │
│   ├── chrom/                           # Chrome Driver 모듈
│   │   ├── chrom.module.ts
│   │   └── services/
│   │       └── chrom-driver.service.ts  # Selenium WebDriver 관리
│   │
│   ├── naver/                           # 네이버 관련 모듈
│   │   ├── naver.module.ts
│   │   ├── domain/
│   │   │   └── Question.ts              # 질문 도메인 모델
│   │   ├── dto/
│   │   │   ├── login.dto.ts             # 로그인 DTO
│   │   │   └── question.dto.ts          # 질문 검색 DTO
│   │   └── services/
│   │       ├── login.service.ts         # 네이버 자동 로그인
│   │       └── question.service.ts      # 질문 크롤링 및 답변 게시
│   │
│   ├── llm/                             # LLM(AI) 모듈
│   │   ├── llm.module.ts
│   │   └── services/
│   │       └── auto-answer.service.ts   # AI 답변 생성 (LangChain + OpenAI)
│   │
│   ├── question-processor/              # 질문 처리 워크플로우 모듈
│   │   ├── question-processor.module.ts
│   │   ├── controllers/
│   │   │   └── question-processor.controller.ts  # API 엔드포인트
│   │   ├── dto/
│   │   │   └── process-question.dto.ts
│   │   └── services/
│   │       └── question-processor.service.ts     # 전체 프로세스 오케스트레이션
│   │
│   └── shared/                          # 공통 모듈
│       ├── shared.module.ts
│       └── services/
│           └── logger.service.ts        # Winston 기반 로깅
│
├── test/                                # E2E 테스트
│   └── question-processor.e2e-spec.ts
│
├── .env                                 # 환경 변수 (git ignored)
├── package.json
├── tsconfig.json
└── README.md
```

### 모듈별 책임

| 모듈 | 책임 |
|------|------|
| **ChromModule** | Selenium WebDriver 생성 및 관리 |
| **NaverModule** | 네이버 로그인, 질문 크롤링, 답변 게시 |
| **LlmModule** | LangChain + OpenAI를 통한 AI 답변 생성 |
| **QuestionProcessorModule** | 전체 워크플로우 통합 및 API 제공 |
| **SharedModule** | 로깅 등 공통 유틸리티 |

---

## 🧪 테스트

### E2E 테스트 실행
```bash
npm run test:e2e
```

### 단위 테스트 실행
```bash
npm test
```

### 테스트 커버리지
```bash
npm run test:cov
```

### 테스트 환경
- **Framework**: Jest
- **Test Type**: E2E (End-to-End)
- **Test File**: `test/question-processor.e2e-spec.ts`

---

## 🛠️ 기술 스택

### Backend Framework
- **NestJS 11.1**: Progressive Node.js framework
- **TypeScript 5.8**: 정적 타입 시스템

### Browser Automation
- **Selenium WebDriver 4.31**: 브라우저 자동화
- **Chromium Driver**: Chrome 브라우저 제어

### Web Scraping
- **Cheerio 1.0**: HTML 파싱 (jQuery-like API)
- **html-entities 2.6**: HTML 엔티티 디코딩

### AI & LLM
- **LangChain 0.3**: LLM 애플리케이션 프레임워크
- **@langchain/openai 0.5**: OpenAI 통합
- **OpenAI 4.96**: GPT API 클라이언트

### Utilities
- **Winston 3.18**: 로깅
- **class-validator**: DTO 유효성 검사
- **class-transformer**: 객체 변환
- **dotenv**: 환경 변수 관리

### Development Tools
- **Jest**: 테스트 프레임워크
- **ESLint**: 코드 린팅
- **Prettier**: 코드 포맷팅

---

## ⚠️ 주의사항

### 법적 고지
- 본 프로젝트는 **교육 및 연구 목적**으로 제작되었습니다
- 네이버 서비스 약관을 준수하여 사용하시기 바랍니다
- 자동화 도구 사용 시 네이버의 이용 정책을 반드시 확인하세요
- 무분별한 자동 게시는 계정 정지 등의 제재를 받을 수 있습니다

### 사용 제한사항
- **Rate Limiting**: 과도한 요청 방지를 위해 적절한 딜레이 설정 필요
- **OpenAI 비용**: API 사용량에 따라 과금되므로 예산 관리 필요
- **계정 보안**: `.env` 파일은 절대 공개 레포지토리에 업로드하지 마세요

### 권장 사항
- 테스트 환경에서 충분히 검증 후 실제 운영 사용
- 네이버 UI 변경 시 셀렉터 업데이트 필요
- Chrome 버전 업데이트 시 ChromeDriver 호환성 확인
- 프로모션 링크는 스팸으로 간주될 수 있으므로 신중히 사용

---

## 🤝 Contributing

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License.

---

## 👤 Author

**bjcareer**
- GitHub: [@bjcareer](https://github.com/bjcareer)
- Repository: [NaverAutoResponder](https://github.com/bjcareer/NaverAutoResponder)

---

## 📞 Support

문제가 발생하거나 질문이 있으시면 [Issues](https://github.com/bjcareer/NaverAutoResponder/issues)에 등록해 주세요.
