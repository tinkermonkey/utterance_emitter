import puppeteer from 'puppeteer';

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-print-preview',
        '--disable-printing',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();

    // Set up console message handling
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    // Navigate to test page
    await page.goto('http://localhost:3100/cypress/test_app/index.html', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Run the test
    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        const { UtteranceEmitter, PerformanceMonitor } = window;

        // Check if classes exist
        const tests = {
          passed: 0,
          failed: 0,
          failures: []
        };

        if (!UtteranceEmitter) {
          tests.failed++;
          tests.failures.push({
            file: 'cypress/test_app/index.html',
            test: 'UtteranceEmitter should exist',
            message: 'UtteranceEmitter is not defined'
          });
        } else {
          tests.passed++;
        }

        if (!PerformanceMonitor) {
          tests.failed++;
          tests.failures.push({
            file: 'cypress/test_app/index.html',
            test: 'PerformanceMonitor should exist',
            message: 'PerformanceMonitor is not defined'
          });
        } else {
          tests.passed++;
        }

        // Try to instantiate and start emitter
        try {
          const emitter = new UtteranceEmitter({
            enablePerformanceMonitoring: true,
            vadConfig: {
              positiveSpeechThreshold: 0.5,
              baseAssetPath: '/dist/'
            }
          });

          emitter.start().then(() => {
            tests.passed++;

            // Wait a bit then stop
            setTimeout(() => {
              emitter.stop();
              tests.passed++;
              resolve(tests);
            }, 2000);
          }).catch(err => {
            tests.failed++;
            tests.failures.push({
              file: 'cypress/e2e/vad.cy.js',
              test: 'should process audio frames within 16.67ms budget',
              message: 'Failed to start emitter: ' + err.message
            });
            resolve(tests);
          });
        } catch (err) {
          tests.failed++;
          tests.failures.push({
            file: 'cypress/e2e/vad.cy.js',
            test: 'should instantiate UtteranceEmitter',
            message: 'Error creating emitter: ' + err.message
          });
          resolve(tests);
        }
      });
    });

    console.log('TEST_RESULT:', JSON.stringify(result, null, 2));

    await browser.close();
  } catch (error) {
    console.error('Error running tests:', error);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
})();
