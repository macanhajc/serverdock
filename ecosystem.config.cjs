module.exports = {
  apps: [
    {
      name: 'serverdock',
      script: './backend/src/index.js',
      cwd: '/opt/serverdock',
      watch: false,
      restart_delay: 3000,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
