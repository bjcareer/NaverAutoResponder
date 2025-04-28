import {LoginCommand} from "../in/loginCommand";
import clipboardy from "clipboardy";
import {By, Key, until, WebDriver} from "selenium-webdriver";

export class Login {
    public static readonly LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
    public static readonly ID_XPATH = '//*[@id="id"]';
    public static readonly PW_XPATH = '//*[@id="pw"]';
    public static readonly LOGIN_BUTTON_ID = 'log.login';

    constructor() {
    }

    /**
     * 네이버 로그인 수행 (CAPTCHA 대응: 복사-붙여넣기 사용)
     */
    async login(command: LoginCommand, driver: WebDriver): Promise<void> {
        console.log(`Logging in with username: ${command.username}`);

        await driver.get(Login.LOGIN_URL);
        await driver.wait(until.elementLocated(By.xpath(Login.ID_XPATH)), 10000);

        // ID / PW 붙여넣기
        await this.clipboardInput(driver, Login.ID_XPATH, command.username);
        await this.clipboardInput(driver, Login.PW_XPATH, command.password);

        // 로그인 버튼 클릭
        const loginBtn = await driver.wait(until.elementLocated(By.id(Login.LOGIN_BUTTON_ID)), 10000);
        await loginBtn.click();
    }

    /**
     * 입력 필드에 클립보드를 이용해 붙여넣기합니다.
     * 캡차 등 직접 타이핑이 차단될 때 사용하세요.
     */
    private async clipboardInput(driver: WebDriver, xpath: string, text: string): Promise<void> {
        const el = await driver.wait(until.elementLocated(By.xpath(xpath)), 10000);
        await el.click();
        await clipboardy.writeSync(text);
        const pasteKey = process.platform === "darwin" ? Key.COMMAND : Key.CONTROL;
        const pasteChord = Key.chord(pasteKey, "v");
        await el.sendKeys(pasteChord);
        await driver.sleep(200);
    }
}
