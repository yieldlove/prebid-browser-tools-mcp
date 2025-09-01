"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// Optional dependencies
let yamlParser = null;
try {
    yamlParser = require("yaml");
} catch (e) {
    try {
        yamlParser = require("js-yaml");
    } catch (e2) {
        yamlParser = null;
    }
}

let sqlite3 = null;
try {
    sqlite3 = require("sqlite3");
} catch (e) {
    sqlite3 = null;
}

const MODULE_DIR = __dirname;
const CONSENT_MANAGERS_FILE = path.join(MODULE_DIR, "cmp-list.json");

const DEFAULT_UA_STRINGS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Edg/116.0.1938.81",
];

function getExtractSchema() {
    return {
        id: "STRING",
        url: "STRING",
        domain_name: "STRING",
        extraction_datetime: "STRING",
        cookies_all: "STRING",
        cookies_no_consent: "STRING",
        third_party_domains_all: "STRING",
        third_party_domains_no_consent: "STRING",
        tracking_domains_all: "STRING",
        tracking_domains_no_consent: "STRING",
        consent_manager: "STRING",
        screenshot_files: "STRING",
        meta_tags: "STRING",
        json_ld: "STRING",
        status: "STRING",
        status_msg: "STRING",
    };
}

function getConsentManagers() {
    try {
        if (!fs.existsSync(CONSENT_MANAGERS_FILE)) return [];
        const raw = fs.readFileSync(CONSENT_MANAGERS_FILE, "utf8");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.debug("Failed to read consent managers:", err.message);
        return [];
    }
}

async function clickConsentManager(page) {
    const consentManagers = getConsentManagers();
    for (const cmp of consentManagers) {
        let parentLocator = page;
        let locator = null;

        for (const action of cmp.actions || []) {

            if (action.type === "iframe") {
                const frameCandidates = parentLocator.locator(action.value);
                const count = await frameCandidates.count();
                if (count > 0) {
                    parentLocator = parentLocator.frameLocator(action.value).first();
                } else {
                    // Next consent manager
                    parentLocator = page;
                    locator = null;
                    break;
                }
            } else if (action.type === "css-selector") {
                const candidate = parentLocator.locator(action.value).first();
                if (await candidate.isVisible().catch(() => false)) {
                    locator = candidate;
                    break;
                }
            } else if (action.type === "css-selector-list") {
                for (const sel of action.value || []) {

                    const candidate = parentLocator.locator(sel).first();
                    const count = await candidate.count();
                    const v = await candidate.isVisible()
                    console.log('count', count)
                    console.log('v', v)
                    const isVisible = await candidate.isVisible().catch((e) => console.debug("Candidate not visible", e))

                    if (isVisible) {
                        locator = candidate;
                        cmp["selector-list-item"] = sel;
                        break;
                    }
                }
                if (locator) break;
            } else if (action.type === "xpath") {
                // Not implemented
            }
        }

        if (locator) {
            try {
                // Some CMPs reload after accepting
                await Promise.race([
                    page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => { }),
                    locator.click({ delay: 10 }),
                ]);
                return { ...cmp, status: cmp.status || "clicked" };
            } catch (e) {
                console.debug(`Error clicking consent manager '${cmp.id}': ${e.message}`);
                return { ...cmp, status: "error", error: e.message };
            }
        }
    }

    // console.debug(`Unable to accept cookies on: ${page.url()}`);
    return {};
}

async function getJsonLd(page) {
    const jsonLd = [];
    const nodes = await page.locator('script[type="application/ld+json"]').all();
    for (const node of nodes) {
        try {
            const contents = await node.innerText();
            const clean = contents.trim();
            const cdataMatch = /\/\/<!\[CDATA\[\s*(.*?)\s*\/\/\]\]>/s.exec(clean);
            const payload = cdataMatch ? cdataMatch[1] : clean;
            try {
                jsonLd.push(JSON.parse(payload));
            } catch (err) {
                jsonLd.push({ raw: contents, error: String(err) });
            }
        } catch (err) {
            console.debug("Unable to parse JSON-LD:", err.message);
        }
    }
    return jsonLd;
}

async function getMetaTags(page) {
    const meta = {};
    const tags = await page.locator("meta[name]").all();
    for (const tag of tags) {
        try {
            const name = await tag.getAttribute("name");
            const content = await tag.getAttribute("content");
            if (name) meta[name] = content;
        } catch (err) {
            console.debug("Unable to get meta tag:", err.message);
        }
    }
    return meta;
}

function getDomainFromUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, "");
    } catch (_) {
        return (url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    }
}

async function crawlUrl({
    url,
    browser,
    trackingDomainsList = [],
    screenshot = true,
    device = {},
    waitForTimeout = 5000,
}) {
    const output = Object.fromEntries(Object.keys(getExtractSchema()).map(k => [k, null]));

    try {
        if (!/^https?:\/\//i.test(url)) url = `http://${url}`;

        output.url = url;
        output.extraction_datetime = new Date().toISOString();

        if (!device.user_agent) device.user_agent = DEFAULT_UA_STRINGS[Math.floor(Math.random() * DEFAULT_UA_STRINGS.length)];
        if (!device.viewport) device.viewport = { width: 1366, height: 768 };

        const context = await browser.newContext({
            userAgent: device.user_agent,
            viewport: device.viewport,
        });

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        output.domain_name = getDomainFromUrl(url);
        const base64Id = Buffer.from(output.domain_name).toString("base64url");
        output.id = base64Id;

        console.info(`Start extracting data from domain ${output.domain_name}`);

        const reqUrls = [];
        const page = await context.newPage();
        page.on("request", (req) => reqUrls.push(req.url()));

        await page.goto(url, { waitUntil: "load", timeout: 90000 });
        await page.waitForTimeout(2000);
        await page.mouse.move(543, 123);
        await page.mouse.wheel(0, -123);
        await page.waitForTimeout(waitForTimeout);

        if (screenshot) {
            const screenshotsDir = path.join(MODULE_DIR, "screenshots");
            if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
            const shotPath = path.join(screenshotsDir, `screenshot_${output.id}.png`);
            await page.screenshot({ path: shotPath });
            output.screenshot_files = [shotPath];
        }

        // JSON-LD and Meta
        output.json_ld = await getJsonLd(page);
        output.meta_tags = await getMetaTags(page);

        // Pre-consent third-parties
        const thirdpartyPre = reqUrls.filter((u) => !u.includes(output.domain_name));
        const tpdNoConsent = Array.from(new Set(thirdpartyPre.map((r) => {
            try { return new URL(r).hostname.replace(/^www\./, ""); } catch (_) { return r; }
        })));
        output.third_party_domains_no_consent = tpdNoConsent;

        const trackNoConsent = Array.from(new Set(tpdNoConsent
            .map((d) => (d.split(".").slice(-2).join(".")))
            .filter((d) => trackingDomainsList.includes(d))));
        output.tracking_domains_no_consent = trackNoConsent;

        const cookiesNoConsent = await context.cookies();
        output.cookies_no_consent = cookiesNoConsent.map((c) => ({
            name: c.name,
            domain: c.domain,
            expires_days: typeof c.expires === "number" && c.expires > 0
                ? Math.round((new Date(c.expires * 1000) - new Date()) / (1000 * 60 * 60 * 24))
                : -1,
        }));

        // Try to accept consent
        console.debug(`Trying to accept full marketing consent on ${output.domain_name}`);
        output.consent_manager = await clickConsentManager(page);

        if (screenshot && output.consent_manager && output.consent_manager.status && output.consent_manager.status !== "error") {
            const screenshotsDir = path.join(MODULE_DIR, "screenshots");
            const shotPathAfter = path.join(screenshotsDir, `screenshot_${output.id}_afterconsent.png`);
            await page.screenshot({ path: shotPathAfter });
            output.screenshot_files = (output.screenshot_files || []).concat([shotPathAfter]);
        }

        const thirdpartyAll = reqUrls.filter((u) => !u.includes(output.domain_name));
        const tpdAll = Array.from(new Set(thirdpartyAll.map((r) => {
            try { return new URL(r).hostname.replace(/^www\./, ""); } catch (_) { return r; }
        })));
        output.third_party_domains_all = tpdAll;

        const trackAll = Array.from(new Set(tpdAll
            .map((d) => (d.split(".").slice(-2).join(".")))
            .filter((d) => trackingDomainsList.includes(d))));
        output.tracking_domains_all = trackAll;

        const cookiesAll = await context.cookies();
        output.cookies_all = cookiesAll.map((c) => ({
            name: c.name,
            domain: c.domain,
            expires_days: typeof c.expires === "number" && c.expires > 0
                ? Math.round((new Date(c.expires * 1000) - new Date()) / (1000 * 60 * 60 * 24))
                : -1,
        }));

        await context.close();

        output.status = "success";
        output.status_msg = `Successfully extracted data from ${url}`;
        return output;
    } catch (e) {
        const msg = `Error extracting data from ${url}: ${e.message}`;
        console.debug(msg);
        output.status = "error";
        output.status_msg = msg;
        return output;
    }
}

async function crawlBatch({
    urls,
    resultsFunction,
    batchSize = 10,
    trackingDomainsList = [],
    browserConfig = null,
    screenshot = false,
}) {
    const config = browserConfig || { headless: true, channel: "chrome" };
    const browser = await chromium.launch(config);

    const batches = [];
    for (let i = 0; i < urls.length; i += batchSize) {
        batches.push(urls.slice(i, i + batchSize));
    }

    let lastResults = [];
    for (const batch of batches) {
        const tasks = batch.map((u) => crawlUrl({ url: u, browser, trackingDomainsList, screenshot }));
        const results = await Promise.all(tasks);
        if (typeof resultsFunction === "function") {
            await resultsFunction(results);
        }
        lastResults = results;
    }

    await browser.close();
    return lastResults;
}

async function crawlSingle({ url, trackingDomainsList = [], browserConfig = null }) {
    const config = browserConfig || { headless: true, channel: "chrome" };
    const browser = await chromium.launch(config);
    try {
        return await crawlUrl({ url, browser, trackingDomainsList });
    } finally {
        await browser.close();
    }
}

async function storeCrawlResults({ data, tableName = "crawl_results", file = null, resultsDbFile = "crawl_results.db" }) {
    if (file) {
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, data.map((d) => JSON.stringify(d)).join("\n") + "\n", { encoding: "utf8" });
    }

    if (resultsDbFile) {
        if (!sqlite3) {
            console.warn("sqlite3 not installed; skipping DB storage");
            return;
        }

        const dir = path.dirname(resultsDbFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const db = new sqlite3.Database(resultsDbFile);
        const schema = getExtractSchema();
        const columnsSql = Object.keys(schema).map((k) => `${k} TEXT`).join(",");
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnsSql})`, (err) => (err ? reject(err) : resolve()));
        });

        for (const d of data) {
            const normalized = {};
            for (const [k, v] of Object.entries(d)) {
                if (v && (typeof v === "object")) normalized[k] = JSON.stringify(v);
                else normalized[k] = v;
            }
            const keys = Object.keys(schema);
            const placeholders = keys.map(() => "?").join(",");
            const values = keys.map((k) => normalized[k]);
            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO ${tableName} VALUES (${placeholders})`, values, (err) => (err ? reject(err) : resolve()));
            });
        }

        await new Promise((resolve) => db.close(resolve));
    }
}

module.exports = {
    getExtractSchema,
    getConsentManagers,
    clickConsentManager,
    getJsonLd,
    getMetaTags,
    crawlUrl,
    crawlBatch,
    crawlSingle,
    storeCrawlResults,
};


// getConsentManagers()
// clickConsentManager()
// getJsonLd,
// getMetaTags,
// crawlUrl,
// crawlBatch,
// crawlSingle,
// storeCrawlResults,