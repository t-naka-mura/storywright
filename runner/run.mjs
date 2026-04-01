#!/usr/bin/env node
/**
 * Storywright Playwright Runner
 *
 * Usage: echo '{"id":"...","title":"...","steps":[...]}' | node run.mjs
 *
 * Reads a Story JSON from stdin, executes each step using Playwright,
 * and outputs a StoryResult JSON to stdout.
 */

import { chromium } from "playwright";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function resolveUrl(target, baseUrl) {
  if (/^https?:\/\//.test(target)) return target;
  const base = baseUrl?.replace(/\/$/, "") ?? "";
  return base + (target.startsWith("/") ? target : "/" + target);
}

async function executeStep(page, step, baseUrl) {
  const start = Date.now();
  try {
    switch (step.action) {
      case "navigate":
        await page.goto(resolveUrl(step.target, baseUrl), { waitUntil: "domcontentloaded" });
        break;
      case "click":
        await page.locator(step.target).click({ timeout: 10000 });
        break;
      case "type":
        await page.locator(step.target).fill(step.value, { timeout: 10000 });
        break;
      case "select":
        await page.locator(step.target).selectOption(step.value, { timeout: 10000 });
        break;
      case "assert": {
        const el = page.locator(step.target);
        await el.waitFor({ timeout: 10000 });
        const text = await el.textContent();
        if (!text?.includes(step.value)) {
          throw new Error(
            `Assertion failed: expected "${step.value}" in "${text}"`,
          );
        }
        break;
      }
      case "wait":
        if (step.value === "hidden") {
          await page.locator(step.target).waitFor({ state: "hidden", timeout: 10000 });
        } else {
          await page.locator(step.target).waitFor({ state: "visible", timeout: 10000 });
        }
        break;
      case "screenshot":
        // skip for now
        break;
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
    return {
      order: step.order,
      status: "passed",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      order: step.order,
      status: "failed",
      durationMs: Date.now() - start,
      error: err.message,
    };
  }
}

async function main() {
  const input = await readStdin();
  const story = JSON.parse(input);

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const stepResults = [];
  let storyStatus = "passed";

  for (const step of story.steps) {
    if (storyStatus === "failed") {
      stepResults.push({
        order: step.order,
        status: "skipped",
        durationMs: 0,
      });
      continue;
    }

    const result = await executeStep(page, step, story.baseUrl);
    stepResults.push(result);

    if (result.status === "failed") {
      storyStatus = "failed";
    }
  }

  await browser.close();

  const output = {
    storyId: story.id,
    status: storyStatus,
    stepResults,
  };

  process.stdout.write(JSON.stringify(output));
}

main().catch((err) => {
  const output = {
    storyId: "unknown",
    status: "failed",
    stepResults: [
      {
        order: 0,
        status: "failed",
        durationMs: 0,
        error: err.message,
      },
    ],
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(1);
});
