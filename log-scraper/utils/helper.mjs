// Helper functions for the log scraper
import fs from 'fs'

export async function getYLSiteName(page) {
  const ylSiteName = await page.evaluate(() => {
    const name = window.YLHH?.bidder?.settings?.name
    return name
  })
  return ylSiteName
}

export function setupEventListeners(page, siteLogs) {
  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text(), ts: Date.now() }
    if (entry.type === 'error') {
      siteLogs.errors.push(entry)
    }
    else if (entry.type === 'warning') {
      siteLogs.warnings.push(entry)
    }
    else {
      siteLogs.logs.push(entry)
    }
  });
  
  page.on('pageerror', err => siteLogs.errors.push({
    type: 'page error', text: err.message, ts: Date.now()
  }));
  
  page.on('requestfailed', req => siteLogs.requestsFailed.push({
    url: req.url(), method: req.method(), error: req.failure()?.errorText, ts: Date.now()
  }));
}

export async function getUserIdsFromChromeConsole(page) {
  const chromeConsoleKeyValues = await page.evaluate(() => {
    const result = {}

    const pbjsUserIds = window.pbjsYLHH?.getUserIds()
    result.pbjsUserIds = pbjsUserIds 
    
    
    const wrapperConfigPrebidModules = (window.YLHH?.bidder?.settings?.prebid_modules || [])
    const enabledIdSystems = wrapperConfigPrebidModules.filter(module => module.includes('IdSystem'))
    result.wrapperConfigIdSystems = enabledIdSystems
    
    return result
  })
  
  if (!Object.keys(chromeConsoleKeyValues?.pbjsUserIds).length)  console.error('Failed to access "window.pbjsYLHH.getUserIds()"', chromeConsoleKeyValues.pbjsUserIds)
  if (!chromeConsoleKeyValues.wrapperConfigIdSystems?.length)  console.error('Failed to access "window.YLHH.bidder.settings.prebid_modules"', chromeConsoleKeyValues.wrapperConfigIdSystems)

  return chromeConsoleKeyValues
}

export const canParseWebsiteDomains = (args) => {
  let parsedDomainsArg
  try {
    console.log('Arguments detected, execution config will not be used')
    parsedDomainsArg = JSON.parse((typeof args[0] === 'string' ? args[0] : new Error('Website domains must be a json array')))
  } catch (error) {
    console.error(`Failed to parse domains argument, please provide target domains like so: --domains "mathebibel.de,infranken.de"`, error)
  }
  return parsedDomainsArg
}

export const canParseExecutionConfig = () => {
  let parsedExecutionConfig
  try {
      parsedExecutionConfig = JSON.parse(fs.readFileSync('./execution-config.json', 'utf8'))
  } catch (error) {
    console.error('Failed to parse execution config, please provide a valid JSON file', error)
  } 
    return parsedExecutionConfig
}