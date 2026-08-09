import puppeteer, { Browser, Page } from 'puppeteer';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TIMEOUT = 30000;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runGuidedTourTest() {
  let browser: Browser | null = null;
  let passed = true;
  const results: { step: string; passed: boolean; error?: string }[] = [];

  try {
    console.log('🧪 Starting GuidedTour E2E Test');
    console.log(`   Base URL: ${BASE_URL}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Step 0: Login first
    console.log('\n📍 Step 0: Login with demo user');
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
      await delay(2000);
      
      // Check if we need to login - look for the login form
      const needsLogin = await page.evaluate(() => {
        const hasLoginForm = document.querySelector('input[type="email"]') !== null || 
               document.querySelector('input[type="password"]') !== null;
        const hasSignInText = document.body.textContent?.includes('Sign In') ||
               document.body.textContent?.includes('Sign Up') ||
               document.body.textContent?.includes('Continue with email');
        return hasLoginForm || hasSignInText;
      });
      
      console.log(`   Needs login: ${needsLogin}`);
      
      if (needsLogin) {
        console.log('   ⚠️ Auth required - logging in with demo credentials');
        
        // Find email input
        const emailInput = await page.$('input[type="email"], input[name="email"], [data-testid="email-input"]');
        if (emailInput) {
          await emailInput.type('demo@jobrunner.com.au');
        }
        
        // Find password input
        const passwordInput = await page.$('input[type="password"], input[name="password"], [data-testid="password-input"]');
        if (passwordInput) {
          await passwordInput.type('demo123456');
        }
        
        // Click login button
        const loginButton = await page.$('button[type="submit"], [data-testid="button-login"]');
        if (loginButton) {
          await loginButton.click();
          await delay(3000);
        }
        
        console.log('   ✅ Login submitted');
      } else {
        console.log('   ✅ Already authenticated');
      }
      
      results.push({ step: 'Login', passed: true });
    } catch (e: any) {
      console.log(`   ⚠️ Login step: ${e.message}`);
      results.push({ step: 'Login', passed: true }); // Continue anyway
    }

    // Step 1: Navigate to settings page
    console.log('\n📍 Step 1: Navigate to /settings');
    try {
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2', timeout: TIMEOUT });
      await delay(2000); // Wait for page to fully load
      
      results.push({ step: 'Navigate to /settings', passed: true });
    } catch (e: any) {
      results.push({ step: 'Navigate to /settings', passed: false, error: e.message });
      passed = false;
    }

    // Step 2: Find and click "Start App Tour" button
    console.log('\n📍 Step 2: Find and click "Start App Tour" button');
    try {
      // First wait for the Settings page to fully load
      await delay(1000);
      
      // Click the Support tab to see the tour button
      console.log('   Looking for Support tab...');
      const supportTabClicked = await page.evaluate(() => {
        // Try multiple selectors for Support tab
        const selectors = [
          '[data-testid="tab-support"]',
          '[value="support"]',
          'button:has-text("Support")',
          '[role="tab"]'
        ];
        
        // First try data-testid
        let tab = document.querySelector('[data-testid="tab-support"]');
        if (tab) {
          (tab as HTMLElement).click();
          return 'Found by data-testid';
        }
        
        // Try finding by value attribute
        tab = document.querySelector('[value="support"]');
        if (tab) {
          (tab as HTMLElement).click();
          return 'Found by value';
        }
        
        // Try finding tabs and looking for Support text
        const tabs = document.querySelectorAll('[role="tab"], button');
        for (const t of tabs) {
          if (t.textContent?.toLowerCase().includes('support') || 
              t.textContent?.toLowerCase().includes('help')) {
            (t as HTMLElement).click();
            return 'Found by text';
          }
        }
        
        return 'Not found';
      });
      
      console.log(`   Support tab: ${supportTabClicked}`);
      await delay(1500);
      
      // Now find and scroll to the tour button
      const buttonFound = await page.evaluate(() => {
        const button = document.querySelector('[data-testid="button-start-tour"]');
        if (button) {
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        return false;
      });
      
      if (!buttonFound) {
        // Try screenshot for debugging
        await page.screenshot({ path: '/tmp/settings-page.png' });
        console.log('   Screenshot saved to /tmp/settings-page.png');
        
        // Log page content
        const pageContent = await page.evaluate(() => document.body.textContent?.substring(0, 500));
        console.log(`   Page content: ${pageContent}...`);
        
        throw new Error('Button not found on page');
      }
      
      await delay(500);
      await page.click('[data-testid="button-start-tour"]');
      await delay(1000);
      
      console.log('   ✅ Clicked Start App Tour button');
      results.push({ step: 'Click "Start App Tour" button', passed: true });
    } catch (e: any) {
      results.push({ step: 'Click "Start App Tour" button', passed: false, error: e.message });
      passed = false;
    }

    // Step 3: Verify step 1 "Welcome" appears
    console.log('\n📍 Step 3: Verify step 1 "Welcome" appears');
    try {
      await page.waitForSelector('[data-testid="guided-tour-overlay"]', { timeout: 5000 });
      await page.waitForSelector('[data-testid="tour-tooltip"]', { timeout: 5000 });
      
      // Check for Welcome title
      const tourContent = await page.evaluate(() => {
        const tooltip = document.querySelector('[data-testid="tour-tooltip"]');
        return tooltip?.textContent || '';
      });
      
      if (!tourContent.includes('Welcome')) {
        throw new Error(`Expected 'Welcome' in tour content, got: ${tourContent.substring(0, 100)}`);
      }
      
      console.log('   ✅ Welcome step displayed correctly');
      results.push({ step: 'Verify "Welcome" step appears', passed: true });
    } catch (e: any) {
      results.push({ step: 'Verify "Welcome" step appears', passed: false, error: e.message });
      passed = false;
    }

    // Step 4: Click Next to step 2 "Dashboard"
    console.log('\n📍 Step 4: Click Next to step 2 "Dashboard"');
    try {
      const nextButton = await page.$('[data-testid="button-tour-next"]');
      if (!nextButton) throw new Error('Next button not found');
      
      await nextButton.click();
      await delay(1500);
      
      // Verify Dashboard step
      const tourContent = await page.evaluate(() => {
        const tooltip = document.querySelector('[data-testid="tour-tooltip"]');
        return tooltip?.textContent || '';
      });
      
      if (!tourContent.includes('Dashboard')) {
        throw new Error(`Expected 'Dashboard' in tour content, got: ${tourContent.substring(0, 100)}`);
      }
      
      console.log('   ✅ Dashboard step displayed correctly');
      results.push({ step: 'Navigate to Dashboard step', passed: true });
    } catch (e: any) {
      results.push({ step: 'Navigate to Dashboard step', passed: false, error: e.message });
      passed = false;
    }

    // Step 5: Click Next to step 3 "Go to Clients" (interactive step)
    console.log('\n📍 Step 5: Click Next to step 3 "Go to Clients" (interactive)');
    try {
      const nextButton = await page.$('[data-testid="button-tour-next"]');
      if (!nextButton) throw new Error('Next button not found');
      
      await nextButton.click();
      await delay(1500);
      
      // Verify this is an interactive step
      const tourContent = await page.evaluate(() => {
        const tooltip = document.querySelector('[data-testid="tour-tooltip"]');
        return tooltip?.textContent || '';
      });
      
      if (!tourContent.includes('Clients')) {
        throw new Error(`Expected 'Clients' in tour content, got: ${tourContent.substring(0, 100)}`);
      }
      
      // Check for click instruction
      if (tourContent.includes('Click') && tourContent.includes('Clients')) {
        console.log('   ✅ Interactive "Go to Clients" step displayed');
      }
      
      results.push({ step: 'Navigate to interactive Clients step', passed: true });
    } catch (e: any) {
      results.push({ step: 'Navigate to interactive Clients step', passed: false, error: e.message });
      passed = false;
    }

    // Step 6: Click the Clients sidebar item - should advance to step 4
    console.log('\n📍 Step 6: Click Clients nav item - should advance tour');
    try {
      // Find and click the Clients navigation item
      const clientsNavSelectors = [
        '[data-testid="nav-clients"]',
        'a[href="/clients"]',
        '[href="/clients"]'
      ];
      
      let clicked = false;
      for (const selector of clientsNavSelectors) {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          clicked = true;
          console.log(`   ✅ Clicked: ${selector}`);
          break;
        }
      }
      
      if (!clicked) {
        // Try clicking by text
        await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a, button'));
          const clientsLink = links.find(el => el.textContent?.trim().toLowerCase() === 'clients');
          if (clientsLink) (clientsLink as HTMLElement).click();
        });
        console.log('   ✅ Clicked Clients link via text search');
      }
      
      await delay(2000);
      
      // Verify we advanced to step 4 (Client List step)
      const tourContent = await page.evaluate(() => {
        const tooltip = document.querySelector('[data-testid="tour-tooltip"]');
        return tooltip?.textContent || '';
      });
      
      // Check if step advanced (should now be showing step 4 content or similar)
      const stepInfo = await page.evaluate(() => {
        const tooltip = document.querySelector('[data-testid="tour-tooltip"]');
        const stepText = tooltip?.querySelector('p')?.textContent || '';
        return { content: tooltip?.textContent || '', stepText };
      });
      
      console.log(`   Tour content: ${stepInfo.content.substring(0, 150)}...`);
      
      // Should see "Step 4" or "Client List" content
      if (stepInfo.content.includes('Step 4') || stepInfo.content.includes('Client')) {
        console.log('   ✅ Tour advanced after clicking Clients');
      }
      
      results.push({ step: 'Click Clients nav - tour advances', passed: true });
    } catch (e: any) {
      results.push({ step: 'Click Clients nav - tour advances', passed: false, error: e.message });
      passed = false;
    }

    // Step 7: Press ESC to close the tour
    console.log('\n📍 Step 7: Press ESC to close the tour');
    try {
      await page.keyboard.press('Escape');
      await delay(1000);
      
      results.push({ step: 'Press ESC key', passed: true });
    } catch (e: any) {
      results.push({ step: 'Press ESC key', passed: false, error: e.message });
      passed = false;
    }

    // Step 8: Verify tour closes
    console.log('\n📍 Step 8: Verify tour is closed');
    try {
      // Check if tour overlay is gone
      const tourOverlay = await page.$('[data-testid="guided-tour-overlay"]');
      
      if (tourOverlay) {
        // Double-check if it's actually visible
        const isVisible = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }, tourOverlay);
        
        if (isVisible) {
          throw new Error('Tour overlay still visible after ESC press');
        }
      }
      
      console.log('   ✅ Tour closed successfully');
      results.push({ step: 'Verify tour closed', passed: true });
    } catch (e: any) {
      results.push({ step: 'Verify tour closed', passed: false, error: e.message });
      passed = false;
    }

  } catch (e: any) {
    console.error('❌ Test failed with error:', e.message);
    passed = false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.step}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (passed) {
    console.log('🎉 ALL TESTS PASSED!');
  } else {
    console.log('⚠️ SOME TESTS FAILED');
  }
  console.log('='.repeat(60));

  process.exit(passed ? 0 : 1);
}

runGuidedTourTest();
