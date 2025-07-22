

**Repo overview **
- This repo includes 3 subcomponents:
    - `browser-tools-mcp` is a MCP client tool. It's used by AI tools. It calls APIs exposed by the `browser-tools-server`
    - `browser-tools-server` is a MCP server tool. It stores logs, payloads for pages which are sent by the `chrome-extension`. It also processes raw data for Prebid.js.
    - `chrome-extension` is a extension to collects raw logs and payloads from web pages.
- Always use context7 to get documents for implementing MCP tools.

---
    
**Wrapper health check**
    
Continue to `AI Instruction` if the user has explicitly prompted `wrapper health check` or `whc`.
    
**AI Instruction:**
`$documentation`: `.cursor/ai-docs/schema/bid-schemas.md`,
`$outcome`:`.cursor/ai-docs/analyzation-examples/bid-schemas.json`

Follow the steps outlined below:

**Step 1**
If variables `$auctionId` and `$bidRequest` existis in memory delete them

**Step 2** - *Assert that bids are properly requested:*

<ins>The expected outcome for this step should reflect what is located in: $outcome.$bid-request</ins>

Invoke the browser mcp tool `getBidRequests` WITH NO ARGUMENT. An array with the following schema should be returned: `{ [auctionId: string]: any[] }`.
        
Next select a random auction id from the list (do not be lazy and take the first one), store the string in memory as `$auctionId`.
    
Next invoke `getBidRequests` WITH the following arguments: `{$auctionId, condensed: true}`

Next if an array was returened, index the first element and store it as `$bidRequest` in memory. 

Next verify that the `auctionId` property of `$bidRequest` is the same as `$auctionId`.

Next analize `$bidRequest` according to `$documentation.$bid-request` and print a condensed schema representation of the properties evaluated (use the actual values in the schema), for each operation, so that the user can manually verify your reasoning.

**Step 3** - *Assert that bids are received for the auction*

<ins>The expected outcome for this step should reflect what is located in: $outcome.$bids-received</ins>

Invoke the browser mcp tool `getBidsReceived` with the argument `{$auctionId, condensed: true}`. The response should be an array containing the received bids.

Next index the first entry and assert that it's a valid bid response according to `$documentation.$bids-received`

**Step 4** - *Retrieve and evaluate error logs*
Invoke the browser mcp tool `getConsoleErrors`. Evaluate all errors thrown in the last 90 seconds.

**Step 5** - *Retrieve and evaluate warning logs*
$excludedWarningsList = ["Bid does not provide required DSA transparency info; will still be accepted", "Consent will be synced after the CMP is loaded.", "TCF2: enforcing P1 and P2 by default"]

Invoke the browser mcp tool `getConsoleWarnings`. Evaluate all warnings thrown in the last 90 seconds. Do not evaluate warnings that match any string found in the $excludedWarningsList.



<!-- END -->