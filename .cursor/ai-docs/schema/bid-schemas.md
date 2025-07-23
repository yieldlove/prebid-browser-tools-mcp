**Prebid Bids**

-  $bid-request - *The request containg all the bids to the SSPs*

    -   Essential bid request properties:
        1. `gdprConsent` - Contains the unique consent string of the user, must be populated if GDPR applies for the user (see the boolean of the `gdprApplies` property)
        2. `bids` - Array of bids to send, length must not be 0.
        3. `bids[index].schain` - The Supply Chain Object tracks the path of an impression and prevents unauthorized reselling. It provides legitimacy for the buyer that the impression was handled by legitimate parties. This field must exist.
        4. `bids[index].userId` - Used to identify users across different websites. Unless it's a user first visit, this field will always be populated.
        5. `referInfo` - Contains site information from the client. The domain provided here ($referInfo.domain) should equal the domain currently being evaluated.

-  $bids-received - *Received bids from SSPs*

    -   Expected bid properties:
        1. `cpm` - Bid price per milli
        2. `bidderCode` - Name of the bidder
        3. `adId` - Id of the ad
        4. `mediaType` - Type of bid, expected values are "banner", "native", "outstream"
        5. `yieldlove` - Yieldlove meta data containing properties such as targeting, cpm and auction details
