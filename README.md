# Naver Automation Suite

네이버 로그인 자동화와 지식iN 질문 크롤링을 한 곳에 모은 TypeScript 프로젝트입니다.  
Selenium WebDriver(Chromium) 기반의 브라우저 제어와 Cheerio 기반의 HTML 파싱을 결합해,  
네이버 로그인부터 질문 목록 수집까지 손쉽게 자동화할 수 있습니다.

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [주요 기능](#주요-기능)
3. [사전 준비](#사전-준비)
4. [설치 및 실행](#설치-및-실행)
5. [환경 변수 설정](#환경-변수-설정)
6. [사용 방법](#사용-방법)
    - [LoginService](#loginservice)
    - [QuestionService](#questionservice)
7. [프로젝트 구조](#프로젝트-구조)
8. [테스트](#테스트)
9. [Contributing](#contributing)
10. [License](#license)

---

## 프로젝트 개요

- **이름**: Naver Automation Suite
- **기술 스택**:
    - TypeScript
    - Selenium WebDriver (Chromium)
    - Cheerio
    - html-entities
    - Jest (테스트)
- **목적**:
    - 네이버 로그인 과정을 자동화
    - 지식iN(네이버 Q&A)에서 최신 질문 목록을 크롤링

---

## 주요 기능

### 1. LoginService
- `ChromDriver` 유틸로 Chromium 드라이버 생성
- 아이디/비밀번호 입력 → 로그인 버튼 클릭 → 완료 대기
- `static readonly` 상수로 URL·셀렉터 관리

### 2. QuestionService
- `QuestionCommand` 로 전달받은 키워드로 검색 페이지 오픈
- `Cheerio` 로 HTML 파싱 후
    - 질문 제목(텍스트)
    - 질문 링크(절대 URL 보정)
    - 답변 수(“답변수 N”에서 숫자만 추출)
- 책임 분리된 헬퍼 메서드(`openQuestionPage`, `ensureAbsoluteUrl`, `extractAnswerCount`)

---

## 사전 준비

- Node.js v14 이상
- npm 또는 pnpm
- Chrome 또는 Chromium 브라우저 설치

---

## 설치 및 실행

```bash
# 레포지토리 클론
git clone https://github.com/bjcareer/NaverAutoResponder.git
cd NaverAutoResponder

# 의존성 설치
npm install
# └ selenium-webdriver cheerio html-entities
# └ @types/cheerio @types/html-entities
# └ jest ts-jest @types/jest (테스트)
