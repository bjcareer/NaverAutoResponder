import { Injectable } from '@nestjs/common';
import { Page } from 'puppeteer-core';
import { LoggerService } from '../../shared/services/logger.service';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginService {
  private static readonly LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
  private static readonly ID_SELECTOR = '#id';
  private static readonly PW_SELECTOR = '#pw';
  private static readonly LOGIN_BUTTON_SELECTOR = '#log\\.login';

  constructor(private readonly logger: LoggerService) {}

  async login(loginDto: LoginDto, page: Page): Promise<void> {
    this.logger.info('LoginService', 'Starting Naver login', {
      username: loginDto.username,
    });

    await page.goto(LoginService.LOGIN_URL, { waitUntil: 'networkidle2' });

    // Wait for page to fully load
    await this.waitForPageLoad(page);

    // Type credentials directly (Puppeteer handles this better than clipboard in Lambda)
    await this.typeInput(page, LoginService.ID_SELECTOR, loginDto.username);
    await this.typeInput(page, LoginService.PW_SELECTOR, loginDto.password);

    // Click login button
    await this.clickLoginButton(page);

    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
      // Navigation might not always trigger, continue anyway
      this.logger.debug('LoginService', 'No navigation after login, continuing');
    });

    // Handle device registration popup
    await this.skipDeviceRegistration(page);

    // Wait for login to fully complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    this.logger.info('LoginService', 'Login completed successfully');
  }

  private async waitForPageLoad(page: Page): Promise<void> {
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: 15000 }
    );

    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.logger.debug('LoginService', 'Page fully loaded');
  }

  private async typeInput(page: Page, selector: string, text: string): Promise<void> {
    // Wait for element to be ready
    await page.waitForSelector(selector, { visible: true, timeout: 10000 });

    // Click to focus
    await page.click(selector);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Clear existing value
    await page.evaluate((sel) => {
      const element = document.querySelector(sel) as HTMLInputElement;
      if (element) {
        element.value = '';
      }
    }, selector);

    // Type the text with delays to simulate human typing
    await page.type(selector, text, { delay: 100 });

    // Wait for Naver's validation handlers
    await new Promise(resolve => setTimeout(resolve, 800));

    // Verify input
    const value = await page.$eval(selector, (el) => (el as HTMLInputElement).value);
    if (value && typeof value === 'string' && value.length > 0) {
      this.logger.debug('LoginService', `Input successful for ${selector}, length: ${value.length}`);
    } else {
      this.logger.warn('LoginService', `Input may have failed for ${selector}`);
    }
  }

  private async clickLoginButton(page: Page): Promise<void> {
    // Wait for button to be visible and enabled
    await page.waitForSelector(LoginService.LOGIN_BUTTON_SELECTOR, {
      visible: true,
      timeout: 10000,
    });

    // Additional wait for Naver's form validation JS
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if button is enabled
    const isDisabled = await page.$eval(
      LoginService.LOGIN_BUTTON_SELECTOR,
      (el) => (el as HTMLButtonElement).disabled
    );

    if (isDisabled) {
      throw new Error('Login button is disabled - form validation failed');
    }

    // Click the button
    await page.click(LoginService.LOGIN_BUTTON_SELECTOR);
    this.logger.debug('LoginService', 'Login button clicked');
  }

  private async skipDeviceRegistration(page: Page): Promise<void> {
    try {
      const dontSaveBtn = await page.waitForSelector('#new\\.dontsave', {
        visible: true,
        timeout: 10000,
      });

      if (dontSaveBtn) {
        await dontSaveBtn.click();
        this.logger.info('LoginService', 'Device registration skipped');
      }
    } catch (e) {
      this.logger.warn('LoginService', 'No device registration button found');
    }
  }
}
