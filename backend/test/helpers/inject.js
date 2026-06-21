/**
 * Replaces a module in the require cache BEFORE the unit under test requires it,
 * so controllers/services that do `require('../config/supabase')`, `require('stripe')`,
 * etc. receive our test double instead of the real implementation.
 *
 * node --test runs each *.test.js file in its own child process, so cache edits
 * made here never leak between test files.
 */
function injectModule(request, exportsObj) {
  const resolved = require.resolve(request);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsObj,
    children: [],
    paths: [],
  };
  return resolved;
}

module.exports = { injectModule };
