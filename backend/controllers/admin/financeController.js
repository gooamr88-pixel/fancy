const { supabase } = require('../../config/supabase');

/**
 * Financial Command Center (Master Plan §22). Reads the mv_daily_revenue rollup
 * (refreshed by the analytics job) to report gross / net / refunded / platform
 * profit over a date range, plus a simple linear forecast.
 */

/** GET /api/v1/admin/finance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD */
const getFinancialSummary = async (req, res, next) => {
  try {
    // Default window: last 30 days.
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const [{ data: rows, error }, { data: config }] = await Promise.all([
      supabase
        .from('mv_daily_revenue')
        .select('day, gross_cents, refunded_cents, net_cents, payment_count')
        .gte('day', fromStr)
        .lte('day', toStr)
        .order('day', { ascending: true }),
      supabase.from('super_admin_config').select('platform_commission_pct').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle(),
    ]);
    if (error) throw error;

    const series = rows || [];
    const totals = series.reduce(
      (acc, r) => {
        acc.grossCents += r.gross_cents || 0;
        acc.refundedCents += r.refunded_cents || 0;
        acc.netCents += r.net_cents || 0;
        acc.paymentCount += r.payment_count || 0;
        return acc;
      },
      { grossCents: 0, refundedCents: 0, netCents: 0, paymentCount: 0 }
    );

    const commissionPct = Number(config?.platform_commission_pct) || 0;
    const platformProfitCents = Math.round((totals.netCents * commissionPct) / 100);

    // Simple linear forecast: average daily net over the window, projected 30 days.
    const days = Math.max(1, series.length);
    const avgDailyNet = totals.netCents / days;
    const forecastNext30Cents = Math.round(avgDailyNet * 30);

    return res.json({
      success: true,
      finance: {
        range: { from: fromStr, to: toStr },
        totals: { ...totals, platformProfitCents, commissionPct },
        series,
        forecast: { avgDailyNetCents: Math.round(avgDailyNet), next30DaysNetCents: forecastNext30Cents },
      },
    });
  } catch (err) {
    // A missing materialized view (migration not yet applied) yields a clear hint.
    if (err && (err.code === 'PGRST205' || /mv_daily_revenue/.test(err.message || ''))) {
      return res.status(503).json({
        success: false,
        error: 'ROLLUP_UNAVAILABLE',
        message: 'mv_daily_revenue is not available yet. Apply the overview/finance migration.',
      });
    }
    next(err);
  }
};

module.exports = { getFinancialSummary };
