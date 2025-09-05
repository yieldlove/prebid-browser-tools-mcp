// Checks ifid systems and user ids are correctly configured in the wrapper config and the dynamic settings
// The test also checks if the client-side user IDs are present and if Prebid's user sync was successful/
// Utiq's id system requires one to accept an additional utiq specific consent, which is not tested in this test. Hence only the utiq configuration is tested.

// Id system name: client-side user id schema
const EXPECTED_ID_SYSTEMS_SCHEMA = {
  'criteoIdSystem': { alias: 'criteoId', type: 'string' },
  'id5IdSystem': { alias: 'id5id', type: 'object', expectedKeys: ['uid', 'ext'] },
  'sharedIdSystem': { alias: 'pubcid', type: 'string' },
  'identityLinkIdSystem': { alias: 'identityLink', type: 'object', expectedKeys: ['pid', 'notUse3P'] },
  'utiqIdSystem': { alias: 'utiqId', type: 'string' },
  'utiqMtpIdSystem': { alias: 'utiqMtpId', type: 'string' },
  'pubProvidedIdSystem': { alias: 'pubProvidedId', type: 'object', expectedKeys: ['source', 'uids'] },
  // TODO: Ask about this schema
  'ringierIdSystems': { alias: null, type: null },
  // TODO: Ask about this schema
  'netIdSystem': { alias: 'unknown', type: 'string' },
};


export function testIdSystemIntegration({ pbjsUserIds, wrapperConfigIdSystems, dynamicConfig, prebidLogs, domain }) {
  let success = true

  if (!wrapperConfigIdSystems.length || !pbjsUserIds) {
    !wrapperConfigIdSystems.length && console.error(domain.toUpperCase(), 'No id systems detected in the wrapper config\n');
    !pbjsUserIds && console.error('No client-side user IDs detected\n');
    return
  }

  const dynamicSettingsUserIds = dynamicConfig?.setConfig?.userSync?.userIds || []

  // Utiq specific checks
  // Todo: figure out how to accept utiq consent so that it can be tested more thoroughly
  const utiqDynamicSettings = dynamicSettingsUserIds.filter(userId => userId.name.includes('utiq'))
  const utiqWrapperConfig = wrapperConfigIdSystems.filter(idSystem => idSystem.includes('utiq'))


  const expectsUtiq = utiqDynamicSettings.length > 0 || utiqWrapperConfig.length > 0
  if (expectsUtiq) {
    if (utiqDynamicSettings.length && !utiqWrapperConfig.length) {
      console.error(domain.toUpperCase(), 'Utiq id systems are enabled in the dynamic settings, but id systems are not enabled in the wrapper config\n')
      success = false
    }

    if (utiqWrapperConfig.length && !utiqDynamicSettings.length) {
      console.error(domain.toUpperCase(), 'Utiq id systems are enabled in the wrapper config, but user ids are not set in the dynamic settings\n')
      success = false
    }

    const keys = ['utiqId', 'utiqMtpId'];
    const isBothUtiqIdSystemsEnabled = keys.every(k =>
      utiqDynamicSettings.some(userId => userId.name?.includes(k)) &&
      utiqWrapperConfig.some(idSystem => idSystem?.includes(k))
    );
    if (!isBothUtiqIdSystemsEnabled) {
      console.error(domain.toUpperCase(), 'Both utiq and utiqMtp needs to be enabled in dynamic settings and in the wrapper config\n' + JSON.stringify({ utiqDynamicSettings, utiqWrapperConfig }, null, 2))
      success = false
    }
  }


  // Non-Utiq id systems checks
  for (const idSystem of wrapperConfigIdSystems.filter(idSystem => !idSystem.includes('utiq'))) {
    const isValidIdSystem = EXPECTED_ID_SYSTEMS_SCHEMA[idSystem]
    if (!isValidIdSystem) {
      console.error(domain.toUpperCase(), `Module ${idSystem} is enabled but was not found in the expexted id systems. Must be one of ${Object.keys(EXPECTED_ID_SYSTEMS_SCHEMA).join(', ')}\n`)
      success = false
      continue
    }

    const userId = pbjsUserIds?.[EXPECTED_ID_SYSTEMS_SCHEMA[idSystem]?.alias]
    if (!userId && !idSystem.includes('utiq')) {
      console.error(domain.toUpperCase(), `${idSystem} is enabled but client-side user ID is missing\n`)
      success = false
      continue
    }

    const userIdType = userId && EXPECTED_ID_SYSTEMS_SCHEMA[idSystem].type === typeof userId
    if (!userIdType) {
      console.error(domain.toUpperCase(), `${idSystem} is enabled but client-side user ID is of different expected schema type\n`)
      success = false
      continue
    }
  }

  const filteredLogs = prebidLogs.filter(log => log.text.includes('INFO: User ID - usersync config updated for'))
  const idxSuccessfulUserSyncLog = filteredLogs.findIndex((log) => log.text.includes(`usersync config updated for ${wrapperConfigIdSystems.length.toString()}`))
  if (!prebidLogs.length) {
    console.error(domain.toUpperCase(), 'No logs found\n')
    success = false
  }
  else if (!filteredLogs.length) {
    console.error(domain.toUpperCase(), 'No user sync logs found\n')
    success = false
  } else if (idxSuccessfulUserSyncLog === -1) {
    console.error(domain.toUpperCase(), 'User sync update log found, but not all id systems were updated:', { idSystems: wrapperConfigIdSystems, logs: filteredLogs.map(log => log.text.slice(110)) })
    success = false
  }

  if (success) {
    console.log('All configured id systems are enabled, their respective client-side user IDs are present and Prebid user sync was successful.\n')
    console.log('\x1b[32m--------ID SYSTEMS TEST SUCCEDED--------\x1b[0m\n')
    return true
  } else {
    console.log('\n\x1b[31m--------ID SYSTEMS TEST FAILED--------\x1b[0m')
  }
}