/**
 * Universal list pagination contract (Master Plan B3 fix / Foundation F4).
 *
 * Parses ?page&limit&sort&order&q into a normalized shape and exposes helpers
 * to apply it to a Supabase query and to build the standard list envelope:
 *
 *   { success: true, data: [...], pagination: { page, limit, total, totalPages } }
 *
 * Every admin list endpoint should use this so clients get a consistent,
 * bounded, paginated response instead of silently truncated arrays.
 */

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

/**
 * Reads pagination params off the request query.
 * @param {import('express').Request} req
 * @param {Object} [opts]
 * @param {string[]} [opts.sortable] whitelist of sortable columns
 * @param {string} [opts.defaultSort]
 */
function parsePagination(req, opts = {}) {
  const { sortable = [], defaultSort = 'created_at' } = opts;

  let page = parseInt(req.query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const requestedSort = (req.query.sort || '').toString();
  const sort = sortable.includes(requestedSort) ? requestedSort : defaultSort;

  const order = (req.query.order || 'desc').toString().toLowerCase() === 'asc' ? 'asc' : 'desc';

  const q = (req.query.q || '').toString().trim().slice(0, 200);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  return { page, limit, sort, order, q, from, to };
}

/**
 * Escapes a free-text search term for safe interpolation into a PostgREST
 * `.or()` filter string (e.g. `name.ilike.%term%,email.ilike.%term%`).
 *
 * Inside an `.or()` group PostgREST treats `,` as a condition separator and
 * `()` as grouping, so a raw user term could inject extra filter logic. Wrapping
 * the value in double quotes makes those characters literal; inner `"` and `\`
 * are backslash-escaped per the PostgREST reserved-character rules. The `%`
 * wildcards are kept outside the quoted term so ilike matching still works.
 *
 * Use this ONLY for the string-grammar `.or()`/`.filter()` form. The method form
 * `.ilike(column, value)` already sends the value as a separately-encoded
 * parameter and needs no escaping.
 *
 * @param {string} term
 * @returns {string} a quoted, escaped value safe to drop into an or-filter
 */
function escapeOrSearchTerm(term) {
  const escaped = String(term).replace(/[\\"]/g, (m) => `\\${m}`);
  return `"%${escaped}%"`;
}

/**
 * Applies sort + range to a Supabase query builder.
 * The query must have been created with `{ count: 'exact' }` for total to populate.
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder} query
 * @param {ReturnType<typeof parsePagination>} p
 */
function applyPagination(query, p) {
  return query.order(p.sort, { ascending: p.order === 'asc' }).range(p.from, p.to);
}

/**
 * Builds the standard list response envelope.
 * @param {Array} data
 * @param {ReturnType<typeof parsePagination>} p
 * @param {number} total exact row count (from Supabase count)
 */
function buildListResponse(data, p, total) {
  const safeTotal = Number.isFinite(total) ? total : (data ? data.length : 0);
  return {
    success: true,
    data: data || [],
    pagination: {
      page: p.page,
      limit: p.limit,
      total: safeTotal,
      totalPages: Math.max(1, Math.ceil(safeTotal / p.limit)),
    },
  };
}

module.exports = { parsePagination, applyPagination, buildListResponse, escapeOrSearchTerm, DEFAULT_LIMIT, MAX_LIMIT };
