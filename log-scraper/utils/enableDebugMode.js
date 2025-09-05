console.log('Yieldlove Extension', 'enableDebugMode is executed...')

window.pbjsYLHH = window.pbjsYLHH || {};
window.pbjsYLHH.que = window.pbjsYLHH.que || [];
window.pbjsYLHH.que.push(function () {
    window.pbjsYLHH.setConfig({ 'debug': true })
    window.pbjsYLHH.utils.logInfo('Yieldlove Extension', 'Debug mode is enabled by extension with debug=true')
})

window.ylDebug = window.ylDebug || {}
window.ylDebug.requests = window.ylDebug.requests || []

window.googletag = window.googletag || {}
googletag.cmd = googletag.cmd || []
googletag.cmd.push(() => {
    googletag.pubads().addEventListener('slotRequested', (e) => {
        console.log('Yieldlove Extension', 'Ad server request is sent', 'Ad unit path:', e.slot.getAdUnitPath(), 'Targeting Map:', e.slot.getTargetingMap())
        window.ylDebug.requests.push({
            requestedTime: new Date(),
            adUnitPath: e.slot.getAdUnitPath(),
            targetingMap: e.slot.getTargetingMap()
        })
    })
})

