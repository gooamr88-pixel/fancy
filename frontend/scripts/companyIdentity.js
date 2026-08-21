#!/usr/bin/env node
/**
 * Prints the business identity exactly as the website publishes it, for
 * pasting into a form that must match it.
 *
 *   node scripts/companyIdentity.js
 *
 * WHY THIS EXISTS. The Twilio Toll-Free Verification submission carries a
 * business name and address, and this account has already been rejected once
 * for "Business could not be verified" — the recorded cause being that the
 * site published one identity while the submission named another
 * (TWILIO_COMPLIANCE_MASTER_AUDIT.md, Rejection Reason 3). The failure was not
 * that either value was wrong; it was that they were typed in two places by
 * two people. So the form gets filled from the same constants the site renders
 * from, and nobody retypes anything.
 *
 * It also reports whether the postal address is complete, because four
 * separate obligations depend on that one answer and none of them announces
 * itself when it is missing.
 *
 * Deliberately dependency-free and CommonJS: it parses utils/company.js as
 * text rather than importing it, because that file is ESM inside a Next app
 * and this has to run with a bare `node` from a shell.
 */
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src', 'app', 'utils', 'company.js');
const src = fs.readFileSync(SRC, 'utf8');

/** Reads `export const NAME = '…';` */
function constant(name) {
  const m = src.match(new RegExp(`export const ${name} = '([^']*)'`));
  return m ? m[1] : '';
}

/** Reads one field out of the COMPANY_ADDRESS object literal. */
function addressField(field) {
  const block = src.slice(src.indexOf('export const COMPANY_ADDRESS = {'));
  const m = block.slice(0, block.indexOf('};')).match(new RegExp(`${field}: '([^']*)'`));
  return m ? m[1] : '';
}

const name = constant('COMPANY_NAME');
const email = constant('COMPANY_EMAIL');
const site = constant('COMPANY_SITE');
const instagram = constant('SOCIAL_INSTAGRAM');
const facebook = constant('SOCIAL_FACEBOOK');

const addr = {
  line1: addressField('line1'),
  line2: addressField('line2'),
  locality: addressField('locality'),
  region: addressField('region'),
  regionName: addressField('regionName'),
  postalCode: addressField('postalCode'),
  countryName: addressField('countryName'),
};
const configured = Boolean(addr.line1.trim() && addr.postalCode.trim());

const lines = configured
  ? [addr.line1, addr.line2, `${addr.locality}, ${addr.region} ${addr.postalCode}`, addr.countryName].filter(Boolean)
  : [`${addr.locality}, ${addr.regionName}, ${addr.countryName}`];

const out = [];
out.push('');
out.push('  BUSINESS IDENTITY — as published at ' + site);
out.push('  ' + '─'.repeat(64));
out.push('  Business name      ' + name);
out.push('  Website            ' + site);
out.push('  Email              ' + email);
out.push('  Address            ' + lines[0]);
lines.slice(1).forEach((l) => out.push('                     ' + l));
out.push('  Instagram          ' + instagram);
out.push('  Facebook           ' + facebook);
out.push('');
out.push('  Opt-in page        ' + site + '/sms-opt-in');
out.push('  Privacy policy     ' + site + '/privacy');
out.push('  Terms of service   ' + site + '/terms');
out.push('');

if (configured) {
  out.push('  ✓ Postal address is complete.');
  out.push('    Paste the block above into the Twilio TFV submission verbatim.');
} else {
  out.push('  ✗ NO POSTAL ADDRESS. Four obligations are unmet until this is set:');
  out.push('');
  out.push('      1. /terms      a contracting party is expected to state a');
  out.push('                     registered office.');
  out.push('      2. /privacy    GDPR Art. 13 / CCPA / PIPEDA expect an address a');
  out.push('                     data-subject request can be posted to.');
  out.push('      3. email       CAN-SPAM §7704(a)(5) and CASL REQUIRE a valid');
  out.push('                     physical mailing address in commercial email.');
  out.push('      4. Twilio TFV  the submission carries a business address and it');
  out.push('                     must match what this site publishes.');
  out.push('');
  out.push('    Set line1 and postalCode in src/app/utils/company.js, mirror them');
  out.push('    in backend/utils/emailTemplates.js, and all four resolve at once.');
  out.push('    A registered agent address or a business PO box satisfies CAN-SPAM;');
  out.push('    it does not have to be a street anyone sits at.');
}
out.push('');

// eslint-disable-next-line no-console
console.log(out.join('\n'));

// Non-zero while incomplete, so this can gate a release script rather than
// being something somebody remembers to read.
process.exit(configured ? 0 : 1);
