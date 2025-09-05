// Looks for logs containing 'TCF2 denied'. If denied consent can not be shared with the SSP and in turn we'll loos erevenue

export function isTCF2Denied(warningLogs) {
  if (warningLogs.length === 0) {
    console.error('No warning logs found\n')
    console.error('\x1b[31m--------TCF2 TEST FAILED--------\x1b[0m')
    return true
  }

  const deniedTCF2Logs = warningLogs.filter(w => w.includes('TCF2 denied'))
  if (deniedTCF2Logs.length > 0) {
    console.error(`Found one or more warning logs containg the string "TCF2 denied"\nLOGS: ${deniedTCF2Logs.join('\n')}\n`)
    console.error('\x1b[31m--------TCF2 TEST FAILED--------\x1b[0m')
    return true
  }

  console.log('No warning logs containing the string "TCF2 denied" found\n')
  console.log('\x1b[32m--------TCF2 TEST SUCCEDED--------\x1b[0m\n')
}