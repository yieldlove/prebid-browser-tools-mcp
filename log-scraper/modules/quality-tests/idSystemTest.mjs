const EXPECTED_ID_SYSTEM_SCHEMA = {
  'criteoIdSystem': { alias: 'criteoId', type: 'string' },
  'id5IdSystem': { alias: 'id5id', type: 'object', expectedKeys: ['uid', 'ext'] },
  'sharedIdSystem': { alias: 'pubcid', type: 'string' },
  'blueskyIdSystem': { alias: 'blueskyId', type: 'string' }
};


export function testIdSystemIntegration(records, prebidLogs, domain) {
  console.log('Starting id system integration test...')
  let success = true

  const retrievedUserIds = records.pbjsUserIds
  const wrapperConfigIdSystems = records.wrapperConfigIdSystems

  if (!wrapperConfigIdSystems.length || !retrievedUserIds) {
    !wrapperConfigIdSystems.length && console.error(domain.toUpperCase(), '[QT][ID SYSTEM TEST] No id systems detected in the wrapper config');
    !retrievedUserIds && console.error('[QT][ID SYSTEM TEST] No client-side user IDs detected');
    return
  }

  for (const idSystem of wrapperConfigIdSystems) {
    const isValidIdSystem = EXPECTED_ID_SYSTEM_SCHEMA[idSystem]
    if (!isValidIdSystem) {
      console.error(domain.toUpperCase(), `[QT][ID SYSTEM TEST] Module ${idSystem} is enabled but was not found in the expexted id systems. Must be one of ${Object.keys(EXPECTED_ID_SYSTEM_SCHEMA).join(', ')}`)
      success = false
      continue
    }

    const userId = retrievedUserIds?.[EXPECTED_ID_SYSTEM_SCHEMA[idSystem]?.alias]

    if (!userId) {
      console.error(domain.toUpperCase(), `[QT][ID SYSTEM TEST] ${idSystem} is enabled but client-side user ID is missing`)
      success = false
      continue
    }

    const userIdType = userId && EXPECTED_ID_SYSTEM_SCHEMA[idSystem].type === typeof userId
    if (!userIdType) {
      console.error(domain.toUpperCase(), `[QT][ID SYSTEM TEST] ${idSystem} is enabled but client-side user ID is of different expected schema type`)
      success = false
      continue
    }
  }

  const filteredLogs = prebidLogs.filter(log => log.text.includes('INFO: User ID - usersync config updated for'))
  const idxSuccessfulUserSyncLog = filteredLogs.findIndex((log)=> log.text.includes(`usersync config updated for ${wrapperConfigIdSystems.length.toString()}`))

  if (!filteredLogs.length) {
    console.error(domain.toUpperCase(), '[QT][ID SYSTEM TEST] No user sync logs found')
    success = false
  }else if(idxSuccessfulUserSyncLog === -1) {
    console.error(domain.toUpperCase(), '[QT][ID SYSTEM TEST] User sync update log found, but not all id systems were updated:', filteredLogs.map(log => log.text.slice(110)))
    success = false
  }


  if (success) {
    console.log('\n\x1b[32m[QT][ID SYSTEM TEST] All configured id systems are enabled, their respective client-side user IDs are present and Prebid user sync was successful. \x1b[0m')
    console.log('\x1b[32m--------ID SYSTEMS TEST SUCCEDED--------\x1b[0m')
  }else{
    console.log('\n\x1b[31m--------ID SYSTEMS TEST FAILED--------\x1b[0m')
  }
}