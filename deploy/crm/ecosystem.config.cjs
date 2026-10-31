/* global __dirname, module, require */
/**
 * PM2 processes for the CRM on the VPS:
 *   pm2 startOrReload deploy/crm/ecosystem.config.cjs --update-env && pm2 save
 *
 * One process each, in fork mode: login rate limits are kept in memory, so
 * several API processes would each allow their own quota. Move the limiter to
 * a shared store before scaling out (see docs/crm/PRODUCTION_CHECKLIST.md).
 * Each app reads its own env file (apps/crm-api/.env, apps/crm-web/.env.production).
 */
const path = require("path");

const root = path.resolve(__dirname, "../..");

module.exports = {
  apps: [
    {
      name: "crm-api",
      cwd: path.join(root, "apps/crm-api"),
      script: "dist/index.js",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
      // Longer than the API's own 10 s graceful shutdown, so requests in flight finish.
      kill_timeout: 12000,
      time: true,
    },
    {
      name: "crm-web",
      cwd: path.join(root, "apps/crm-web"),
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3100 --hostname 127.0.0.1",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "500M",
      time: true,
    },
  ],
};
