const fs = require('fs');
const vm = require('vm');
const path = require('path');

const APP_PATH = path.join(__dirname, '..', 'App.tsx');
const OUT_PATH = path.join(__dirname, '..', 'backend', 'seed_data_full.json');

const src = fs.readFileSync(APP_PATH, 'utf8');

const start = src.indexOf('const appData =');
if (start === -1) {
  console.error('Could not find "const appData =" in App.tsx');
  process.exit(2);
}

// find the opening brace
const eqIndex = src.indexOf('=', start);
const braceIndex = src.indexOf('{', eqIndex);
if (braceIndex === -1) {
  console.error('Could not find opening brace for appData');
  process.exit(2);
}

// extract until the matching closing brace for the object
let i = braceIndex;
let depth = 0;
let endIndex = -1;
for (; i < src.length; i++) {
  const ch = src[i];
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) { endIndex = i; break; }
  }
}
if (endIndex === -1) { console.error('Could not find end of appData object'); process.exit(2); }

let objText = src.substring(braceIndex, endIndex + 1);

// Instead of trying to text-replace every pattern, provide a small runtime stub
// for `enforceChoices(level, arr)` when evaluating the object below. This
// handles patterns like `enforceChoices('Easy', [...])` by returning the
// provided array.

// Remove TypeScript type annotations like : any, : string, etc. (simple patterns)
objText = objText.replace(/:\s*any/g, '');
objText = objText.replace(/:\s*string/g, '');
objText = objText.replace(/:\s*number/g, '');

// Some strings use $ in LaTeX like $N(t) = ...$ — that's fine. Ensure backticks are preserved.
// Attempt to evaluate the object within a VM, exposing minimal globals.
const wrapped = '(function(){\nreturn ' + objText + '\n})();';
try {
  const script = new vm.Script(wrapped, { filename: 'appdata.vm.js' });
  // Provide a safe context. Use a Proxy so any unknown helper used in the
  // `appData` object (like `enforceChoices`, `makeQuestion`, etc.) becomes a
  // no-op function that returns the first array argument it receives. This
  // allows the object to be evaluated even when helper functions are defined
  // elsewhere in the app.
  const base = {
    // Keep a specific helpful stub for enforceChoices too (backwards compat).
    enforceChoices: (level, arr) => {
      if (Array.isArray(level) && arr === undefined) return level;
      return arr;
    }
  };

  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Some internals may request Symbol.unscopables or other symbols.
      if (typeof prop === 'symbol') return undefined;
      // Return a generic stub function for any unknown global helper.
      const fn = (...args) => {
        for (let i = 0; i < args.length; i++) {
          if (Array.isArray(args[i])) return args[i];
        }
        return args[0];
      };
      // Cache the generated function so repeated calls use same reference.
      target[prop] = fn;
      return fn;
    }
  };

  const proxy = new Proxy(base, handler);
  const context = vm.createContext(proxy);
  const result = script.runInContext(context, { timeout: 2000 });
  const output = { quizzes: result.quizzes || [], books: result.books || [] };
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log('Wrote', OUT_PATH);
} catch (e) {
  console.error('Failed to evaluate extracted appData:', e && e.message ? e.message : e);
  process.exit(3);
}
