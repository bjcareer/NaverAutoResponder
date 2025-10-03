import { Injectable } from '@nestjs/common';
import { WebDriver, By, until, Key } from 'selenium-webdriver';
import clipboardy from 'clipboardy';
import { LoggerService } from '@shared/services/logger.service';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginService {
  private static readonly LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
  private static readonly ID_XPATH = '//*[@id="id"]';
  private static readonly PW_XPATH = '//*[@id="pw"]';
  private static readonly LOGIN_BUTTON_ID = 'log.login';

  constructor(private readonly logger: LoggerService) {}

  async login(loginDto: LoginDto, driver: WebDriver): Promise<void> {
    this.logger.info('LoginService', 'Starting Naver login', {
      username: loginDto.username,
    });

    await driver.get(LoginService.LOGIN_URL);
    await driver.wait(until.elementLocated(By.xpath(LoginService.ID_XPATH)), 10000);

    await this.clipboardInput(driver, LoginService.ID_XPATH, loginDto.username);
    await this.clipboardInput(driver, LoginService.PW_XPATH, loginDto.password);

    const loginBtn = await driver.wait(
      until.elementLocated(By.id(LoginService.LOGIN_BUTTON_ID)),
      10000
    );
    await loginBtn.click();

    await this.skipDeviceRegistration(driver);

    this.logger.info('LoginService', 'Login completed successfully');
  }

  private async clipboardInput(
    driver: WebDriver,
    xpath: string,
    text: string
  ): Promise<void> {
    const el = await driver.wait(until.elementLocated(By.xpath(xpath)), 10000);
    await el.click();
    await clipboardy.writeSync(text);
    const pasteKey = process.platform === 'darwin' ? Key.COMMAND : Key.CONTROL;
    const pasteChord = Key.chord(pasteKey, 'v');
    await el.sendKeys(pasteChord);
  }

  private async skipDeviceRegistration(driver: WebDriver): Promise<void> {
    try {
      const dontSaveBtn = await driver.wait(
        until.elementLocated(By.id('new.dontsave')),
        10000
      );
      await driver.wait(until.elementIsVisible(dontSaveBtn), 5000);
      await dontSaveBtn.click();
      this.logger.info('LoginService', 'Device registration skipped');
    } catch (e) {
      this.logger.warn('LoginService', 'No device registration button found');
    }
  }
}
