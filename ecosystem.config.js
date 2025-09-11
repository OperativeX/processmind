module.exports = {
  apps: [
    {
      // Main API Server with Cluster Mode
      name: 'processmind-api',
      script: 'src/server.js',
      instances: 2,
      exec_mode: 'cluster',
      instance_var: 'INSTANCE_ID',
      watch: false,
      max_memory_restart: '1G',
      cwd: process.env.PM2_BACKEND_CWD || './backend',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DISABLE_WORKERS: 'true'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
        DISABLE_WORKERS: 'true',
        watch: true,
        ignore_watch: ['node_modules', 'logs', 'uploads']
      },
      error_file: './logs/pm2-api-error.log',
      out_file: './logs/pm2-api-out.log',
      log_file: './logs/pm2-api-combined.log',
      time: true,
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      node_args: '--max-old-space-size=1024',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      // Queue Worker Process (Single Instance)
      name: 'processmind-worker',
      script: 'src/workers/queue-worker-process.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '2G',
      cwd: process.env.PM2_BACKEND_CWD || './backend',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'queue'
      },
      env_development: {
        NODE_ENV: 'development',
        WORKER_TYPE: 'queue',
        watch: false
      },
      error_file: './logs/pm2-worker-error.log',
      out_file: './logs/pm2-worker-out.log',
      log_file: './logs/pm2-worker-combined.log',
      time: true,
      node_args: '--max-old-space-size=2048',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      kill_timeout: 30000
    },
    {
      // Heavy Processing Worker (Video/Audio Processing) - Single instance for MVP
      name: 'processmind-heavy-worker',
      script: 'src/workers/heavy-worker-process.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '3G',
      cwd: process.env.PM2_BACKEND_CWD || './backend',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'heavy',
        UV_THREADPOOL_SIZE: 8
      },
      env_development: {
        NODE_ENV: 'development',
        WORKER_TYPE: 'heavy',
        UV_THREADPOOL_SIZE: 4,
        watch: false
      },
      error_file: './logs/pm2-heavy-worker-error.log',
      out_file: './logs/pm2-heavy-worker-out.log',
      log_file: './logs/pm2-heavy-worker-combined.log',
      time: true,
      node_args: '--max-old-space-size=3072',
      autorestart: true,
      max_restarts: 3,
      min_uptime: '60s',
      kill_timeout: 60000
    },
    {
      // Scheduled Tasks Worker (Cleanup, Statistics)
      name: 'processmind-scheduler',
      script: 'src/workers/scheduler-process.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      cwd: process.env.PM2_BACKEND_CWD || './backend',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'scheduler'
      },
      env_development: {
        NODE_ENV: 'development',
        WORKER_TYPE: 'scheduler',
        watch: false
      },
      error_file: './logs/pm2-scheduler-error.log',
      out_file: './logs/pm2-scheduler-out.log',
      log_file: './logs/pm2-scheduler-combined.log',
      time: true,
      node_args: '--max-old-space-size=512',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      cron_restart: '0 3 * * *'
    }
  ],

  // Deploy configuration for Hetzner VPS
  deploy: {
    production: {
      user: 'deploy',
      host: '188.245.198.141',
      ref: 'origin/main',
      repo: 'git@github.com:OperativeX/processmind.git',
      path: '/home/deploy/process-mind',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': ''
    }
  }
};