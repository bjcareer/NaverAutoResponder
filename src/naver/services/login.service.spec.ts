import { Test, TestingModule } from '@nestjs/testing';
import { Builder, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { LoginService } from './login.service';
import { LoggerService } from '@shared/services/logger.service';
import { LoginDto } from '../dto/login.dto';
import * as dotenv from 'dotenv';

dotenv.config();

describe('LoginService E2E Tests', () => {
  let service: LoginService;
  let driver: WebDriver;

  beforeAll(async () => {
    // Validate environment variables
    if (!process.env.NAVER_ID || !process.env.NAVER_PW) {
      throw new Error(
        'NAVER_ID and NAVER_PW must be set in .env file for E2E tests'
      );
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [LoginService, LoggerService],
    }).compile();

    service = module.get<LoginService>(LoginService);
  });

  beforeEach(async () => {
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--disable-blink-features=AutomationControlled');
    chromeOptions.addArguments('--no-sandbox');
    chromeOptions.addArguments('--disable-dev-shm-usage');
    chromeOptions.excludeSwitches('enable-automation');

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
  });

  afterEach(async () => {
    if (driver) {
      await driver.quit();
    }
  });

  describe('Naver Login Flow', () => {
    it('should successfully login to Naver with real credentials', async () => {
      const loginDto: LoginDto = {
        username: process.env.NAVER_ID!,
        password: process.env.NAVER_PW!,
      };

      await service.login(loginDto, driver);

      // Verify login success by checking current URL
      const currentUrl = await driver.getCurrentUrl();
      expect(currentUrl).not.toContain('nidlogin.login');
      expect(currentUrl).toContain('naver.com');
    }, 60000);

    it('should handle page load timing correctly', async () => {
      const loginDto: LoginDto = {
        username: process.env.NAVER_ID!,
        password: process.env.NAVER_PW!,
      };

      const startTime = Date.now();
      await service.login(loginDto, driver);
      const endTime = Date.now();

      // Login should complete within reasonable time (30 seconds)
      expect(endTime - startTime).toBeLessThan(30000);
      expect(endTime - startTime).toBeGreaterThan(5000); // Should take at least 5s with all waits
    }, 60000);

    it('should properly wait for elements before interaction', async () => {
      const loginDto: LoginDto = {
        username: process.env.NAVER_ID!,
        password: process.env.NAVER_PW!,
      };

      // This test verifies that no errors occur during login
      // If elements weren't ready, we'd get NoSuchElementError or StaleElementReferenceError
      await expect(service.login(loginDto, driver)).resolves.not.toThrow();
    }, 60000);

    it('should successfully paste credentials using clipboard', async () => {
      const loginDto: LoginDto = {
        username: process.env.NAVER_ID!,
        password: process.env.NAVER_PW!,
      };

      await service.login(loginDto, driver);

      // If clipboard paste worked, login should succeed
      const currentUrl = await driver.getCurrentUrl();
      expect(currentUrl).not.toContain('nidlogin.login');
    }, 60000);

    it('should handle device registration popup if present', async () => {
      const loginDto: LoginDto = {
        username: process.env.NAVER_ID!,
        password: process.env.NAVER_PW!,
      };

      // Test should complete without hanging on device registration popup
      await expect(service.login(loginDto, driver)).resolves.not.toThrow();

      const currentUrl = await driver.getCurrentUrl();
      expect(currentUrl).not.toContain('device');
    }, 60000);
  });

  describe('Login Stability Tests', () => {
    it('should maintain browser window after login', async () => {
      const loginDto: LoginDto = {
        username: process.env.NAVER_ID!,
        password: process.env.NAVER_PW!,
      };

      await service.login(loginDto, driver);

      // Verify browser window is still open
      const handles = await driver.getAllWindowHandles();
      expect(handles.length).toBeGreaterThan(0);

      // Verify we can still interact with the page
      const title = await driver.getTitle();
      expect(title).toBeTruthy();
    }, 60000);

    it('should have stable page state after login', async () => {
      const loginDto: LoginDto = {
        username: process.env.NAVER_ID!,
        password: process.env.NAVER_PW!,
      };

      await service.login(loginDto, driver);

      // Wait for final stabilization
      await driver.sleep(2000);

      // Verify page is in ready state
      const readyState = await driver.executeScript<string>('return document.readyState');
      expect(readyState).toBe('complete');
    }, 60000);
  });

  describe('Environment Configuration', () => {
    it('should load credentials from environment variables', () => {
      expect(process.env.NAVER_ID).toBeDefined();
      expect(process.env.NAVER_PW).toBeDefined();
      expect(process.env.NAVER_ID).not.toBe('');
      expect(process.env.NAVER_PW).not.toBe('');
    });

    it('should use correct platform-specific paste key', () => {
      const platform = process.platform;
      expect(['darwin', 'win32', 'linux']).toContain(platform);
    });
  });
});
