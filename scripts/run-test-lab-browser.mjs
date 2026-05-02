#!/usr/bin/env node
/**
 * Browser-based integration test using Playwright.
 * Opens the test-lab page in headless browser and validates self-test results.
 *
 * Usage: node scripts/run-test-lab-browser.mjs
 * Requires: npm run dev (server running)
 * Optional: TEST_BASE_URL=http://localhost:3000 node scripts/run-test-lab-browser.mjs
 */

import { spawnSync } from "node:child_process";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const testUrl = `${baseUrl.replace(/\/$/, "")}/test-lab`;

async function assertServerReady() {
  try {
    const response = await fetch(testUrl, { method: "HEAD" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`Cannot reach ${testUrl}. Start the app with npm run dev first.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await assertServerReady();

const checkScript = `
  const path = require("node:path");
  const npxBin = process.env.PATH
    .split(path.delimiter)
    .find((entry) => entry.includes("_npx") && entry.endsWith(path.join("node_modules", ".bin")));
  const { chromium } = require(npxBin ? path.join(npxBin, "..", "playwright") : "playwright");

  (async () => {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      if (!String(error).includes("Executable doesn't exist")) throw error;
      browser = await chromium.launch({ channel: "chrome", headless: true });
    }
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(${JSON.stringify(testUrl)}, { waitUntil: "networkidle" });
    const text = await page.locator("body").innerText();
    const summaryRaw = await page.locator("#self-test-summary").textContent();
    const summary = JSON.parse(summaryRaw);
    await browser.close();

    console.log(text);
    if (!summary.allPass || summary.failed !== 0 || summary.passed !== summary.total) {
      console.error("Browser test lab did not report a structured all-pass summary.");
      console.error(JSON.stringify(summary, null, 2));
      process.exit(1);
    }
    console.log("Browser test lab reports ALL PASS.", summary);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
`;

console.log(`Opening browser test lab: ${testUrl}`);
const result = spawnSync(
  "npx",
  ["--yes", "--package", "playwright", "node", "-e", checkScript],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }
);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
