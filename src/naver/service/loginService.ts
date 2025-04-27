import {LoginCommand} from "../in/loginCommand";
import clipboardy from 'clipboardy';
import {By, Key, until, WebDriver} from 'selenium-webdriver';

export class LoginService {
    public static readonly LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
    public static readonly ID_ELEMENT_XPATH = '//*[@id="id"]';
    public static readonly PASSWORD_ELEMENT_XPATH = '//*[@id="pw"]';
    public static readonly LOGIN_BUTTON_ELEMENT_XPATH = 'log.login';

    constructor() {
    }


    async login(command: LoginCommand, driver: WebDriver): Promise<void> {
        console.log(`Logging in with username: ${command.username} and password: ${command.password}`);

        await driver.get(LoginService.LOGIN_URL);
        await driver.wait(until.elementLocated(By.xpath(LoginService.ID_ELEMENT_XPATH)), 10000);

        await this.clipboardInputForLogin(driver, LoginService.ID_ELEMENT_XPATH, command.username);
        await this.clipboardInputForLogin(driver, LoginService.PASSWORD_ELEMENT_XPATH, command.password);

        const loginBtn = await driver.wait(until.elementLocated(By.id(LoginService.LOGIN_BUTTON_ELEMENT_XPATH)), 1000);
        await loginBtn.click();
    }


    private async clipboardInputForLogin(driver: WebDriver, xpath: string, text: string): Promise<void> {
        await clipboardy.write(text);
        const el = await driver.wait(until.elementLocated(By.xpath(xpath)), 10000);
        await el.click();
        await el.sendKeys(Key.COMMAND, 'v');
    }
}
