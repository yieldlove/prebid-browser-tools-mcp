const EXPECTED_ID_SYSTEM_SCHEMA = {
  'criteoIdSystem': { alias: 'criteoId', type: 'string' },
  'id5IdSystem': { alias: 'id5id', type: 'object', expectedKeys: ['uid', 'ext'] },
  'sharedIdSystem': { alias: 'pubcid', type: 'string' },
};


export function testIdSystemIntegration(records, prebidLogs, domain) {
  let success = true

  const retrievedUserIds = records.pbjsUserIds
  const wrapperConfigIdSystems = records.wrapperConfigIdSystems

  if (!wrapperConfigIdSystems.length || !retrievedUserIds) {
    !wrapperConfigIdSystems.length && console.error(domain.toUpperCase(), 'No id systems detected in the wrapper config\n');
    !retrievedUserIds && console.error('No client-side user IDs detected\n');
    return
  }

  for (const idSystem of wrapperConfigIdSystems) {
    const isValidIdSystem = EXPECTED_ID_SYSTEM_SCHEMA[idSystem]
    if (!isValidIdSystem) {
      console.error(domain.toUpperCase(), `Module ${idSystem} is enabled but was not found in the expexted id systems. Must be one of ${Object.keys(EXPECTED_ID_SYSTEM_SCHEMA).join(', ')}\n`)
      success = false
      continue
    }

    const userId = retrievedUserIds?.[EXPECTED_ID_SYSTEM_SCHEMA[idSystem]?.alias]

    if (!userId) {
      console.error(domain.toUpperCase(), `${idSystem} is enabled but client-side user ID is missing\n`)
      success = false
      continue
    }

    const userIdType = userId && EXPECTED_ID_SYSTEM_SCHEMA[idSystem].type === typeof userId
    if (!userIdType) {
      console.error(domain.toUpperCase(), `${idSystem} is enabled but client-side user ID is of different expected schema type\n`)
      success = false
      continue
    }
  }

  const filteredLogs = prebidLogs.filter(log => log.text.includes('INFO: User ID - usersync config updated for'))
  const idxSuccessfulUserSyncLog = filteredLogs.findIndex((log)=> log.text.includes(`usersync config updated for ${wrapperConfigIdSystems.length.toString()}`))

  if (!filteredLogs.length) {
    console.error(domain.toUpperCase(), 'No user sync logs found\n')
    success = false
  }else if(idxSuccessfulUserSyncLog === -1) {
    console.error(domain.toUpperCase(), 'User sync update log found, but not all id systems were updated:', filteredLogs.map(log => log.text.slice(110)))
    success = false
  }


  if (success) {
    console.log('All configured id systems are enabled, their respective client-side user IDs are present and Prebid user sync was successful.\n')
    console.log('\x1b[32m--------ID SYSTEMS TEST SUCCEDED--------\x1b[0m\n')
    return true
  }else{
    console.log('\n\x1b[31m--------ID SYSTEMS TEST FAILED--------\x1b[0m')
  }
}