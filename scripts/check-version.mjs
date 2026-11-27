import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

const base = arg("--base") ?? process.env.BASE_REF ?? "origin/main";
const head = arg("--head") ?? "HEAD";
let failed = false;

function fail(message) {
  failed = true;
  console.error(`version-check: ${message}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isGreater(candidate, previous) {
  const a = candidate.split(".").map(Number);
  const b = previous.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

const version = readJson("package.json").version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`package.json 的版本号 ${JSON.stringify(version)} 不是 x.y.z 格式`);
}

const changed = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
const isProductFile = (path) =>
  ["src/", "panel/", "plugin/", "service/"].some((prefix) => path.startsWith(prefix)) ||
  path === "scripts/build.mjs" ||
  path === "package.json" ||
  path === "package-lock.json";
const productChanged = changed.some(isProductFile);

if (productChanged) {
  let previous;
  try {
    previous = readJsonFromGit(`${base}:package.json`).version;
  } catch {
    fail(`无法从 ${base} 读取 package.json，不能确认版本是否升级`);
  }
  if (previous && !isGreater(version, previous)) {
    fail(`产品文件或依赖清单有改动，版本号必须从 ${previous} 升到更高版本，当前是 ${version}`);
  }
}

const lock = readJson("package-lock.json");
if (lock.version !== version) fail(`package-lock.json 顶层版本 ${lock.version} 与 package.json ${version} 不一致`);
if (lock.packages?.[""]?.version !== version) {
  fail(`package-lock.json 的 packages[""].version ${lock.packages?.[""]?.version} 与 package.json ${version} 不一致`);
}

const versionPattern = /(?:VERSION\s*=\s*|version:\s*|\.version,\s*)"(\d+\.\d+\.\d+)"/g;
const pinnedFiles = [
  "src/service/main.mjs",
  "src/plugin/index.mjs",
  "tests/service.test.mjs",
  "scripts/smoke-room.mjs",
];
for (const path of pinnedFiles) {
  const text = readFileSync(path, "utf8");
  const found = [...text.matchAll(versionPattern)].map((match) => match[1]);
  if (found.length === 0) fail(`${path} 中没有找到版本号，无法校验一致性`);
  for (const pinned of found) {
    if (pinned !== version) fail(`${path} 中的版本 ${pinned} 与 package.json ${version} 不一致`);
  }
}

if (failed) process.exitCode = 1;
else {
  console.log(
    productChanged
      ? `version-check: 版本 ${version} 一致，且已相对基线升级`
      : `version-check: 版本 ${version} 一致，未改动产品文件或依赖清单，无需升级`,
  );
}

function readJsonFromGit(spec) {
  return JSON.parse(execFileSync("git", ["show", spec], { encoding: "utf8" }));
}
