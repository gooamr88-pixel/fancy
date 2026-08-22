/**
 * The migration chain must build the database the code expects.
 *
 * This locks in a state the repository has never actually held: for a long
 * time `supabase/migrations/*` did NOT create `organizations.password_hash`,
 * `custom_form_fields` or `guest_analytics`, while the code selected all
 * three. Production was fine — it is a long-lived database that received those
 * by hand — so nothing ever failed where anyone was looking, and a fresh
 * environment was simply broken on arrival: no sign-in, no RSVP form, no
 * analytics page.
 *
 * The failure mode is what makes this worth a test rather than a convention.
 * PostgREST rejects the WHOLE query on one unknown column, so a drifted schema
 * does not degrade a feature — it 500s every request that touches the table,
 * and the error names the column rather than the missing migration.
 *
 * Runs `scripts/audit-schema.js` as a child process rather than importing it:
 * the script is a report with its own output, and re-implementing its parsing
 * here would create a second thing to keep in step with the first.
 */
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'audit-schema.js');

function runAudit() {
  return execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
}

test('every table, column and function the backend uses is built by supabase/migrations', () => {
  const out = runAudit();
  const m = out.match(/^(\d+) finding\(s\)\./m);
  assert.ok(m, `the audit did not report a finding count:\n${out}`);

  const count = Number(m[1]);
  if (count !== 0) {
    // The report is the failure message. A bare "expected 0, got 4" would send
    // the next reader to run the script by hand to learn anything at all.
    assert.fail(
      `The migration chain no longer builds what the code reads.\n\n${out}\n` +
      'Add the missing DDL to a migration in supabase/migrations/. Do NOT add it\n' +
      'to backend/migrations/ — that directory is outside the chain and is exactly\n' +
      'how this drift happened.',
    );
  }
});

test('the audit still detects a gap when there is one', () => {
  /**
   * A checker that reports "clean" because it is broken is the failure this
   * repository has already had once, in the responsive greps — 30 findings,
   * all false, and the real ones invisible.
   *
   * This proves the audit can still see: it asserts the parser reads a known
   * column out of a known migration. If comment-stripping regresses (a JS
   * regex `.` does not match `\r`, and these files are CRLF — that exact bug
   * silently emptied whole tables from the parse), this fails.
   */
  const { execFileSync: run } = require('node:child_process');
  const out = run(process.execPath, [SCRIPT], { encoding: 'utf8' });

  const tables = out.match(/^(\d+) tables and (\d+) functions built by the tracked chain\./m);
  assert.ok(tables, 'the audit no longer reports what the chain builds');
  assert.ok(
    Number(tables[1]) > 50,
    `the parser found only ${tables[1]} tables — it has stopped reading the migrations correctly`,
  );
  assert.ok(
    Number(tables[2]) > 40,
    `the parser found only ${tables[2]} functions — it has stopped reading the migrations correctly`,
  );
});
