import {LoginCommand} from "../in/loginCommand";
import clipboardy from 'clipboardy';
import {By, Key, until, WebDriver} from 'selenium-webdriver';
import * as os from "node:os";

export class Login {
    public static readonly LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
    public static readonly ID_ELEMENT_XPATH = '//*[@id="id"]';
    public static readonly PASSWORD_ELEMENT_XPATH = '//*[@id="pw"]';
    public static readonly LOGIN_BUTTON_ELEMENT_XPATH = 'log.login';

    constructor() {
    }


    async login(command: LoginCommand, driver: WebDriver): Promise<void> {
        console.log(`Logging in with username: ${command.username} and password: ${command.password}`);

        await driver.get(Login.LOGIN_URL);
        await driver.wait(until.elementLocated(By.xpath(Login.ID_ELEMENT_XPATH)), 10000);

        await this.clipboardInputForLogin(driver, Login.ID_ELEMENT_XPATH, command.username);
        await this.clipboardInputForLogin(driver, Login.PASSWORD_ELEMENT_XPATH, command.password);

        const loginBtn = await driver.wait(until.elementLocated(By.id(Login.LOGIN_BUTTON_ELEMENT_XPATH)), 1000);
        await loginBtn.click();
    }


    private async clipboardInputForLogin(driver: WebDriver, xpath: string, text: string): Promise<void> {
        await clipboardy.write(text);
        const el = await driver.wait(until.elementLocated(By.xpath(xpath)), 10000);
        await el.click();
        const pasteKey = os.platform() === 'darwin' ? Key.COMMAND : Key.CONTROL;
        await el.sendKeys(pasteKey, 'v');
    }
}
