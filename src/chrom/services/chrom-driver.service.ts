import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Builder, ThenableWebDriver, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { LoggerService } from '@shared/services/logger.service';

@Injectable()
export class ChromDriverService implements OnModuleDestroy {
  private driver: WebDriver | null = null;
  private chromeOptions: chrome.Options;

  constructor(private readonly logger: LoggerService) {
    this.chromeOptions = new chrome.Options();
    this.chromeOptions.addArguments('--disable-blink-features=AutomationControlled');
    this.chromeOptions.addArguments('--no-sandbox');
    this.chromeOptions.addArguments('--disable-dev-shm-usage');
    this.chromeOptions.excludeSwitches('enable-automation');
  }

  async createDriver(): Promise<ThenableWebDriver> {
    if (this.driver) {
      return this.driver as ThenableWebDriver;
    }

    this.logger.info('ChromDriverService', 'Creating Chrome WebDriver');

    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(this.chromeOptions)
      .build();

    return this.driver as ThenableWebDriver;
  }

  async getDriver(): Promise<WebDriver> {
    if (!this.driver) {
      return this.createDriver();
    }
    return this.driver;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.driver) {
      this.logger.info('ChromDriverService', 'Closing WebDriver');
      await this.driver.quit();
      this.driver = null;
    }
  }
}
