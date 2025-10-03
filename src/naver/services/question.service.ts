import { Injectable } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import * as cheerio from 'cheerio';
import { decode } from 'html-entities';
import { QuestionSearchDto } from '../dto/question.dto';
import { Question } from '../domain/Question';
import { LoggerService } from '@shared/services/logger.service';

@Injectable()
export class QuestionService {
  private static readonly baseUrl = 'https://kin.naver.com';
  private static readonly ITEM_SELECTOR = '.basic1 > li';
  private static readonly ANSWER_SELECTOR = 'dd.txt_block span.hit';
  private static readonly TITLE_ELEMENT = 'a._searchListTitleAnchor';
  private static readonly DEFAULT_TIMEOUT = 10_000;

  constructor(private readonly logger: LoggerService) {}

  async getQuestions(
    searchDto: QuestionSearchDto,
    page: Page
  ): Promise<Question[]> {
    const result: Question[] = [];
    const url = `${QuestionService.baseUrl}/search/list.naver?query=${encodeURIComponent(searchDto.query)}&sort=date&section=qna`;

    const pageSource = await this.openQuestionPage(page, url);
    const $ = cheerio.load(pageSource);

    $(QuestionService.ITEM_SELECTOR).each((_, elem) => {
      const $li = $(elem);
      const $anchor = $li.find(QuestionService.TITLE_ELEMENT).first();
      if (!$anchor.length) return;

      const title = $anchor.text().trim();
      let href = $anchor.attr('href')?.trim() ?? '';
      const link = decode(this.ensureAbsoluteUrl(href));
      const answerCount = this.extractAnswerCount($li);

      result.push(new Question(title, link, answerCount));
    });

    this.logger.info('QuestionService', `Found ${result.length} questions`);
    return result;
  }

  async getQuestionDetail(page: Page, question: Question): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Navigate with timeout and proper wait
        await page.goto(question.link, {
          waitUntil: 'networkidle2',
          timeout: QuestionService.DEFAULT_TIMEOUT,
        });

        // Wait for question detail to appear
        await page.waitForSelector('div.questionDetail', {
          timeout: QuestionService.DEFAULT_TIMEOUT,
        });

        const html = await page.content();
        const $ = cheerio.load(html);

        const $detail = $('div.questionDetail').first();
        const detailText = $detail.length
          ? $detail.text().trim()
          : '질문 내용을 찾지 못했습니다.';

        question.addDetailQuestion(detailText);
        this.logger.info('QuestionService', `Loaded question detail: ${question.title}`);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        const errorMessage = (error as Error).message;
        this.logger.warn(
          'QuestionService',
          `Failed to load question detail (attempt ${attempt}/${maxRetries}): ${errorMessage}`,
        );

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const waitTime = 1000 * attempt;
          this.logger.info(
            'QuestionService',
            `Retrying after ${waitTime}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));

          // Check if page is still valid, if not recreate
          const errorMessage = lastError?.message || '';
          if (errorMessage.includes('detached')) {
            this.logger.warn(
              'QuestionService',
              'Page detached, attempting to continue with new navigation',
            );
          }
        }
      }
    }

    // All retries failed
    throw new Error(
      `Failed to load question detail after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  async postAnswer(
    page: Page,
    question: Question,
    promotionLink: string
  ): Promise<void> {
    await page.goto(question.link, { waitUntil: 'networkidle2' });

    await page.waitForSelector('button.endAnswerButton._answerWriteButton._scrollToEditor', {
      timeout: QuestionService.DEFAULT_TIMEOUT
    });

    await page.click('button.endAnswerButton._answerWriteButton._scrollToEditor');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.pasteIntoEditor(page, question.answer || '', promotionLink);

    await page.waitForSelector('#answerRegisterButton', {
      timeout: QuestionService.DEFAULT_TIMEOUT
    });

    await page.click('#answerRegisterButton');
    this.logger.info('QuestionService', 'Answer posted successfully');
  }

  private async pasteIntoEditor(
    page: Page,
    content: string,
    promotionLink: string
  ): Promise<void> {
    this.logger.info('QuestionService', 'Pasting answer into editor', { content });

    await page.waitForSelector('section.se-canvas .se-section-text', {
      timeout: QuestionService.DEFAULT_TIMEOUT
    });

    const editorSelector = 'section.se-canvas .se-section-text';

    // Scroll into view and click
    await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView(true);
      }
    }, editorSelector);

    await page.click(editorSelector);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Type answer content
    await page.keyboard.type(content, { delay: 50 });
    await page.keyboard.press('Enter');

    // Type promotion link
    await page.keyboard.type(promotionLink, { delay: 50 });
  }

  private ensureAbsoluteUrl(href: string): string {
    if (href.startsWith('/')) {
      return QuestionService.baseUrl + href;
    }
    return href;
  }

  private extractAnswerCount($li: cheerio.Cheerio): number {
    const $hit = $li.find(QuestionService.ANSWER_SELECTOR).first();
    if (!$hit.length) return 0;

    const text = $hit.text().trim();
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  private async openQuestionPage(page: Page, url: string): Promise<string> {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for page to fully load
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: QuestionService.DEFAULT_TIMEOUT }
    );

    await page.waitForSelector(QuestionService.ITEM_SELECTOR, {
      timeout: QuestionService.DEFAULT_TIMEOUT
    });

    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 1000));

    return await page.content();
  }
}
