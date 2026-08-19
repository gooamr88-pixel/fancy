/**
 * Minimal Express req/res doubles for invoking controller handlers directly.
 */

function mockReq({ params = {}, body = {}, query = {}, headers = {}, cookies = {}, user, device } = {}) {
  return {
    params, body, query, cookies,
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    ip: '127.0.0.1',
    get(name) { return this.headers[String(name).toLowerCase()]; },
    user,
    // Set by requireDevice for a paired tablet. Distinct from `user`: a device
    // token identifies hardware, not a person, so handlers treat the two very
    // differently — see checkinSyncController.deleteCheckIn.
    device,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    finished: false,
    cookies: {},
    cleared: [],
  };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.finished = true; return res; };
  res.send = (b) => { res.body = b; res.finished = true; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; return res; };
  // Express exposes BOTH res.set and res.setHeader, and the marketing/public
  // controllers use `res.set('Cache-Control', …)`. Without this alias a handler
  // that sets a cache header throws a TypeError straight into next(), which the
  // caller then reads as a mysterious 500 rather than a missing double.
  res.set = (k, v) => {
    if (k && typeof k === 'object') Object.entries(k).forEach(([kk, vv]) => { res.headers[kk] = vv; });
    else res.headers[k] = v;
    return res;
  };
  res.sendFile = (p) => { res.body = `[file:${p}]`; res.finished = true; return res; };
  // Express allows redirect(url) or redirect(status, url). Without this a
  // handler that redirects throws a TypeError straight into next(), which the
  // caller then reads as a 200 with an error — a confusing way to discover the
  // double is incomplete.
  res.redirect = (a, b) => {
    const [status, url] = typeof a === 'number' ? [a, b] : [302, a];
    res.statusCode = status;
    res.redirectedTo = url;
    res.headers.Location = url;
    res.finished = true;
    return res;
  };
  res.cookie = (n, v, o) => { res.cookies[n] = { value: v, options: o }; return res; };
  res.clearCookie = (n) => { res.cleared.push(n); return res; };
  return res;
}

/**
 * Invokes an Express handler and resolves once it has responded or called next().
 * Returns { res, nextErr } so tests can assert on either path.
 */
async function invoke(handler, req, res = mockRes()) {
  let nextErr = null;
  let nextCalled = false;
  const next = (err) => { nextCalled = true; if (err) nextErr = err; };
  await handler(req, res, next);
  return { res, next: nextCalled, nextErr };
}

module.exports = { mockReq, mockRes, invoke };
