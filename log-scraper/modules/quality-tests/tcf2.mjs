// Looks for logs containing 'TCF2 denied'. If denied consent can not be shared with the SSP and in turn we'll loos erevenue

export function isTCF2Denied(logs) {
  if (logs.length === 0) {
    console.error('No logs found\n')
    console.error('--------TCF2 TEST FAILED--------')
    return true
  }

  const tcf2DeniedIdx = logs.indexOf('TCF2 denied')
  if (tcf2DeniedIdx !== -1) {
    console.error(`Found a log containg the string "TCF2 denied"\nLOG: ${logs[tcf2DeniedIdx]}\n`)
    console.error('--------TCF2 TEST FAILED--------')
    return true
  }

  console.log('No logs containing the string "TCF2 denied" found\n')
  console.log('\x1b[32m--------TCF2 TEST SUCCEDED--------\x1b[0m\n')
}