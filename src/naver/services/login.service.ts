import { Injectable } from '@nestjs/common';
import { WebDriver, By, until, Key } from 'selenium-webdriver';
const { copy } = require('copy-paste/promises');
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

    // Wait for page to fully load including JavaScript
    await this.waitForPageLoad(driver);

    // Wait for form elements to be ready
    await this.waitForElementReady(driver, LoginService.ID_XPATH);

    await this.clipboardInput(driver, LoginService.ID_XPATH, loginDto.username);
    await this.clipboardInput(driver, LoginService.PW_XPATH, loginDto.password);

    // Ensure login button is fully ready before clicking
    await this.clickLoginButton(driver);

    await this.skipDeviceRegistration(driver);

    // Wait for login to fully complete and page to stabilize
    await driver.sleep(2000);

    this.logger.info('LoginService', 'Login completed successfully');
  }

  private async waitForPageLoad(driver: WebDriver): Promise<void> {
    await driver.wait(
      async () => {
        const readyState = await driver.executeScript('return document.readyState');
        return readyState === 'complete';
      },
      15000,
      'Page did not finish loading'
    );

    // Additional wait for dynamic content initialization
    await driver.sleep(2000);
    this.logger.debug('LoginService', 'Page fully loaded');
  }

  private async waitForElementReady(driver: WebDriver, xpath: string): Promise<void> {
    const element = await driver.wait(
      until.elementLocated(By.xpath(xpath)),
      10000,
      `Element not found: ${xpath}`
    );

    await driver.wait(
      until.elementIsVisible(element),
      5000,
      `Element not visible: ${xpath}`
    );

    // Wait for element to be enabled and clickable
    await driver.wait(
      async () => {
        const isEnabled = await element.isEnabled();
        const isDisplayed = await element.isDisplayed();
        return isEnabled && isDisplayed;
      },
      5000,
      `Element not clickable: ${xpath}`
    );
  }

  private async clipboardInput(
    driver: WebDriver,
    xpath: string,
    text: string
  ): Promise<void> {
    const el = await driver.wait(until.elementLocated(By.xpath(xpath)), 10000);

    // Wait for element to be interactive
    await driver.wait(until.elementIsVisible(el), 5000);
    await driver.wait(
      async () => {
        const isEnabled = await el.isEnabled();
        const isDisplayed = await el.isDisplayed();
        return isEnabled && isDisplayed;
      },
      5000,
      `Element not ready for input: ${xpath}`
    );

    await el.click();

    // Small delay before paste to ensure element is focused
    await driver.sleep(300);

    await copy(text);
    const pasteKey = process.platform === 'darwin' ? Key.COMMAND : Key.CONTROL;
    const pasteChord = Key.chord(pasteKey, 'v');
    await el.sendKeys(pasteChord);

    // Give time for paste operation and Naver's validation handlers
    await driver.sleep(800);

    // Optional: Verify paste succeeded (with longer content check)
    try {
      const value = await el.getAttribute('value');
      if (value && value.length > 0) {
        this.logger.debug('LoginService', `Input successful for ${xpath}, length: ${value.length}`);
      }
    } catch (error) {
      this.logger.warn('LoginService', `Could not verify input for ${xpath}`);
    }
  }

  private async clickLoginButton(driver: WebDriver): Promise<void> {
    const loginBtn = await driver.wait(
      until.elementLocated(By.id(LoginService.LOGIN_BUTTON_ID)),
      10000,
      'Login button not found'
    );

    // Wait for button to be visible and clickable
    await driver.wait(until.elementIsVisible(loginBtn), 5000);
    await driver.wait(
      async () => {
        const isEnabled = await loginBtn.isEnabled();
        const isDisplayed = await loginBtn.isDisplayed();
        return isEnabled && isDisplayed;
      },
      5000,
      'Login button not clickable'
    );

    // Additional wait for Naver's form validation JS
    await driver.sleep(1000);

    // Verify button is enabled (form validation passed)
    const isEnabled = await loginBtn.isEnabled();
    if (!isEnabled) {
      throw new Error('Login button is disabled - form validation failed');
    }

    await loginBtn.click();
    this.logger.debug('LoginService', 'Login button clicked');
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
