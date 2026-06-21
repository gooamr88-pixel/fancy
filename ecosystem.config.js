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
        PORT: 3000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      merge_logs: true
    }
  ]
};
