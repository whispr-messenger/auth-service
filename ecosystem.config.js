module.exports = {
  apps: [
    {
      name: 'auth-service',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      min_uptime: '10s',
      max_restarts: 10,
      kill_timeout: 5000,
      listen_timeout: 3000,
      health_check_grace_period: 3000,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'dist'],
      env_file: '.env.production',
    },
  ],
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-production-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/auth-service.git',
      path: '/var/www/auth-service',
      'post-deploy':
        'npm ci --only=production && npm run build && npm run migration:run && pm2 reload ecosystem.config.js --env production && pm2 save',
    },
    staging: {
      user: 'deploy',
      host: ['your-staging-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-username/auth-service.git',
      path: '/var/www/auth-service-staging',
      'post-deploy':
        'npm ci && npm run build && npm run migration:run && pm2 reload ecosystem.config.js --env staging && pm2 save',
    },
  },
};
