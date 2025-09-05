export async function testPriceOptimizationIntegration({ networkRequests, siteSettings, prebidLogs }) {
    const requiredPOModules = ['direct-rendering-2', 'optimize-price-bucket']
    const isRequiredPOModulesLoaded = requiredPOModules.every(module => siteSettings.active_modules.some(m => m === module))

    if (!isRequiredPOModulesLoaded) {
        console.log('Required price optimization modules are not loaded')
        console.error('\n\x1b[31m--------PRICE OPTIMIZATION TEST FAILED--------\x1b[0m')
        return false
    }
    const isWrapperLogWarning = prebidLogs.some(log => log.text.includes('[PriceOptimization] Module was loaded but the optimizationPercentage'))
    if (isWrapperLogWarning) {
        console.log('Wrapper price optimization log warning found. Optimization percentage is not provided')
        console.log('\x1b[31m--------PRICE OPTIMIZATION TEST FAILED--------\x1b[0m')
        return false
    }

    if (typeof siteSettings.priceOptimizationSetup.optimizationPercentage === undefined) {
        console.log('Price optimization percentage is not defined')
        console.error('\x1b[31m--------PRICE OPTIMIZATION TEST FAILED--------\x1b[0m')
        return false
    }

    if (typeof siteSettings.priceOptimizationSetup.optimizationPercentage !== 'number') {
        console.log('Price optimization percentage is not a number')
        console.error('\x1b[31m--------PRICE OPTIMIZATION TEST FAILED--------\x1b[0m')
        return false
    }

    if (siteSettings.priceOptimizationSetup.optimizationPercentage < 0 || siteSettings.priceOptimizationSetup.optimizationPercentage > 100) {
        console.log('Price optimization percentage is not between 0 and 100')
        console.error('\x1b[31m--------PRICE OPTIMIZATION TEST FAILED--------\x1b[0m')
        return false
    }

    const dshRequest = networkRequests.find(request => request.url.includes('https://hb.adscale.de/dsh'))
    const ytPayload = JSON.parse(JSON.stringify(dshRequest.payload ?? '{}'))?.kvg?.yt
    if (!dshRequest) {
        //todo check yt payload
        console.log('Price optimization is enabled but no DSH request was found')
        console.error('\x1b[31m--------PRICE OPTIMIZATION TEST FAILED--------\x1b[0m')
        return false
    }
    else if (!ytPayload) {
        console.log('No YT payload found in the DSH request', { ytPayload })
        console.error('\x1b[31m--------PRICE OPTIMIZATION TEST FAILED--------\x1b[0m')
        return false
    }
    else if (Array.isArray(ytPayload) && ytPayload[0] !== '0' && ytPayload[0] !== '1') {
        console.log('YT payload is not ["0"] or ["1"] in the DSH request', { ytPayload })
        console.error('\x1b[31m--------PRICE OPTIMIZATION TEST FAILED--------\x1b[0m')
        return false
    }

    console.log('\Price optimization is enabled and the DSH request was successfully sent with a kvg.yt value: ', ytPayload)
    console.log('\n\x1b[32m--------PRICE OPTIMIZATION TEST SUCCEDED--------\x1b[0m\n')
    return true
}