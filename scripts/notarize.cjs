const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization for non-macOS platform');
    return;
  }

  // Check if notarization should be skipped for development builds
  if (process.env.SKIP_NOTARIZATION === 'true') {
    console.log('Skipping notarization (SKIP_NOTARIZATION=true)');
    return;
  }

  // Check for required environment variables
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn('Required environment variables are missing. Notarization will fail.');
    console.warn('Please ensure you have set:');
    console.warn('- APPLE_ID');
    console.warn('- APPLE_APP_SPECIFIC_PASSWORD');
    console.warn('- APPLE_TEAM_ID');
    throw new Error('Missing required environment variables for notarization');
  }

  const appName = packager.appInfo.productFilename;
  console.log(`→ Beginning notarization for ${appName}`);

  try {
    await notarize({
      appBundleId: 'com.capable.localai',
      appPath: `${appOutDir}/${appName}.app`,
      appleId: APPLE_ID,
      appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
      teamId: APPLE_TEAM_ID,
    });
    console.log('✓ Notarization completed successfully');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
