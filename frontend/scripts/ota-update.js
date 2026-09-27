#!/usr/bin/env node
/**
 * Publish an over-the-air update to installed apps.
 *
 *   npm run update:production -- "Новые эффекты и исправления"
 *   npm run update:preview    -- "Тест нового экрана"
 *
 * Why a wrapper instead of plain `eas update`:
 * EXPO_PUBLIC_* values are baked into the JS bundle at publish time. A bare
 * `eas update` would take them from frontend/.env — i.e. your LAN address —
 * and every phone in the world would start calling 192.168.x.x. This script
 * takes EXPO_PUBLIC_BACKEND_URL from the matching build profile in eas.json
 * (the same value the store build was made with) and refuses to publish while
 * it still says REPLACE-WITH-YOUR-DOMAIN.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const channel = process.argv[2] || "production";
const message = process.argv.slice(3).join(" ").trim() || `Update ${new Date().toISOString()}`;

const eas = require(path.join(__dirname, "..", "eas.json"));
const profile = (eas.build || {})[channel];

if (!profile) {
  console.error(`✖ No build profile "${channel}" in eas.json.`);
  process.exit(1);
}

const env = { ...process.env, ...(profile.env || {}) };
const backend = env.EXPO_PUBLIC_BACKEND_URL || "";

if (!backend || backend.includes("REPLACE") || /\/\/(192\.168|10\.|127\.|localhost)/.test(backend)) {
  console.error(
    `✖ EXPO_PUBLIC_BACKEND_URL for "${channel}" is "${backend || "(empty)"}".\n` +
      `  Put your public https address into eas.json → build.${channel}.env first.`,
  );
  process.exit(1);
}

console.log(`→ Publishing to channel "${channel}" (backend ${backend})`);
console.log(`→ Message: ${message}\n`);

const result = spawnSync(
  "npx",
  ["eas-cli@latest", "update", "--channel", channel, "--message", JSON.stringify(message), "--non-interactive"],
  { stdio: "inherit", env, shell: true },
);

process.exit(result.status ?? 1);
