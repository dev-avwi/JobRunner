const { execSync } = require('child_process');

// JobRunner runs Puppeteer against the system Chromium provided by Nix
// (see the `chromium` package in .replit [nix]). It never needs Puppeteer's
// own bundled browser, so we skip that download. The download is a network
// fetch from Google's servers that runs during `npm install`; on the deploy
// builder it is the most failure-prone step of the build, and it is pure waste
// here because we point every launch at the system Chromium below.
function resolveChromium() {
  try {
    return execSync('which chromium').toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

const executablePath = resolveChromium();

/** @type {import('puppeteer').Configuration} */
module.exports = {
  skipDownload: true,
  ...(executablePath ? { executablePath } : {}),
};
