// PM2-Konfiguration für CloudPanel (Node.js-Site).
// Start:  pm2 start ecosystem.config.cjs
// Update: pm2 reload standchef
module.exports = {
  apps: [
    {
      name: "standchef",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        // PORT und alle anderen Werte kommen aus .env (wird von Next.js geladen).
      },
    },
  ],
};
