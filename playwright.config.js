// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright Configuration for Lavandaria E2E Testing
 *
 * DEFAULT MODE: HEADED (browser visible) with DevTools open
 * - See browser actions in real-time
 * - Console errors visible immediately
 * - Slowed down for observation
 * - Full artifact collection (screenshots, traces, videos)
 *
 * For CI/headless: Set CI=true environment variable
 */

module.exports = defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.js', // Only match .spec.js files in testDir
    // Maximum time one test can run for
    timeout: 60 * 1000,
    expect: {
        // Maximum time expect() should wait for the condition to be met
        timeout: 10000
    },
    // Run tests in files in parallel
    fullyParallel: false, // Sequential for cleaner logs and easier debugging
    // Fail the build on CI if you accidentally left test.only in the source code
    forbidOnly: !!process.env.CI,
    // Retry on CI only
    retries: process.env.CI ? 2 : 0,
    // Run one test at a time for easier debugging
    workers: 1,
    // Reporter to use
    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['list'],
        ['junit', { outputFile: 'test-results/junit.xml' }]
    ],
    // Shared settings for all the projects below
    use: {
        // Base URL for navigation
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        // Collect trace always for debugging
        trace: 'on',
        // Screenshot always for debugging
        screenshot: 'on',
        // Video always for debugging
        video: 'on',
        // Auto-grant permissions to avoid interactive prompts
        permissions: ['camera', 'geolocation', 'notifications'],
        // Accept downloads automatically
        acceptDownloads: true,
        // Viewport size
        viewport: { width: 1280, height: 720 },
        // Ignore HTTPS errors in development
        ignoreHTTPSErrors: true,
        // Browser context options
        contextOptions: {
            // Grant all permissions by default
            permissions: ['camera', 'geolocation', 'notifications', 'clipboard-read', 'clipboard-write']
        },
        // Timeout for actions
        actionTimeout: 10000,
        navigationTimeout: 10000
    },

    // Configure projects for major browsers
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Run in HEADED mode with DevTools open
                launchOptions: {
                    headless: !!process.env.CI,  // Headed by default, headless in CI
                    devtools: !process.env.CI,   // Open DevTools by default
                    slowMo: process.env.CI ? 0 : 500,  // Slow down by 500ms to watch actions
                    args: [
                        '--use-fake-ui-for-media-stream',
                        '--use-fake-device-for-media-stream',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--auto-open-devtools-for-tabs'
                    ]
                }
            }
        },

        // Uncomment for cross-browser testing
        // {
        //     name: 'firefox',
        //     use: { ...devices['Desktop Firefox'] }
        // },
        //
        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] }
        // },

        // Mobile viewport testing
        // {
        //     name: 'Mobile Chrome',
        //     use: { ...devices['Pixel 5'] }
        // },
        // {
        //     name: 'Mobile Safari',
        //     use: { ...devices['iPhone 12'] }
        // }
    ],

    // Run your local dev server before starting the tests
    // Note: We use Docker Compose for the server, so we reuse the existing server
    webServer: {
        command: 'echo "Using existing Docker server"',
        url: 'http://localhost:3000/api/healthz',
        reuseExistingServer: true, // Always reuse (Docker is already running)
        timeout: 120 * 1000,
        stdout: 'pipe',
        stderr: 'pipe'
    }
});
