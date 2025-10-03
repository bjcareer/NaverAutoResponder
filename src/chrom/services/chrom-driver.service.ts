import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Browser, Page } from 'puppeteer-core';
import puppeteerCore from 'puppeteer-core';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import { LoggerService } from '@shared/services/logger.service';

@Injectable()
export class ChromDriverService implements OnModuleDestroy {
  private browser: Browser | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService
  ) {}

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    this.logger.info('ChromDriverService', 'Creating Puppeteer Browser');

    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    const headless = this.configService.get<string>('HEADLESS', 'true') === 'true';

    if (isLambda) {
      // Lambda environment with puppeteer-core
      this.browser = await puppeteerCore.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true, // Always headless in Lambda
      });
    } else {
      // Local development environment with full puppeteer
      this.logger.info('ChromDriverService', `Launching browser with headless=${headless}`);
      this.browser = await puppeteer.launch({
        headless: headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
    }

    this.logger.info('ChromDriverService', 'Browser created successfully');
    return this.browser;
  }

  async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    return page;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      this.logger.info('ChromDriverService', 'Closing Browser');
      await this.browser.close();
      this.browser = null;
    }
  }
}
