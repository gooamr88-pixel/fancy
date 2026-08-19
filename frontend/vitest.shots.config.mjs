import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.mjs';

/* ═══════════════════════════════════════════════════════════════════════════
   The screenshot harness, kept OUT of the test suite.

   The landing page shows real screenshots of real components. Producing them
   means rendering those components — which needs jsdom, the React plugin and
   every alias the app uses, i.e. the test setup. But they are not tests: they
   assert nothing, they write files, and they must not run on every `npm test`.

   So they live in `test/shots/*.dump.jsx`, which the default config's own
   include pattern (it matches only `.test.js` / `.test.jsx`) does not pick
   up, and this config points at them instead.

   Written without a glob literal on purpose: a `**` followed by a slash
   inside a block comment contains `*` + `/`, which ends the comment and the
   file stops parsing.

     npx vitest run --config vitest.shots.config.mjs

   See test/shots/templateShots.dump.jsx for what happens after — the staged
   HTML still has to be photographed by Chrome and converted.
   ═══════════════════════════════════════════════════════════════════════════ */
const config = mergeConfig(base, defineConfig({
  test: {
    // One file writing to one directory; parallelism buys nothing and makes
    // the console output interleave.
    fileParallelism: false,
  },
}));

/* ASSIGNED, not merged. mergeConfig CONCATENATES arrays, so passing `include`
   through it appends to the base pattern instead of replacing it — and this
   config then ran the entire 357-test suite before reaching the two dumps. */
config.test.include = ['test/shots/*.dump.jsx'];

export default config;
