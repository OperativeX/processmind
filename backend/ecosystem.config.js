module.exports = {
  apps: [
    {
      // Main API Server with Cluster Mode
      name: 'process-mind-api',
      script: './src/server.js',
      instances: process.env.PM2_INSTANCES || 2, // 2 instances for development
      exec_mode: 'cluster',
      instance_var: 'INSTANCE_ID',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DISABLE_WORKERS: 'true' // Workers run in separate process now
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
        DISABLE_WORKERS: 'true',
        watch: false
      },
      error_file: './logs/pm2-api-error.log',
      out_file: './logs/pm2-api-out.log',
      log_file: './logs/pm2-api-combined.log',
      time: true,
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Performance optimizations
      node_args: '--max-old-space-size=1024 --optimize-for-size',
      // Auto-restart on failure
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Cluster settings
      wait_ready: false,
      // Monitoring
      pmx: true
    },
    {
      // Queue Worker Process (Single Instance)
      name: 'process-mind-worker',
      script: './src/workers/queue-worker-process.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '2G', // Higher limit for video processing
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
      // Memory optimization for video processing
      node_args: '--max-old-space-size=2048 --expose-gc',
      // Auto-restart settings
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      // Longer timeout for video processing
      kill_timeout: 30000
    },
    {
      // Heavy Processing Worker (Video/Audio Processing)
      name: 'process-mind-heavy-worker',
      script: './src/workers/heavy-worker-process.js',
      instances: process.env.HEAVY_WORKER_INSTANCES || 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '3G',
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'heavy',
        UV_THREADPOOL_SIZE: 8 // Increase thread pool for FFmpeg
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
      // Memory and CPU optimization
      node_args: '--max-old-space-size=3072 --expose-gc --use-largepages=silent',
      // Auto-restart settings
      autorestart: true,
      max_restarts: 3,
      min_uptime: '60s',
      // Very long timeout for video processing
      kill_timeout: 60000
    },
    {
      // Scheduled Tasks Worker (Cleanup, Statistics)
      name: 'process-mind-scheduler',
      script: './src/workers/scheduler-process.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
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
      // Lower memory footprint
      node_args: '--max-old-space-size=512',
      // Auto-restart settings
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      // Cron-like restart (daily at 3 AM)
      cron_restart: '0 3 * * *'
    }
  ],

  // Deploy configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: process.env.DEPLOY_HOST,
      ref: 'origin/main',
      repo: process.env.DEPLOY_REPO,
      path: '/var/www/process-mind',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production server"'
    },
    staging: {
      user: 'deploy',
      host: process.env.STAGING_HOST,
      ref: 'origin/develop',
      repo: process.env.DEPLOY_REPO,
      path: '/var/www/process-mind-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development'
    }
  }
};