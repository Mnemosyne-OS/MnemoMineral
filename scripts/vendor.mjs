/*
 * Fetch the two libraries this cartridge ships with.
 *
 * There is no bundler here on purpose. The cartridge is plain ES modules plus
 * one UMD viewer, so it needs no `pnpm install`, adds nothing to the shared
 * lockfile, and installs as-is. That matters tonight because three sessions are
 * working this repo and a concurrent install is the one operation that corrupts
 * a pnpm store (doc 116 section 0.3).
 */
import fs from 'node:fs';
import path from 'node:path';

const VENDOR = path.join(process.cwd(), 'vendor');

// Pinned exactly. An unpinned viewer is a different viewer on the next build,
// and the gate's numbers were measured against this one.
const THREEDMOL = 'https://cdn.jsdelivr.net/npm/3dmol@2.5.2/build/3Dmol-min.js';
const SDK = 'https://cdn.jsdelivr.net/npm/@mnemosyne_os/cartridge-sdk@0.4.1/dist/index.js';
// Built copy in this monorepo, when the worktree has one. dist/ is gitignored,
// so a fresh worktree does not -- which is why the CDN is the source and this is
// only the cross-check.
const SDK_LOCAL = path.join(process.cwd(), '..', '..', 'packages', 'cartridge-sdk', 'dist', 'index.js');

async function main() {
  fs.mkdirSync(VENDOR, { recursive: true });

  const res = await fetch(THREEDMOL, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error('3Dmol download failed: HTTP ' + res.status);
  const js = await res.text();
  if (!js.includes('$3Dmol')) throw new Error('3Dmol download does not look like 3Dmol');
  fs.writeFileSync(path.join(VENDOR, '3Dmol-min.js'), js);

  const sdkRes = await fetch(SDK, { signal: AbortSignal.timeout(120_000) });
  if (!sdkRes.ok) throw new Error('cartridge-sdk download failed: HTTP ' + sdkRes.status);
  const sdk = await sdkRes.text();
  if (!sdk.includes('MnemoCartridgeSDK')) throw new Error('cartridge-sdk download does not export MnemoCartridgeSDK');
  fs.writeFileSync(path.join(VENDOR, 'cartridge-sdk.js'), sdk);

  /*
   * Equal version numbers have served different code in this repo before, so
   * the published package is compared to the built one BYTE FOR BYTE whenever
   * both are on this machine. A mismatch is reported, never resolved silently:
   * which of the two is right is a human's call.
   */
  let sdkCheck = 'no local build to compare against';
  if (fs.existsSync(SDK_LOCAL)) {
    sdkCheck = fs.readFileSync(SDK_LOCAL, 'utf8') === sdk
      ? 'byte-identical to the local build'
      : 'DIFFERS FROM THE LOCAL BUILD -- someone must say which is right';
  }

  console.table([
    { file: 'vendor/3Dmol-min.js', kb: Math.round(js.length / 1024), source: '3dmol@2.5.2 (BSD-3)', check: 'pinned' },
    { file: 'vendor/cartridge-sdk.js', kb: Math.round(sdk.length / 1024), source: '@mnemosyne_os/cartridge-sdk@0.4.1 (MIT)', check: sdkCheck },
  ]);
  if (sdkCheck.startsWith('DIFFERS')) process.exitCode = 1;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
