const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { getReferralOverview } = require('../services/referralService');

/**
 * Organizer's own "My Referrals" overview: their referral code/link, credit
 * balance, and the status of everyone they've referred so far.
 * GET /api/v1/referrals/me
 */
const getMyReferralOverview = async (req, res, next) => {
  try {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_user_id', req.user.id)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ success: false, error: 'ORG_NOT_FOUND', message: 'Organization not found.' });
    }

    const overview = await getReferralOverview(org.id);
    return res.json({ success: true, ...overview });
  } catch (err) {
    logger.error({ err, userId: req.user?.id }, 'getMyReferralOverview failed');
    next(err);
  }
};

module.exports = { getMyReferralOverview };
