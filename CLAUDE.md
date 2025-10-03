# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Naver Automation Suite**: TypeScript-based automation for Naver login and Naver 지식iN (KIN) question crawling/answering. Uses Selenium WebDriver with Chromium for browser automation, Cheerio for HTML parsing, and LangChain with OpenAI for AI-generated answers.

## Build & Run Commands

### Development
```bash
# Install dependencies
npm install

# Run the main automation
npx ts-node src/app.ts
```

### TypeScript Compilation
```bash
# Compile TypeScript (no explicit build script)
npx tsc

# Type checking only (no emit)
npx tsc --noEmit
```

**Note**: No test runner configured yet (package.json has placeholder test script that exits with error).

## Environment Variables

Required in `.env` file:
- `NAVER_ID`: Naver account username
- `NAVER_PW`: Naver account password
- `OPENAI_API_KEY`: OpenAI API key for answer generation

## Architecture

### Core Flow (`src/app.ts`)
1. **ChromDriver** → Creates Selenium WebDriver instance
2. **Login Service** → Authenticates with Naver using clipboard-based input (bypasses CAPTCHA)
3. **QuestionService** → Searches 지식iN, extracts questions, scrapes details
4. **AutoAnswerService** → Generates AI answers via LangChain/OpenAI
5. **QuestionService.postAnswer** → Submits answer to 지식iN via browser automation

### Layer Structure

#### 1. Browser Layer (`src/chrom/`)
- `ChromDriver`: Factory for creating Selenium WebDriver instances
- Uses Selenium Manager (auto-downloads ChromeDriver, no manual setup)

#### 2. Naver Domain Layer (`src/naver/`)

**Domain Models** (`domain/`)
- `Question`: Immutable entity with title, link, answerCount + mutable detailQuestion/answer

**Commands** (`in/`)
- `LoginCommand`: DTO for login credentials
- `QuestionCommand`: DTO for search query

**Services** (`service/`)
- `Login`:
  - Clipboard-based input to bypass CAPTCHA detection
  - Platform-aware paste (Command on macOS, Ctrl elsewhere)
  - Auto-skip device registration popup

- `QuestionService`:
  - `getQuestions()`: Search + parse question list with Cheerio
  - `getQuestionDetail()`: Navigate to question, extract full content
  - `postAnswer()`: Click answer button, inject text via Actions API, submit
  - Helper methods: `ensureAbsoluteUrl()`, `extractAnswerCount()`

#### 3. LLM Layer (`src/llm/`)
- `AutoAnswerService`:
  - Uses LangChain's `LLMChain` with `ChatPromptTemplate`
  - Generates Korean answers from question text
  - Modifies `Question` entity by calling `addAnswer()`

### Key Design Patterns

**Anti-CAPTCHA Strategy**: All text inputs use clipboard paste (`clipboardy` + `Key.chord`) instead of `sendKeys()` to avoid Naver's keyboard detection.

**Absolute URL Resolution**: Naver 지식iN returns relative URLs (`/qna/...`), service layer converts to absolute (`https://kin.naver.com/qna/...`).

**Browser Interaction Timing**:
- `driver.wait(until.elementLocated())` for dynamic elements
- `driver.executeScript('arguments[0].click()')` for stubborn buttons
- `driver.actions({async: true})` for complex input sequences
- Hard sleeps (`driver.sleep()`) for answer submission flow

**Domain Mutation**: `Question` entity allows post-construction mutation via `addDetailQuestion()` and `addAnswer()` to support progressive enrichment during workflow.

### File Organization

```
src/
├── chrom/utils/          # Browser automation utilities
├── naver/
│   ├── domain/           # Core entities (Question)
│   ├── in/               # Input DTOs (Commands)
│   └── service/          # Business logic (Login, QuestionService)
├── llm/service/          # AI integration
└── app.ts                # Main orchestration
```

## Development Notes

### Selenium Best Practices for This Codebase
- Always use `driver.wait()` before interacting with elements (10s default timeout)
- Use `executeScript` clicks for elements that Selenium's native click can't handle
- Platform detection required for keyboard shortcuts (see `Login.clipboardInput()`)

### Adding New Question Sources
- Implement in `QuestionService` following existing selector pattern
- Use `static readonly` for URLs and CSS selectors
- Maintain separation: navigation → parsing → entity creation

### Modifying AI Prompts
- Edit `AutoAnswerService.createSystemMessage()` or `createUserMessage()`
- LangChain's `ChatPromptTemplate` expects `role` + `content` message objects
- Result extraction via `chain.call({}).text`

### Chrome Options
- `ChromDriver` constructor accepts no parameters currently
- To add headless mode or other options, modify `chromeOptions` in constructor
- Selenium Manager handles driver binary automatically (no PATH config needed)
