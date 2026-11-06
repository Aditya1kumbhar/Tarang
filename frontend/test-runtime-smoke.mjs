import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

// Production bundle path
const frontendDir = path.dirname(new URL(import.meta.url).pathname);
const distDir = path.resolve(frontendDir, 'dist');
const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

// Extract bundle JS name
const scriptMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
if (!scriptMatch) {
  console.error('Failed to locate bundle script in index.html');
  process.exit(1);
}
const bundleRelPath = scriptMatch[1].replace(/^\//, '');
const bundleAbsPath = path.join(distDir, bundleRelPath);

console.log(`[Smoke Test] Bundle: ${bundleRelPath}`);
console.log(`[Smoke Test] Bundle Size: ${(fs.statSync(bundleAbsPath).size / 1024).toFixed(2)} kB`);

const harboursList = [
  { id: 'rameswaram', name: 'Rameswaram', lat: 9.28, lon: 79.31, state: 'Tamil Nadu', regional_language: 'Tamil' }
];
const emptyGeoJSON = { type: 'FeatureCollection', features: [] };

async function runRenderScenario(name, authConfig) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url: 'https://tarang-0v0t.onrender.com',
    pretendToBeVisual: true
  });

  // Polyfill window / document globals
  for (const key of Object.getOwnPropertyNames(dom.window)) {
    if (!(key in globalThis)) {
      try {
        globalThis[key] = dom.window[key];
      } catch (_) {}
    }
  }
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  const uncaughtExceptions = [];
  dom.window.addEventListener('error', (e) => uncaughtExceptions.push(e.message || String(e.error)));

  globalThis.fetch = async (url) => {
    if (url === '/api/v1/auth/me') {
      return authConfig;
    }
    if (url === '/api/v1/harbours') {
      return { ok: true, status: 200, json: async () => harboursList };
    }
    if (url.includes('/summary')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          harbour: 'Rameswaram',
          risk_level: 'LOW RISK',
          safety_index: 88,
          timestamp: new Date().toISOString(),
          is_stale: false,
          is_baseline: false,
          data_mode: 'live'
        })
      };
    }
    if (url.includes('/geofences/')) {
      return { ok: true, status: 200, json: async () => emptyGeoJSON };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };

  // Dynamically load the compiled production bundle
  await import(bundleAbsPath + '?case=' + name + '&t=' + Date.now());
  await new Promise((r) => setTimeout(r, 600));

  const rootEl = dom.window.document.getElementById('root');
  const rootText = rootEl ? rootEl.textContent : '';
  const isRecoveryScreen = rootText.includes('ORCA Interface Recovery');

  return {
    name,
    isRecoveryScreen,
    uncaughtCount: uncaughtExceptions.length,
    uncaughtExceptions,
    textLength: rootText.length,
    sample: rootText.slice(0, 120).replace(/\s+/g, ' ')
  };
}

async function main() {
  console.log('\n--- EXECUTING RUNTIME SMOKE TESTS ---');

  // Scenario 1: Unauthenticated Session (First-time visitor) -> Should render LoginPage
  const unauthResult = await runRenderScenario('Unauthenticated (LoginPage)', {
    ok: false,
    status: 401,
    json: async () => ({ detail: 'Not authenticated' })
  });
  console.log(`\nScenario 1: ${unauthResult.name}`);
  console.log(`  - Recovery Screen Triggered: ${unauthResult.isRecoveryScreen ? 'FAIL (YES)' : 'PASS (NO)'}`);
  console.log(`  - Uncaught Errors: ${unauthResult.uncaughtCount}`);
  console.log(`  - Render Sample: "${unauthResult.sample}"`);

  // Scenario 2: Authenticated Session -> Should render Operational Console
  const authResult = await runRenderScenario('Authenticated (Operational Console)', {
    ok: true,
    status: 200,
    json: async () => ({
      authenticated: true,
      user: { email: 'operator@orca.gov.in', name: 'Officer Rameswaram', picture: '' }
    })
  });
  console.log(`\nScenario 2: ${authResult.name}`);
  console.log(`  - Recovery Screen Triggered: ${authResult.isRecoveryScreen ? 'FAIL (YES)' : 'PASS (NO)'}`);
  console.log(`  - Uncaught Errors: ${authResult.uncaughtCount}`);
  console.log(`  - Render Sample: "${authResult.sample}"`);

  if (unauthResult.isRecoveryScreen || authResult.isRecoveryScreen || unauthResult.uncaughtCount > 0 || authResult.uncaughtCount > 0) {
    console.error('\nFAIL: Runtime smoke check encountered errors or recovery screen!');
    process.exit(1);
  }

  console.log('\nALL RUNTIME SMOKE CHECKS PASSED: Zero render errors, zero recovery screens triggered.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
