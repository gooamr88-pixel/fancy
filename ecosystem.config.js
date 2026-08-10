module.exports = {
  apps: [
    {
      name: 'fancy-rsvp-backend',
      script: 'server.js',
      cwd: './backend',
      // One worker per CPU core for real horizontal capacity. Cluster mode is safe
      // here: this API does not serve inbound WebSockets (Supabase Realtime is an
      // OUTBOUND client connection), so no sticky-session requirement.
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      // Raised from 500M: under load (large RSVP lists, exceljs exports, 5MB JSON
      // bodies) a worker could cross 500M and restart mid-request, dropping traffic.
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        // Size the libuv threadpool to the box so concurrent PBKDF2 password
        // hashes (login/register/reset) don't queue behind the default of 4.
        UV_THREADPOOL_SIZE: 16
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      merge_logs: true
    },
    {
      name: 'fancy-rsvp-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Server-side rendering talks to the backend over loopback. Without this,
        // Server Components fall back to NEXT_PUBLIC_API_URL (the PUBLIC hostname),
        // so every SSR request hairpins out through nginx and back — landing on the
        // API as traffic from the box's own address. That collapses all server
        // rendering onto ONE rate-limit key and adds a TLS round trip per render.
        // Not NEXT_PUBLIC_*: this must never be inlined into the client bundle, and
        // it's read at runtime by `next start`, so no rebuild is needed to change it.
        INTERNAL_API_URL: 'http://127.0.0.1:5000/api/v1'
        // REVALIDATE_SECRET is deliberately NOT set here — this file is committed.
        // Put it in frontend/.env (Next reads it at runtime, no rebuild needed) and
        // set the SAME value as backend/.env. The backend posts to
        // /api/internal/revalidate on this process to drop a cached event page the
        // moment the event changes; on a mismatch the purge is refused and pages
        // stay stale for up to 60s. Unset on both sides is a supported degraded
        // mode — the backend logs a warning per change instead of failing.
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      merge_logs: true
    }
  ]
};
