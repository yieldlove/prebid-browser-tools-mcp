// Helper functions for the log scraper
import fs from 'fs'
import { fileURLToPath } from 'url'

export async function getSiteSettings(page) {
  const siteSettings = await page.evaluate(() => {
    const name = window.YLHH?.bidder?.settings
    return name
  })

  if (typeof siteSettings !== 'object') {
    throw new Error(`Failed to get site config: ${JSON.stringify(siteSettings)}`)
  }

  return siteSettings
}

export async function isMetaTagEnabled(page) {
  const result = await page.evaluate(() => {
    const mt = window?.SDG?.Publisher
    return mt
  })
  return result
}

export function setupEventListeners(page, siteLogs) {
  const wrapperRelatedRequests = ['hb.adscale.de/dsh', 'prod-ingestion.tracking', 's2s.yieldlove-ad-serving.net', 'cdn-a.yieldlove.com', 'metatag/live/']
  const wrapperRelatedKeyWords = ['Yieldlove', 'Prebid']
  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text(), ts: Date.now() }
    entry.text.length > 200 && (entry.text = entry.text.substring(0, 200) + '...')

    if (entry.type === 'error') {
      siteLogs.errors.push(entry)
    }
    else if (entry.type === 'warning') {
      siteLogs.warnings.push(entry)
    }
    else if (wrapperRelatedKeyWords.some(log => entry.text.includes(log))) {
      siteLogs.logs.push(entry)
    }
  });

  page.on('pageerror', err => siteLogs.errors.push({
    type: 'page error', text: err.message, ts: Date.now()
  }));

  page.on('requestfailed', req => siteLogs.requestsFailed.push({
    url: req.url(), method: req.method(), error: req.failure()?.errorText, ts: Date.now()
  }));

  page.on('request', req => {
    if (wrapperRelatedRequests.some(request => req.url().includes(request))) {
      siteLogs.wrapperNetworkRequests.push({
        url: req.url(), method: req.method(), payload: req.postDataJSON(), ts: Date.now()
      })
    }
  })
}

export async function getIdData(page) {
  const chromeConsoleKeyValues = await page.evaluate(() => {
    const result = {}

    const pbjsUserIds = window.pbjsYLHH?.getUserIds()
    result.pbjsUserIds = pbjsUserIds


    const wrapperConfigPrebidModules = (window.YLHH?.bidder?.settings?.prebid_modules || [])
    const enabledIdSystems = wrapperConfigPrebidModules.filter(module => module.includes('IdSystem'))
    result.wrapperConfigIdSystems = enabledIdSystems

    return result
  })

  if (!Object.keys(chromeConsoleKeyValues?.pbjsUserIds).length) console.error('Failed to access "window.pbjsYLHH.getUserIds()"', chromeConsoleKeyValues.pbjsUserIds)
  if (!chromeConsoleKeyValues.wrapperConfigIdSystems?.length) console.error('Failed to access "window.YLHH.bidder.settings.prebid_modules"', chromeConsoleKeyValues.wrapperConfigIdSystems)

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

export function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

export function getRandomViewport() {
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1536, height: 864 },
    { width: 1600, height: 900 }
  ];
  return viewports[Math.floor(Math.random() * viewports.length)];
}


export async function simulateRealisticNavigation(page, domain) {
  console.log('Simulating realistic navigation...')
  const referrers = [
    'https://www.google.com/search?q=' + encodeURIComponent(domain),
    'https://www.bing.com/search?q=' + encodeURIComponent(domain),
    'https://duckduckgo.com/?q=' + encodeURIComponent(domain),
    '', // Direct navigation (no referrer)
  ];

  const referrer = referrers[Math.floor(Math.random() * referrers.length)];

  if (referrer) {
    await page.goto(referrer, {
      waitUntil: 'domcontentloaded',
      timeout: 1000
    }).catch(() => { });
  }


  const url = `https://${domain}`
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 10000,
    referer: referrer
  });
}

export async function simulateMouseMovement(page, durationMs = 1500) {
  const vp = page.viewportSize() || { width: 1366, height: 768 }
  let x = Math.floor(vp.width * 0.5)
  let y = Math.floor(vp.height * 0.5)
  const end = Date.now() + durationMs

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
  const easeInOutSine = (t) => 0.5 - Math.cos(Math.PI * t) / 2

  while (Date.now() < end) {
    const tx = clamp(x + (Math.random() - 0.5) * 120, 0, vp.width - 1)
    const ty = clamp(y + (Math.random() - 0.5) * 120, 0, vp.height - 1)

    const segmentMs = 180
    const steps = 12
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const e = easeInOutSine(t)
      const ix = Math.round(x + (tx - x) * e)
      const iy = Math.round(y + (ty - y) * e)
      await page.mouse.move(ix, iy, { steps: 1 })
      await page.waitForTimeout(Math.max(8, Math.floor(segmentMs / steps)))
    }

    x = tx
    y = ty
  }
}


// Enable yieldlove/prebid logs to appear in the console
export async function appendDebugModeScript(page) {
  const yieldloveDebugScript = fileURLToPath(new URL('./enableDebugMode.js', import.meta.url));
  await page.addScriptTag({ path: yieldloveDebugScript });

  console.log('Enabling yieldlove debug mode...');
}