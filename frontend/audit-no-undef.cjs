const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const srcDir = path.resolve(__dirname, 'src');
const files = walk(srcDir);
console.log(`Audited ${files.length} source files in frontend/src:\n`);

const reactHooks = [
  'useState',
  'useEffect',
  'useCallback',
  'useRef',
  'useMemo',
  'useContext',
  'useReducer',
  'useId'
];

let defectCount = 0;

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const usedHooks = reactHooks.filter(hook => new RegExp('\\b' + hook + '\\b').test(content));
  const importedHooks = [];
  const importMatch = content.match(/import\s+[^'"]*\{([^}]+)\}[^'"]*from\s+['"]react['"]/);
  if (importMatch) {
    importedHooks.push(...importMatch[1].split(',').map(s => s.trim().replace(/^.*as\s+/, '')));
  }
  const hasReactNamespace = /import\s+React\b/.test(content);

  const missing = usedHooks.filter(h => {
    if (importedHooks.includes(h)) return false;
    // Check if it is only ever used as React.<hook>
    const bareUsage = new RegExp('(?<!React\\.)\\b' + h + '\\b').test(content);
    if (!bareUsage && hasReactNamespace) return false;
    return true;
  });

  const rel = path.relative(srcDir, f);
  if (missing.length > 0) {
    defectCount++;
    console.log(`  [DEFECT] ${rel}: Missing imports: ${missing.join(', ')}`);
  } else {
    console.log(`  [PASS] ${rel} (used: ${usedHooks.length > 0 ? usedHooks.join(', ') : 'none'})`);
  }
});

console.log(`\nAudit finished: ${files.length} files scanned, ${defectCount} defects found.`);
process.exit(defectCount > 0 ? 1 : 0);
