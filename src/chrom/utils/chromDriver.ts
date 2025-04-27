// src/utils/WebDriverFactory.ts
import {Builder, ThenableWebDriver} from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

export class ChromDriver {
    private chromeOptions: chrome.Options;

    /**
     * @param headless true면 헤드리스 모드로 실행
     */
    constructor() {
        this.chromeOptions = new chrome.Options();
    }

    /**
     * Selenium Manager가 자동으로 ChromeDriver를 내려받고
     * WebDriver를 생성해 줍니다. 환경변수 등록·bin 경로 지정 불필요!
     */
    public async createDriver(): Promise<ThenableWebDriver> {
        const driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(this.chromeOptions)
            .build();   // ← 여기서 자동 다운로드+실행
        return driver;
    }
}
