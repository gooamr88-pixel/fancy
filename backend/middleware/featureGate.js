const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

const requirePaidEvent = (featureName) => async (req, res, next) => {
  const { eventId } = req.params;

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('id, is_paid, manual_override, status')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return res.status(404).json({
        success: false,
        error: 'EVENT_NOT_FOUND',
        message: 'Event not found.',
      });
    }

    if (event.is_paid === true || event.manual_override === true) {
      req.event = event;
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'FEATURE_REQUIRES_PAYMENT',
      feature: featureName,
      message: 'This feature requires event payment. Complete payment to activate your event and unlock all features.',
      upgrade_action: 'complete_payment',
    });
  } catch (err) {
    logger.error({ err, eventId, feature: featureName }, 'featureGate: unexpected error');
    return next(err);
  }
};

module.exports = { requirePaidEvent };
