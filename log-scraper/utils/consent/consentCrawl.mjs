"use strict";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONSENT_MANAGERS_FILE = path.join(MODULE_DIR, "cmp-list.json");

export function getConsentManagers() {
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

export async function clickConsentManager(page) {
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
                    const elementExists = await candidate.count() > 0
                    const isElementVisible = await candidate.isVisible().catch((e) => console.debug("[[] Element is not visible", e))

                    if (isElementVisible) {
                        locator = candidate;
                        cmp["selector-list-item"] = sel;
                        break;
                    } else if (elementExists) {
                        console.log(`[CONSENT CRAWL] Element is not visible, but it exists in DOM, attempting to click using native JS`);
                        const jsClickSuccess = await performJavaScriptClickOnElement(candidate, sel);

                        if (jsClickSuccess) {
                            console.log(`[CONSENT CRAWL] JavaScript click succeeded on invisible element using selector: ${sel}`);
                            return { ...cmp, status: cmp.status || "clicked" };
                        }

                        console.log(`[CONSENT CRAWL] JavaScript click failed on invisible element using selector: ${sel}`);
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

    return {};
}



// JavaScript click function that works with both page and iframe contexts
async function performJavaScriptClickOnElement(locatorContext, selector) {
    const result = await locatorContext.evaluate((_, sel) => {
        try {
            const element = document.querySelector(sel);
            if (!element) {
                console.log('Element not found in current context');
                return
            }

            element.click();
            console.log(`[CONSENT CRAWL] Successfully clicked element using selector: ${sel}`);
            return true

        } catch (error) {
            console.error(`[CONSENT CRAWL] JavaScript click error: ${error.message}`);
            return
        }
    }, selector);
    console.log({ result })
    return result
}
