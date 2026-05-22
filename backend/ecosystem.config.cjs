module.exports = {
  apps: [
    {
      name: 'stayonmap-api',
      script: 'src/index.js',
      instances: 'max',        // one worker per CPU core
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
