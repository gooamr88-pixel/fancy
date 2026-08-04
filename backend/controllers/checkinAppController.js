/**
 * Fancy Check-in app — release metadata and the signed download.
 *
 * The Android door app is distributed as a signed APK from the organizer's own
 * dashboard rather than a store, so this is the whole delivery path. Two
 * deliberate properties:
 *
 *  • The artefact is NOT in this repo and NOT pinned in code. Everything comes
 *    from `super_admin_config.checkin_app`, so publishing a new build is
 *    uploading a file and editing config — not a deploy. A hardcoded version
 *    here would go stale the first time anyone shipped a hotfix.
 *
 *  • `enabled` is a hard readiness switch, separate from the feature gate. The
 *    feature gate answers "has this event paid for it"; `enabled` answers "is
 *    this build fit to stand at a door". The app has real unit coverage but has
 *    never run on physical hardware (android/README.md), and the first failure
 *    would be a queue at a wedding. It ships false and the admin opens it.
 */
const { getPlatformConfig } = require('../utils/configCache');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { sendOk, sendFail } = require('../utils/responseEnvelope');

const BUCKET = 'checkin-app';
// Long enough to survive a slow venue connection starting the transfer, short
// enough that a URL copied out of devtools is worthless by the time it is
// shared. The redirect is followed immediately; this is not a shareable link.
const SIGNED_URL_TTL_SECONDS = 120;

/** The admin-managed release record, with every field defaulted. */
function readReleaseConfig(config) {
  const r = (config && config.checkin_app) || {};
  return {
    enabled: r.enabled === true,
    version: String(r.version || ''),
    versionCode: Number(r.versionCode) || 0,
    minAndroid: String(r.minAndroid || '8.0'),
    sizeBytes: Number(r.sizeBytes) || 0,
    sha256: String(r.sha256 || ''),
    releaseNotes: String(r.releaseNotes || ''),
    releasedAt: r.releasedAt || null,
    storagePath: String(r.storagePath || ''),
  };
}

/**
 * What the dashboard needs to render the download card.
 * GET /api/v1/events/:eventId/checkin-app/release
 *
 * `storagePath` is deliberately NOT returned. It is the object key inside a
 * private bucket; publishing it would let a caller skip the download route,
 * and with it the feature gate, the readiness switch and the audit row.
 */
const getRelease = async (req, res, next) => {
  try {
    const release = readReleaseConfig(await getPlatformConfig());
    return sendOk(res, {
      // "available" folds together the two things the UI has to distinguish
      // from "not entitled": there IS a build, and it has been opened up.
      available: release.enabled && !!release.storagePath,
      version: release.version,
      versionCode: release.versionCode,
      minAndroid: release.minAndroid,
      sizeBytes: release.sizeBytes,
      sha256: release.sha256,
      releaseNotes: release.releaseNotes,
      releasedAt: release.releasedAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Redirects to a short-lived signed URL for the APK.
 * GET /api/v1/events/:eventId/checkin-app/download
 *
 * A 302 rather than streaming the bytes through Node: the file is ~60 MB and
 * proxying it would tie up an API worker for the length of a venue's upload.
 */
const downloadApk = async (req, res, next) => {
  const { eventId } = req.params;
  try {
    const release = readReleaseConfig(await getPlatformConfig());

    if (!release.enabled || !release.storagePath) {
      return sendFail(res, {
        status: 403,
        error: 'RELEASE_UNAVAILABLE',
        message: 'The Fancy Check-in app is not available for download yet. We will email you as soon as it opens.',
      });
    }

    const { data, error } = await supabase
      .storage
      .from(BUCKET)
      .createSignedUrl(release.storagePath, SIGNED_URL_TTL_SECONDS, {
        download: `fancy-checkin-${release.version || 'latest'}.apk`,
      });

    if (error || !data?.signedUrl) {
      // The config points at something the bucket does not have — an admin
      // typo or a half-finished upload. That is an operator error, not the
      // organizer's, so it must be loud in the logs and gentle on screen.
      logger.error({ err: error, storagePath: release.storagePath, eventId }, 'checkin-app: could not sign the release URL');
      return sendFail(res, {
        status: 503,
        error: 'RELEASE_UNAVAILABLE',
        message: 'The download is temporarily unavailable. Please try again shortly.',
      });
    }

    // Who pulled which build, for support ("they said it was v1.2") and for
    // knowing whether a bad build reached anyone. Best-effort: a failed audit
    // row must not deny an entitled organizer their download.
    supabase.from('activity_logs').insert({
      event_id: eventId,
      action: 'checkin_app_downloaded',
      entity_type: 'event',
      entity_id: eventId,
      metadata: { version: release.version, versionCode: release.versionCode, userId: req.user?.id || null },
    }).then(() => {}, (logErr) => logger.error({ err: logErr, eventId }, 'checkin-app: download audit row failed'));

    return res.redirect(302, data.signedUrl);
  } catch (err) {
    next(err);
  }
};

module.exports = { getRelease, downloadApk, readReleaseConfig };
