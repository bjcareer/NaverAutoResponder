import { Injectable } from '@nestjs/common';
import { By, Key, until, WebDriver } from 'selenium-webdriver';
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
    driver: WebDriver
  ): Promise<Question[]> {
    const result: Question[] = [];
    const url = `${QuestionService.baseUrl}/search/list.naver?query=${encodeURIComponent(searchDto.query)}&sort=date&section=qna`;

    const pageSource = await this.openQuestionPage(driver, url);
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

  async getQuestionDetail(driver: WebDriver, question: Question): Promise<void> {
    await driver.get(question.link);
    await driver.wait(
      until.elementLocated(By.css('div.questionDetail')),
      QuestionService.DEFAULT_TIMEOUT
    );

    const html = await driver.getPageSource();
    const $ = cheerio.load(html);

    const $detail = $('div.questionDetail').first();
    const detailText = $detail.length
      ? $detail.text().trim()
      : '질문 내용을 찾지 못했습니다.';

    question.addDetailQuestion(detailText);
    this.logger.info('QuestionService', `Loaded question detail: ${question.title}`);
  }

  async postAnswer(
    driver: WebDriver,
    question: Question,
    promotionLink: string
  ): Promise<void> {
    await driver.get(question.link);

    const answerBtn = await driver.wait(
      until.elementLocated(
        By.css('button.endAnswerButton._answerWriteButton._scrollToEditor')
      ),
      QuestionService.DEFAULT_TIMEOUT
    );
    await driver.executeScript('arguments[0].click();', answerBtn);
    await driver.sleep(2_000);

    await this.pasteIntoEditor(driver, question.answer || '', promotionLink);

    const submitBtn = await driver.wait(
      until.elementLocated(By.id('answerRegisterButton')),
      QuestionService.DEFAULT_TIMEOUT
    );
    await driver.executeScript('arguments[0].click();', submitBtn);
    this.logger.info('QuestionService', 'Answer posted successfully');
  }

  private async pasteIntoEditor(
    driver: WebDriver,
    content: string,
    promotionLink: string
  ): Promise<void> {
    this.logger.info('QuestionService', 'Pasting answer into editor', { content });
    const editorBody = await driver.wait(
      until.elementLocated(By.css('section.se-canvas .se-section-text')),
      QuestionService.DEFAULT_TIMEOUT
    );

    await driver.executeScript('arguments[0].scrollIntoView(true);', editorBody);
    await driver.executeScript('arguments[0].click();', editorBody);

    let actions = driver.actions({ async: true });
    await actions.click(editorBody).sendKeys(content).perform();
    await actions.sendKeys(Key.ENTER).perform();

    let newActions = driver.actions({ async: true });
    await newActions.sendKeys(promotionLink).perform();
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

  private async openQuestionPage(driver: WebDriver, url: string): Promise<string> {
    await driver.get(url);
    await driver.wait(
      until.elementLocated(By.css(QuestionService.ITEM_SELECTOR)),
      QuestionService.DEFAULT_TIMEOUT
    );
    return await driver.getPageSource();
  }
}
