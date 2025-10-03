import {ChromDriver} from "@chrom/utils/chromDriver";
import {Login} from "@naver/service/login";
import {LoginCommand} from "@naver/in/loginCommand";
import {QuestionService} from "@naver/service/question";
import {QuestionCommand} from "@naver/in/questionCommand";
import {ChatOpenAI} from "@langchain/openai";
import {AutoAnswerService} from "@llm/service/autoAnswerService";
import {logger} from '@shared/utils/logger';

require('dotenv').config();

async function main(): Promise<void> {
    const chromDriver = new ChromDriver();
    const loginService = new Login();
    const questionService = new QuestionService();
    const driver = await chromDriver.createDriver();

    const {NAVER_ID, NAVER_PW, OPENAI_API_KEY} = process.env;

    if (!NAVER_ID || !NAVER_PW || !OPENAI_API_KEY) {
        throw new Error('환경 변수 NAVER_ID, NAVER_PW를 모두 설정해주세요.');
    }

    const chatModel = new ChatOpenAI({
        apiKey: OPENAI_API_KEY,
        model: 'gpt-4o-mini',
    });
    const autoAnswerService = new AutoAnswerService(chatModel);

    try {
        // 테스트할 시나리오
        await driver.get('https://www.naver.com/');
        await loginService.login(new LoginCommand(NAVER_ID, NAVER_PW), driver);
        let questions = await questionService.getQuestions(new QuestionCommand('주식'), driver);

        for (const question of questions) {
            await questionService.getQuestionDetail(driver, question);
            await autoAnswerService.crateAutoAnswer(question);
            await questionService.postAnswer(driver, question, 'https://next-stock.com/');

            driver.sleep(10000000);
        }

    } finally {
        await driver.quit();
    }
}

// 에러를 잡아내고 프로세스 종료 코드도 설정
main().catch((err) => {
    logger.error('애플리케이션 실행 중 오류 발생', err);
    process.exit(1);
});
