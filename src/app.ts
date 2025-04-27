import {ChromDriver} from "./chrom/utils/chromDriver";
import {LoginService} from "./naver/service/loginService";
import {LoginCommand} from "./naver/in/loginCommand";

async function main(): Promise<void> {
    const chromDriver = new ChromDriver();
    const loginService = new LoginService();
    const driver = await chromDriver.createDriver();

    try {
        // 테스트할 시나리오
        await driver.get('https://www.naver.com/');
        console.log(await driver.getTitle());
        await driver.sleep(5000);
        await loginService.login(new LoginCommand('changeme', 'changeme'), driver);

        // driver.wait(10000);

    } finally {
        await driver.quit();
    }
}

// 에러를 잡아내고 프로세스 종료 코드도 설정
main().catch((err) => {
    console.error('Error in main():', err);
    process.exit(1);
});
