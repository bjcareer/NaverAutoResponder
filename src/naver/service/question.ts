// src/naver/service/QuestionService.ts

import {By, until, WebDriver} from 'selenium-webdriver';
import * as cheerio from 'cheerio';
import {decode} from 'html-entities';
import {QuestionCommand} from '../in/questionCommand';
import {Question} from '../domain/Question';

export class QuestionService {
    private static readonly baseUrl = 'https://kin.naver.com';
    private static readonly ITEM_SELECTOR = '.basic1 > li';
    private static readonly ANSWER_SELECTOR = 'dd.txt_block span.hit';
    private static readonly TITLE_ELEMENT = 'a._searchListTitleAnchor';
    private static readonly DEFAULT_TIMEOUT = 10_000;

    /**
     * 네이버 지식iN에서 query 검색 후,
     * 각 질문의 제목·링크·답변 수를 가져옵니다.
     */
    public async getQuestions(command: QuestionCommand, driver: WebDriver): Promise<Question[]> {
        const result: Question[] = [];
        const url = `${QuestionService.baseUrl}/search/list.naver?query=${encodeURIComponent(command.query)}&sort=date&section=qna`;

        const pageSource = await this.openQuestionPage(driver, url);
        const $ = cheerio.load(pageSource);

        // 질문 아이템 순회
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

        return result;
    }

    /**
     * 상대경로 href를 절대 URL로 변환합니다.
     */
    private ensureAbsoluteUrl(href: string): string {
        if (href.startsWith('/')) {
            return QuestionService.baseUrl + href;
        }
        return href;
    }

    /**
     * li 요소에서 '답변수' 라벨의 숫자만 파싱해 반환합니다.
     */
    private extractAnswerCount($li: cheerio.Cheerio): number {
        const $hit = $li.find(QuestionService.ANSWER_SELECTOR).first();
        if (!$hit.length) return 0;

        const text = $hit.text().trim();
        const match = text.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    }

    /**
     * 지정된 URL을 WebDriver로 열고,
     * ITEM_SELECTOR가 로드될 때까지 기다린 후 페이지 소스를 반환합니다.
     */
    private async openQuestionPage(driver: WebDriver, url: string): Promise<string> {
        await driver.get(url);
        await driver.wait(until.elementLocated(By.css(QuestionService.ITEM_SELECTOR)), QuestionService.DEFAULT_TIMEOUT);
        return await driver.getPageSource();
    }
}
