// src/naver/service/QuestionService.ts

import {By, Key, until, WebDriver} from 'selenium-webdriver';
import * as cheerio from 'cheerio';
import {decode} from 'html-entities';
import {QuestionCommand} from '../in/questionCommand';
import {Question} from '../domain/Question';
import clipboardy from "clipboardy";
import * as os from "node:os";

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

    public async getQuestionDetail(driver: WebDriver, question: Question) {
        await driver.get(question.link);
        await driver.wait(
            until.elementLocated(By.css('div.questionDetail')),
            QuestionService.DEFAULT_TIMEOUT
        );

        // 2) 페이지 소스 파싱
        const html = await driver.getPageSource();
        const $ = cheerio.load(html);

        // 3) 질문 본문 추출
        const $detail = $('div.questionDetail').first();
        const detailText = $detail.length ? $detail.text().trim() : '질문 내용을 찾지 못했습니다.';

        question.addDetailQuestion(detailText);
    }

    public async postAnswer(driver: WebDriver, question: Question, promotionLink: string) {
        await driver.get(question.link);

        const answerBtn = await driver.wait(
            until.elementLocated(
                By.css('button.endAnswerButton._answerWriteButton._scrollToEditor')
            ),
            5_000
        );
        await driver.executeScript('arguments[0].click();', answerBtn);
        await driver.sleep(2_000);

        const rawAnswer = question.answer
        const finalAnswer = rawAnswer + '\n\n';
        console.log(`📝 생성된 답변:\n${finalAnswer}`);

        this.pasteIntoEditor(driver, finalAnswer, promotionLink);

        // 5) [답변등록] 버튼 클릭
        const submitBtn = await driver.wait(
            until.elementLocated(By.id('answerRegisterButton')),
            10_000
        );
        await driver.executeScript('arguments[0].click();', submitBtn);
        console.log('✅ 답변이 정상적으로 제출되었습니다.');
    }

    /**
     * 네이버 지식iN 스마트에디터 본문에
     * 1) LLM이 만든 답변 텍스트(content)를 클립보드로 붙여넣고,
     * 2) 프로모션 링크를 한 글자씩 타이핑하여 OG 미리보기가 뜨도록 처리합니다.
     */
    async pasteIntoEditor(driver: WebDriver, content: string, promotionLink: string): Promise<void> {
        // 1) 에디터 본문 요소 대기 & 스크롤
        const editorBody = await driver.wait(
            until.elementLocated(By.css('section.se-canvas .se-section-text')),
            10_000
        );
        await driver.executeScript('arguments[0].scrollIntoView(true);', editorBody);
        await driver.sleep(1_000);

        // 2) 포커스 위해 클릭
        await driver.executeScript('arguments[0].click();', editorBody);
        await driver.sleep(1_000);

        // ─────────────────────────────────────────────────────────────────────────
        // [A] 클립보드에 content 쓰고 붙여넣기
        // ─────────────────────────────────────────────────────────────────────────
        await clipboardy.writeSync(content);

        const actions = driver.actions({async: true});
        const isMac = os.platform() === 'darwin';
        const modifierKey = isMac ? Key.COMMAND : Key.CONTROL;

        // 키다운 → 붙여넣기 → 키업
        await actions
            .keyDown(modifierKey)
            .sendKeys('v')
            .keyUp(modifierKey)
            .perform();

        await driver.sleep(1_000);

        for (const ch of promotionLink) {
            // 한 글자씩 sendKeys 후 짧게 대기
            await actions.sendKeys(ch).perform();
            await driver.sleep(50);
        }
        // 엔터로 OG 미리보기 트리거
        await actions.sendKeys(Key.ENTER).perform();

        // 링크 인식 대기
        await driver.sleep(10_000);
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
