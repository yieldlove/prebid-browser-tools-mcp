/*
  Requires node 20+ to run
  Must be run with a non eu ip address, since consent must be clicked for eu ip addresses

  Run examples: 
  node main.mjs --domains "mathebibel.de,infranken.de" --sendLogsToServer true --assertIdSystems true --wipeUserData true --headless false
  node main.mjs  // uses execution-config.json when no arguments are provided

  Config - Refers to wrapper config
 */

import { chromium } from 'playwright';
import fs from 'fs';
import yargs from 'yargs';
import { canParseExecutionConfig, canParseWebsiteDomains, getUserIdsFromChromeConsole, getYLSiteName, setupEventListeners } from './utils/helper.mjs';
import { testIdSystemIntegration } from './modules/quality-tests/idSystemTest.mjs';
import { isTCF2Denied } from './modules/quality-tests/tcf2.mjs';
import { clickConsentManager } from './consent/crawl.js';

const logs = {};
const results = {}

const argv = yargs(process.argv.slice(2)).argv;

// If no arguments are provided, use execution-config.json
const canUseExeConfig = Object.keys(argv).length <= 2
const exeConfig = canUseExeConfig && canParseExecutionConfig()
if (canUseExeConfig && !exeConfig) process.exit('No execution config found. Create a execution-config.json file in the root directory or run file with documented arguments'); else console.log('Using the execution config')


const save = (browser) => {
  const canClearLogs = canUseExeConfig ? exeConfig.preserveLogs === false : argv.preserveLogs === false
  if (canClearLogs) fs.rmSync('./logs/temp', { recursive: true, force: true });
  fs.mkdirSync('./logs/temp', { recursive: true });

  const date = new Date().toISOString().split('.')[0]
  const logPath = `./logs/temp/${date}-${browser}-logs.json`

  fs.writeFileSync(logPath, JSON.stringify({ runResult: results, siteLogs: logs }, null, 2));
  console.log(`Logs saved to ${logPath}\n`);
}



(async () => {
  const domains = (argv.length && canParseWebsiteDomains(argv.domains ?? [])) || exeConfig?.domains
  if (!Array.isArray(domains) || !domains.length) return console.error(`ERROR: Failed to parse website domains, please provide an array of website domains in a JSON format '["url1", "url2", "url3"]'`)

  const sendLogsToServer = canUseExeConfig ? exeConfig?.sendLogsToServer : argv.sendLogsToServer
  const testIdSystems = canUseExeConfig ? exeConfig?.testIdSystems : argv.assertIdSystems
  const testTCF2 = canUseExeConfig ? exeConfig?.testTCF2 : argv.testTCF2
  const headless = canUseExeConfig ? exeConfig?.headless : argv.headless
  const wipeBrowserUserData = canUseExeConfig ? exeConfig?.wipeBrowserUserData : argv.wipeUserData
  const gdprApplies = canUseExeConfig ? exeConfig?.gdprApplies : argv.gdprApplies


  if (wipeBrowserUserData) {
    fs.rmSync('./browser-data', { recursive: true, force: true });
    console.log('Browser user data wiped')
  }


  const context = await chromium.launchPersistentContext('./browser-data', {
    channel: 'chrome',
    headless: headless,
    args: ['--enable-logging=stderr', '--v=1', '--load-extension=./chrome-extension'], // Chrome logging flags (stderr)
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
  });

  for (const [index, domain] of domains.entries()) {
    console.log('═'.repeat(60));
    console.log(`\n🔄 Testing ${domain} (${index + 1}/${domains.length})`)

    // Initialize results
    results[domain] = { initError: null, failedTests: [], success: false }
    const { failedTests } = results[domain]
    // Initialize site logs
    const currentSiteLogs = {
      logs: [],
      errors: [],
      requestsFailed: [],
      warnings: []
    }

    // Setup event listeners
    const page = await context.newPage();
    setupEventListeners(page, currentSiteLogs)

    try {
      // Navigation with error handling
      await page.goto(`https://${domain}?yldebug=true`, {
        waitUntil: 'networkidle',
        timeout: 15000
      });

      await page.waitForTimeout((Math.random() * 4000) + 31000)
      const consentResult = gdprApplies ? await clickConsentManager(page) : console.log('GDPR does not apply')
      if (consentResult.status === 'clicked') {
        console.log('Consent accepted');
        await page.waitForTimeout(3000)
      }
      else {
        //TODO: Check if consent was already accepted
        console.warn('Failed to accept consent or consent was already accepted', { consentResult })
      }

    } catch (error) {
      console.error(`${domain.toUpperCase()} Navigation failed:`, error.message)
      results[domain].initError = 'Failed to navigate to site'
      await page.close()
      continue
    }

    // Yieldlove specific naming for the site's domain
    let ylSiteName
    try {
      ylSiteName = await getYLSiteName(page)
      if (typeof ylSiteName !== 'string') {
        console.error(`${domain.toUpperCase()} Failed to get site name from wrapper config: ${JSON.stringify(ylSiteName)}`)
        results[domain].initError = 'Failed to get site name from wrapper config'
        await page.close()
        continue
      }
    } catch (error) {
      console.error(`${domain.toUpperCase()} Error getting site name:`, error.message)
      results[domain].initError = 'Error getting site name'
      await page.close()
      continue
    }

    if (sendLogsToServer) {
      //TODO
    }

    //Test cases
    if (testTCF2) {
      console.log('\n\x1b[34m--------TCF2 TEST--------\x1b[0m\n')
      const isDenied = isTCF2Denied(currentSiteLogs.logs.map(log => log.text));
      isDenied && failedTests.push('TCF2')
    }

    if (testIdSystems) {
      console.log('\n\x1b[34m--------ID SYSTEM INTEGRATION TEST-------\x1b[0m\n')
      const chromeConsoleKeyValues = await getUserIdsFromChromeConsole(page)
      const isExpectedKeys = Object.keys(chromeConsoleKeyValues).every(key => ['wrapperConfigIdSystems', 'pbjsUserIds'].includes(key))

      if (isExpectedKeys) {
        Object.assign(currentSiteLogs, chromeConsoleKeyValues)

        const isIdSystemIntegration = testIdSystemIntegration(currentSiteLogs, currentSiteLogs.logs, domain)
        !isIdSystemIntegration && failedTests.push('ID SYSTEMS')
      } else {
        currentSiteLogs.pbjsUserIds = 'user ids not found'
        currentSiteLogs.wrapperConfigIdSystems = 'id systems in wrapper config not found'

        console.error(domain.toUpperCase(), ' [QT][ID SYSTEMS] Failed to assert proper enablement of id systems, expected keys were not found:')
        console.log({ expectedKeys: 'wrapperConfigIdSystems,pbjsUserIds', actualKeys: Object.keys(chromeConsoleKeyValues).sort().join(',') })
        failedTests.push('ID SYSTEMS')
      }
    }


    results[domain].success = failedTests.length === 0
    results[domain].failedTests = failedTests

    logs[ylSiteName] = currentSiteLogs
    await page.close()
  }

  // save('chrome');
  await context.close();

  // Professional results summary
  reportSummary();

  console.log('═'.repeat(60))
})();





function reportSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('🔍 YIELDLOVE QUALITY ASSURANCE REPORT');
  console.log('═'.repeat(60));
  console.log(`📅 Test Date: ${new Date().toLocaleString()}`);
  console.log(`🌐 Domains Tested: ${Object.keys(results).length}`);
  console.log('═'.repeat(60));

  const successful = Object.values(results).filter(r => r.success).length;
  const failed = Object.keys(results).length - successful;

  // Summary stats
  console.log(`✅ Passed: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('─'.repeat(60));

  // Detailed results
  Object.keys(results).forEach(domain => {
    const result = results[domain];
    const status = result.success ? '\x1b[32m✅ PASS\x1b[0m' : '\x1b[31m❌ FAIL\x1b[0m';
    console.log(`${domain.padEnd(25)} ${status}`);

    if (!result.success && result.failedTests.length > 0) {
      console.log(`   └─ Failed tests: ${result.failedTests.join(', ')}`);
    }
    if (!result.success && result.initError) {
      console.log(`   └─ Initialization error: ${result.initError}`);
    }
  });

  console.log('═'.repeat(60));

  if (failed === 0) {
    console.log('\x1b[32m🎉 All tests passed! Quality requirements met.\x1b[0m');
  } else {
    console.log(`\x1b[33m⚠️  ${failed} domain(s) require attention.\x1b[0m`);
  }
}
// Other todo: create a specific batch of logs for AI to analyze when e.g. something unexepcted occurs.




