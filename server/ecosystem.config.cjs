// PM2 进程配置：pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'savoru',
      script: 'src/index.js',
      node_args: '--env-file=.env',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
      out_file: './logs/out.log',
      error_file: './logs/err.log',
      merge_logs: true,
      time: true,
    },
  ],
};