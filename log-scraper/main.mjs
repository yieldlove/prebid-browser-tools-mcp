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

const argv = yargs(process.argv.slice(2)).argv;

// If no arguments are provided, use execution-config.json
const canUseExeConfig = Object.keys(argv).length <= 2
const exeConfig = canUseExeConfig && canParseExecutionConfig()
if (canUseExeConfig && !exeConfig) process.exit('No execution config found. Create a execution-config.json file in the root directory or run file with documented arguments'); else console.log('Using the execution config')


  const save = (logs,browser) => {
    const canClearLogs = canUseExeConfig ? exeConfig.preserveLogs === false : argv.preserveLogs === false 
    if(canClearLogs) fs.rmSync('./logs/temp', { recursive: true, force: true });
    fs.mkdirSync('./logs/temp', { recursive: true });
    
    const date = new Date().toISOString().split('.')[0]
    const logPath = `./logs/temp/${date}-${browser}-logs.json`

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    console.log(`Logs saved to ${logPath}`);
}

const logs = {};

(async () => {
  const domains = (argv.length && canParseWebsiteDomains(argv.domains ?? [])) || exeConfig?.domains
  if (!Array.isArray(domains) || !domains.length) return console.error(`ERROR: Failed to parse website domains, please provide an array of website domains in a JSON format '["url1", "url2", "url3"]'`)

  const sendLogsToServer = canUseExeConfig ? exeConfig?.sendLogsToServer : argv.sendLogsToServer
  const testIdSystems = canUseExeConfig ? exeConfig?.testIdSystems : argv.assertIdSystems
  const headless = canUseExeConfig ? exeConfig?.headless :argv.headless
  const wipeBrowserUserData = canUseExeConfig ? exeConfig?.wipeBrowserUserData : argv.wipeUserData


  if (wipeBrowserUserData) {
    fs.rmSync('./browser-data', { recursive: true, force: true });
    console.log('Browser user data wiped')
  }
  

  const context = await chromium.launchPersistentContext('./browser-data', {
    channel: 'chrome',          // use real Chrome (optional)
    headless: headless,
    args: ['--enable-logging=stderr', '--v=1', '--load-extension=./chrome-extension'], // Chrome logging flags (stderr)
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
  });

  for (const [index, domain] of domains.entries()) {
    console.log(`Processing domain: ${domain} (${index + 1} of ${domains.length})\n`)
    const page = await context.newPage();
    
    const currentSiteLogs = {
      logs: [],
      errors: [],
      requestsFailed: [],
      warnings: [],
      testCasesFailed: []
    }
    
    // Setup event listeners
    setupEventListeners(page, currentSiteLogs)
    
    // Navigation with error handling
    try {
      await page.goto(`https://${domain}?yldebug=true`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      
      await page.waitForTimeout(5000)
      
    } catch (error) {
      console.error(`${domain.toUpperCase()} Navigation failed:`, error.message)
      await page.close()
      continue
    }
    
    // Yieldlove specific naming for the site's domain
    let ylSiteName
    try {
      ylSiteName = await getYLSiteName(page)
      if (typeof ylSiteName !== 'string') {
        console.error(`${domain.toUpperCase()} Failed to get site name from wrapper config: ${JSON.stringify(ylSiteName)}`)
        await page.close()
        continue
      }
    } catch (error) {
      console.error(`${domain.toUpperCase()} Error getting site name:`, error.message)
      await page.close()
      continue
    }
    
      
      //Modules and test cases
      
      if (sendLogsToServer) {
        //TODO
      }
      
      if (testIdSystems) {
        const chromeConsoleKeyValues = await getUserIdsFromChromeConsole(page)
        const isExpectedKeys = Object.keys(chromeConsoleKeyValues).every(key => ['wrapperConfigIdSystems', 'pbjsUserIds'].includes(key))
        
        if (isExpectedKeys) {
          Object.assign(currentSiteLogs, chromeConsoleKeyValues)
          testIdSystemIntegration(currentSiteLogs, currentSiteLogs.logs, domain)
        } else {
          currentSiteLogs.pbjsUserIds = 'user ids not found'
          currentSiteLogs.wrapperConfigIdSystems = 'id systems in wrapper config not found'
          
          console.error(domain.toUpperCase(), ' [QT][ID SYSTEMS] Failed to assert proper enablement of id systems, expected keys were not found:')
          console.log({expectedKeys: 'wrapperConfigIdSystems,pbjsUserIds', actualKeys: Object.keys(chromeConsoleKeyValues).sort().join(',')})
        }
      }
      
      logs[ylSiteName] = currentSiteLogs
      
      await page.close()
    }
  save(logs, 'chrome');
  await context.close();

  console.log('Websites with problems')
})();

// // Setup CDP session (Chrome DevTools Protocol)
  // const cdp = await context.newCDPSession(page);
  // await cdp.send('Log.enable');
  // await cdp.send('Runtime.enable');
  // await cdp.send('Network.enable');

  // cdp.on('Log.entryAdded', e => {
  //   currentSiteLogs.cdpLog.push({ source: e.entry.source, level: e.entry.level, text: e.entry.text, ts: e.entry.timestamp });
  // });
  // cdp.on('Runtime.exceptionThrown', e => {
  //   currentSiteLogs.cdpLog.push({ source: 'runtime', level: 'error', text: e.exceptionDetails?.text, ts: Date.now() });
  // });
  // cdp.on('Network.loadingFailed', e => {
  //   currentSiteLogs.cdpLog.push({ source: 'network', level: 'error', text: `${e.type} ${e.errorText}`, ts: Date.now() });
  // });


// retrieve domain identifier should be from the wrapper configs website layout, create a function for this
// init should iterate over the website urls and for each url, it should retrieve the domain identifier, id systems, consent, user ids
// finally it should save the results to a file and send it to the browser connector server if the --sendLogsToServer flag is present
// Other todo: create a specific batch of logs for AI to analyze when e.g. something unexepcted occurs.

