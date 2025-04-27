import {ChromDriver} from "./chrom/utils/chromDriver";
import {LoginService} from "./naver/service/loginService";
import {LoginCommand} from "./naver/in/loginCommand";
import {QuestionService} from "./naver/service/question";
import {QuestionCommand} from "./naver/in/questionCommand";

async function main(): Promise<void> {
    const chromDriver = new ChromDriver();
    const loginService = new LoginService();
    const questionService = new QuestionService();
    const driver = await chromDriver.createDriver();

    try {
        // 테스트할 시나리오
        await driver.get('https://www.naver.com/');
        await loginService.login(new LoginCommand('changeme', 'changeme'), driver);
        let questions = await questionService.getQuestions(new QuestionCommand('자바스크립트'), driver);

    } finally {
        await driver.quit();
    }
}

// 에러를 잡아내고 프로세스 종료 코드도 설정
main().catch((err) => {
    console.error('Error in main():', err);
    process.exit(1);
});
