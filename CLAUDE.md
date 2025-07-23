

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

**Step 1** - #Delete cache*
Delete the values of `$auctionId`, `$domain` and `$bidRequest` if they exist in memory

**Step 2** - *Retrieve the domain*
$domain Invoke the tool `getCurrentUrl`. Extract the domain from the URL and save it in memory to a variable called $domain and print: "Starting wrapper health check for $domain". Proceed to step 2.

**Step 3** - *Assert that bids are properly requested:*

<ins>The expected outcome for this step should reflect what is located in: $outcome.$bid-request</ins>

Invoke the browser mcp tool `getBidRequests` WITH NO ARGUMENT. An array with the following schema should be returned: `{ [auctionId: string]: any[] }`.

Next select a random auction id from the list (do not be lazy and take the first one), store the string in memory as `$auctionId`.
    
Next invoke `getBidRequests` WITH the following arguments: `{$auctionId, condensed: true}`

Next if an array was returened, index the first element and store it as `$bidRequest` in memory. 

Next verify that the `auctionId` property of `$bidRequest` is the same as `$auctionId`.

Next analize `$bidRequest` according to `$documentation.$bid-request` (THIS IS PARAMOUNT) and print a schema representation of the properties evaluated (use the actual values in the schema), so that the user can manually verify your reasoning. 

**Setp 4** - *Assert that bids are received for the auction*

<ins>The expected outcome for this step should reflect what is located in: $outcome.$bids-received</ins>

Invoke the browser mcp tool `getBidsReceived` with the argument `{$auctionId, condensed: true}`. The response should be an array containing the received bids.

Next index the first entry and assert that it's a valid bid response according to `$documentation.$bids-received` (THIS IS PARAMOUNT)
<!-- END -->