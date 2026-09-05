// Ad-hoc code-signs the Mac build so Apple Silicon doesn't show a false
// "app is damaged" Gatekeeper error on unsigned arm64 binaries. This is a
// self-signature (no Apple Developer account), so the normal "unidentified
// developer" warning still appears — see roadmap item #39 for real signing.
// No-ops on every other platform.
const { execFileSync } = require('node:child_process')
const path = require('node:path')

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--deep', '--force', '--sign', '-', appPath], { stdio: 'inherit' })
}
