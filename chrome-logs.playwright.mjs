// chrome-logs.playwright.js

// must be run with a non eu ip address
// todo: for eu ip consent must be clicked

import { chromium } from 'playwright';
import fs from 'fs';

const idModules = {
  'criteoIdSystem': { alias: 'criteoId', type: 'string' },
  'id5IdSystem': { alias: 'id5id', type: 'object', expectedKeys: ['uid', 'ext'] },
  'sharedIdSystem': { alias: 'pubcid', type: 'string' }
};

const records = {
  console: [],
  errors: [],
  requestsFailed: [],
  cdpLog: [],
};

const save = () => fs.writeFileSync('chrome-logs.json', JSON.stringify(records, null, 2));

(async () => {

  const userDataDir = './browser-data'; // Directory to store browser profile

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',          // use real Chrome (optional)
    headless: false,
    args: ['--enable-logging=stderr', '--v=1', '--load-extension=./chrome-extension'], // Chrome logging flags (stderr)
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
  });

  const page = await context.newPage();

  page.on('console', msg => records.console.push({
    type: msg.type(), text: msg.text(), ts: Date.now()
  }));
  page.on('pageerror', err => records.errors.push({
    type: 'page error', text: err.message, ts: Date.now()
  }));
  page.on('requestfailed', req => records.requestsFailed.push({
    url: req.url(), method: req.method(), error: req.failure()?.errorText, ts: Date.now()
  }));

  const cdp = await context.newCDPSession(page);
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  cdp.on('Log.entryAdded', e => {
    records.cdpLog.push({ source: e.entry.source, level: e.entry.level, text: e.entry.text, ts: e.entry.timestamp });
  });
  cdp.on('Runtime.exceptionThrown', e => {
    records.cdpLog.push({ source: 'runtime', level: 'error', text: e.exceptionDetails?.text, ts: Date.now() });
  });
  cdp.on('Network.loadingFailed', e => {
    records.cdpLog.push({ source: 'network', level: 'error', text: `${e.type} ${e.errorText}`, ts: Date.now() });
  });

  await page.goto('https://mathebibel.de?yldebug=true', { waitUntil: 'load' });
  await page.waitForTimeout(3000)


  if (true) {
    await getUserIdsFromChromeConsole(page)
    assertIdSystemEnablement(records)
  }


  save();
  await context.close();
})();

// argument to pass assert id sys

// used cached context

// 


function assertIdSystemEnablement(records) {
  let success = true

  const retrievedUserIds = records.pbjsUserIds
  const wrapperPrebidModules = records.wrapperPrebidModules

  if (!wrapperPrebidModules || !retrievedUserIds) {
    !wrapperPrebidModules && console.error('No id systems detected in the wrapper config');
    !retrievedUserIds && console.error('No client-side user IDs detected');
    return
  }

  for (const module of wrapperPrebidModules) {
    const isValidIdModule = idModules[module]
    if (!isValidIdModule) {
      console.error(`Module ${module} is enabled but is not a valid id system. Must be one of ${Object.keys(idModules).join(', ')}`)
      success = false
      continue
    }

    const userId = retrievedUserIds?.[idModules[module]?.alias]

    if (!userId) {
      console.error(`${module} is enabled but client-side user ID is missing`)
      success = false
      continue
    }

    const userIdType = userId && idModules[module].type === typeof userId
    if (!userIdType) {
      console.error(`${module} is enabled but client-side user ID is of different expected schema type`)
      success = false
      continue
    }
  }

  if (success) {
    console.log('All id systems are enabled and their respective client-side user IDs are present', { userIds: records.pbjsUserIds, idModules: records.wrapperPrebidModules })
  }
}

async function getUserIdsFromChromeConsole(page) {
  const result = await page.evaluate(() => {
    const chromeConsoleKeyValues = {}

    const pbjsUserIds = window.pbjsYLHH?.getUserIds()
    pbjsUserIds ? chromeConsoleKeyValues.pbjsUserIds = pbjsUserIds : console.error('Failed to access "window.pbjsYLHH.getUserIds()"')

    const wrapperConfigPrebidModules = window.YLHH.bidder.settings.prebid_modules
    wrapperConfigPrebidModules ? chromeConsoleKeyValues.wrapperPrebidModules = wrapperConfigPrebidModules.filter(module => module.includes('IdSystem')) : console.error('Failed to access "window.YLHH.bidder.settings.prebid_modules"')

    return chromeConsoleKeyValues
  })
  Object.assign(records, result);
}

async function handleDeniedTCF2(page) {
  const result = await page.evaluate(() => {
    const chromeConsoleKeyValues = {}

    const gvlMapping = pbjsYLHH.getConfig('gvlMapping')
    gvlMapping ? chromeConsoleKeyValues.gvlMapping = gvlMapping : console.error('Failed to access "window.pbjsYLHH.getConfig(\'gvlMapping\')"')

    return chromeConsoleKeyValues
  })
  Object.assign(records, result);

}

function evalLog(logText) {
  if (logText.includes('TCF2 denied')) {
    return handleDeniedTCF2(page)
  }
}