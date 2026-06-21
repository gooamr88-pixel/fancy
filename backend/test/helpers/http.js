/**
 * Minimal Express req/res doubles for invoking controller handlers directly.
 */

function mockReq({ params = {}, body = {}, query = {}, headers = {}, cookies = {}, user } = {}) {
  return {
    params, body, query, cookies,
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    ip: '127.0.0.1',
    get(name) { return this.headers[String(name).toLowerCase()]; },
    user,
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
  res.sendFile = (p) => { res.body = `[file:${p}]`; res.finished = true; return res; };
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
