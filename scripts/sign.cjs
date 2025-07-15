const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execAsync = util.promisify(exec);

async function signApp() {
  try {
    console.log('Starting app signing process...');
    
    // Get the app path from the release directory
    const appPath = path.join(__dirname, '../release/mac-arm64/Local Ai.app');
    const { APPLE_TEAM_ID } = process.env;
    if (!APPLE_TEAM_ID) {
      console.error('Missing APPLE_TEAM_ID environment variable. Please set it before running the script.');
      process.exit(1);
    };
    
    // First, remove any existing signatures
    console.log('Removing existing signatures...');
    await execAsync(`codesign --remove-signature "${appPath}"`);
    
    // Sign the app with the Developer ID
    console.log('Signing the app...');
    const signCommand = [
      'codesign',
      '--force',
      '--options', 'runtime',
      '--sign', APPLE_TEAM_ID,
      '--deep',
      '--entitlements', '"build/entitlements.mac.plist"',
      '--verbose=2',
      `"${appPath}"`
    ].join(' ');
    
    const { stdout, stderr } = await execAsync(signCommand);
    console.log('Signing output:', stdout);
    if (stderr) console.error('Signing errors:', stderr);
    
    // Verify the signature
    console.log('Verifying signature...');
    const verifyCommand = `codesign --verify --deep --strict --verbose=2 "${appPath}"`;
    const { stdout: verifyOut, stderr: verifyErr } = await execAsync(verifyCommand);
    
    if (verifyOut) console.log('Verification output:', verifyOut);
    if (verifyErr) console.log('Verification details:', verifyErr);
    
    console.log('App signing completed successfully!');
    
  } catch (error) {
    console.error('Error during signing process:', error);
    process.exit(1);
  }
}

signApp();
