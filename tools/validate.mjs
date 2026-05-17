/**
 * baphomet-utils milestone validator
 *
 * Usage:
 *   node tools/validate.mjs
 *     Strict/final validation mode for milestone completion.
 *
 *   node tools/validate.mjs --incremental
 *     Lighter in-progress validation mode. Useful during development or future stop hooks.
 *
 * Exit codes:
 *   0 = no blocking failures
 *   1 = one or more blocking failures
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const INCREMENTAL = args.has("--incremental");

const results = {
  pass: [],
  warn: [],
  fail: []
};

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll("\\", "/");
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function pass(message) {
  results.pass.push(message);
}

function warn(message) {
  results.warn.push(message);
}

function fail(message) {
  results.fail.push(message);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function extractGoalFiles() {
  const files = fs
    .readdirSync(ROOT)
    .filter((file) => /^GOAL_v\d+\.\d+\.\d+\.md$/i.test(file));

  return files;
}

function extractGoalVersion(goalFileName, goalText) {
  const fileMatch = goalFileName.match(/^GOAL_v(\d+\.\d+\.\d+)\.md$/i);
  if (fileMatch) return fileMatch[1];

  const textMatch = goalText.match(/Version:\s*v?(\d+\.\d+\.\d+)/i);
  return textMatch?.[1] ?? null;
}

function extractGoalTitle(goalText) {
  const match = goalText.match(/Title:\s*(.+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractAllowedFiles(goalText) {
  const headingIndex = goalText.search(/# Allowed File Touch List/i);
  if (headingIndex === -1) return [];

  const afterHeading = goalText.slice(headingIndex);
  const blockMatch = afterHeading.match(/```text\s*([\s\S]*?)```/i);

  if (!blockMatch) return [];

  return blockMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function safeJsonParse(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function checkFileExists(relativePath, label = relativePath) {
  if (exists(relativePath)) {
    pass(`${label} exists.`);
  } else {
    fail(`${label} is missing.`);
  }
}

function checkContains(relativePath, needle, label = null) {
  if (!exists(relativePath)) {
    fail(`${relativePath} is missing; cannot verify required content.`);
    return;
  }

  const text = read(relativePath);
  if (text.includes(needle)) {
    pass(`${label ?? relativePath} contains required text: ${needle}`);
  } else {
    fail(`${label ?? relativePath} does not contain required text: ${needle}`);
  }
}

function getGitChangedFiles() {
  try {
    const output = execFileSync(
      "git",
      ["-C", ROOT, "status", "--porcelain"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );

    const files = output
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
      .filter(Boolean)
      .map((file) => file.replaceAll("\\", "/"));

    return { available: true, files };
  } catch {
    return { available: false, files: [] };
  }
}

function report() {
  section("PASS");
  if (results.pass.length === 0) {
    console.log("No pass records.");
  } else {
    for (const message of results.pass) console.log(`✔ ${message}`);
  }

  section("WARN");
  if (results.warn.length === 0) {
    console.log("No warnings.");
  } else {
    for (const message of results.warn) console.log(`⚠ ${message}`);
  }

  section("FAIL");
  if (results.fail.length === 0) {
    console.log("No failures.");
  } else {
    for (const message of results.fail) console.log(`✖ ${message}`);
  }

  section("SUMMARY");
  console.log(`Mode: ${INCREMENTAL ? "incremental" : "strict/final"}`);
  console.log(`Pass: ${results.pass.length}`);
  console.log(`Warn: ${results.warn.length}`);
  console.log(`Fail: ${results.fail.length}`);

  if (results.fail.length > 0) {
    console.log("\nVALIDATION RESULT: FAILED");
    process.exitCode = 1;
  } else {
    console.log("\nVALIDATION RESULT: PASSED");
    process.exitCode = 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Core repository checks                                                      */
/* -------------------------------------------------------------------------- */

section("Repository baseline");

checkFileExists("CLAUDE.md");
checkFileExists("module.json");
checkFileExists("README.md");
checkFileExists("DEV_NOTES.md");

/* -------------------------------------------------------------------------- */
/* Goal file checks                                                            */
/* -------------------------------------------------------------------------- */

section("Active milestone goal");

const goalFiles = extractGoalFiles();

if (goalFiles.length === 0) {
  fail("No root-level GOAL_v*.md file found.");
}

if (goalFiles.length > 1) {
  fail(`Multiple root-level GOAL_v*.md files found: ${goalFiles.join(", ")}`);
}

const activeGoalFile = goalFiles.length === 1 ? goalFiles[0] : null;
let goalText = "";
let targetVersion = null;
let targetTitle = null;
let allowedFiles = [];

if (activeGoalFile) {
  pass(`Exactly one active goal file found: ${activeGoalFile}`);

  goalText = read(activeGoalFile);
  targetVersion = extractGoalVersion(activeGoalFile, goalText);
  targetTitle = extractGoalTitle(goalText);
  allowedFiles = extractAllowedFiles(goalText);

  if (targetVersion) {
    pass(`Goal target version detected: ${targetVersion}`);
  } else {
    fail(`Could not determine target version from ${activeGoalFile}`);
  }

  if (targetTitle) {
    pass(`Goal title detected: ${targetTitle}`);
  } else {
    fail(`Could not determine goal title from ${activeGoalFile}`);
  }

  if (allowedFiles.length > 0) {
    pass(`Allowed file list detected with ${allowedFiles.length} entries.`);
  } else {
    fail(`Could not extract Allowed File Touch List from ${activeGoalFile}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Required local reference docs                                               */
/* -------------------------------------------------------------------------- */

section("Local reference documents");

const requiredReferenceDocs = [
  "docs/reference/pf1.5/PF1.5_Module_Mechanics_Reference.md",
  "docs/reference/pf1.5/PF1.5_Combat_Skill_Action_Costs.md",
  "docs/reference/pf1.5/Background Skills.md",
  "docs/reference/pf1.5/house-rules-and-aesthetic.md",
  "docs/reference/foundry-v13/00_READ_FIRST_Foundry_v13_API_Safety_and_Migration.md",
  "docs/reference/foundry-v13/99_Combined_Foundry_v13_PF1_[KnowledgeFiles.md].md",
  "docs/reference/foundry-v13/foundry-and-pf1.md",
  "docs/reference/module-workflow/00_READ_FIRST_Foundry_PF1_Module_Dev_Index.md",
  "docs/reference/module-workflow/00_READ_FIRST_Foundry_PF1_Module_Review_Checklist.md"
];

for (const doc of requiredReferenceDocs) {
  checkFileExists(doc);
}

/* -------------------------------------------------------------------------- */
/* module.json checks                                                          */
/* -------------------------------------------------------------------------- */

section("module.json");

const moduleJson = exists("module.json") ? safeJsonParse("module.json") : null;

if (moduleJson) {
  if (typeof moduleJson.version === "string") {
    pass(`module.json version field exists: ${moduleJson.version}`);
  } else {
    fail("module.json is missing a string version field.");
  }

  if (!INCREMENTAL && targetVersion) {
    if (moduleJson.version === targetVersion) {
      pass(`module.json version matches active goal target: ${targetVersion}`);
    } else {
      fail(
        `module.json version is ${moduleJson.version}, but active goal target is ${targetVersion}`
      );
    }
  }

  const scripts = Array.isArray(moduleJson.scripts) ? moduleJson.scripts : null;

  if (!scripts) {
    fail("module.json scripts array is missing or invalid.");
  } else {
    pass(`module.json scripts array found with ${scripts.length} entries.`);

    const actionTrackerIndex = scripts.indexOf("scripts/action-tracker.js");
    const taskTrackerIndex = scripts.indexOf("scripts/task-tracker.js");

    if (actionTrackerIndex === -1) {
      fail("module.json does not load scripts/action-tracker.js.");
    } else {
      pass("module.json loads scripts/action-tracker.js.");
    }

    if (taskTrackerIndex === -1) {
      fail("module.json does not load scripts/task-tracker.js.");
    } else {
      pass("module.json loads scripts/task-tracker.js.");
    }

    if (
      actionTrackerIndex !== -1 &&
      taskTrackerIndex !== -1 &&
      actionTrackerIndex < taskTrackerIndex
    ) {
      pass("task-tracker.js loads after action-tracker.js.");
    } else if (
      actionTrackerIndex !== -1 &&
      taskTrackerIndex !== -1
    ) {
      fail("task-tracker.js does not load after action-tracker.js.");
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Documentation checks                                                        */
/* -------------------------------------------------------------------------- */

section("Milestone documentation");

if (!INCREMENTAL && targetVersion && targetTitle) {
  const releaseHeading = `v${targetVersion} — ${targetTitle}`;

  checkContains("README.md", releaseHeading, "README.md");
  checkContains("DEV_NOTES.md", releaseHeading, "DEV_NOTES.md");
} else if (INCREMENTAL) {
  warn("Skipping final README/DEV_NOTES release-heading checks in incremental mode.");
}

/* -------------------------------------------------------------------------- */
/* Completion artifact checks                                                  */
/* -------------------------------------------------------------------------- */

section("Completion artifacts");

if (!INCREMENTAL) {
  checkFileExists("SERVER_TESTING_CHECKLIST.md");
  checkFileExists("RUNTIME_VERIFICATION_REQUIRED.md");

  if (targetVersion) {
    checkContains(
      "SERVER_TESTING_CHECKLIST.md",
      targetVersion,
      "SERVER_TESTING_CHECKLIST.md"
    );

    checkContains(
      "RUNTIME_VERIFICATION_REQUIRED.md",
      targetVersion,
      "RUNTIME_VERIFICATION_REQUIRED.md"
    );
  }
} else {
  warn("Skipping final completion-artifact checks in incremental mode.");
}

/* -------------------------------------------------------------------------- */
/* Git diff / file scope check                                                  */
/* -------------------------------------------------------------------------- */

section("Changed-file scope");

if (allowedFiles.length === 0) {
  warn("Allowed file list unavailable; changed-file scope check cannot run.");
} else {
  const git = getGitChangedFiles();

  if (!git.available) {
    warn(
      "Git status unavailable. Changed-file allowlist check skipped. " +
      "This is not blocking, but final human review must confirm file scope."
    );
  } else if (git.files.length === 0) {
    pass("Git reports no changed files.");
  } else {
    const unauthorized = git.files.filter(
      (file) => !allowedFiles.includes(file)
    );

    if (unauthorized.length === 0) {
      pass(
        `All Git-changed files are within the allowed list: ${git.files.join(", ")}`
      );
    } else {
      fail(
        `Git-changed files outside the allowed list: ${unauthorized.join(", ")}`
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Lightweight forbidden-pattern checks                                        */
/* -------------------------------------------------------------------------- */

section("Lightweight forbidden-pattern checks");

const filesToScan = [
  "scripts/action-tracker.js",
  "scripts/task-tracker.js",
  "styles/action-tracker.css"
].filter(exists);

const forbiddenPatterns = [
  {
    regex: /\bMath\.clamp\s*\(/g,
    message: "Found forbidden Math.clamp(...) usage. Review whether Math.clamped(...) or a safe alternative is required."
  }
];

for (const relativePath of filesToScan) {
  const text = read(relativePath);

  for (const pattern of forbiddenPatterns) {
    const matches = text.match(pattern.regex);
    if (matches && matches.length > 0) {
      fail(`${relativePath}: ${pattern.message}`);
    }
  }
}

if (results.fail.length === 0) {
  pass("No lightweight forbidden patterns detected in scanned action/task files.");
}

/* -------------------------------------------------------------------------- */
/* Final report                                                                */
/* -------------------------------------------------------------------------- */

report();