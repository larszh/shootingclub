// PM2-Konfiguration für CloudPanel (Node.js-Site).
// Start:  npx pm2 start ecosystem.config.cjs
// Update: bash scripts/deploy.sh
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const port = process.env.PORT || "3000";

module.exports = {
  apps: [
    {
      name: "standchef",
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${port}`,
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: port,
        TZ: "Europe/Zurich",
      },
    },
  ],
};
