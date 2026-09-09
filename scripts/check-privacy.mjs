import { execFileSync } from "node:child_process";
import { readFile, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// A focused accidental-disclosure guard, not a guarantee that all secrets or
// personal information can be recognized. Never print matched content.
const sensitivePath =
  /(?:^|\/)(?:\.openai(?:\/|$)|\.env(?:\.|$)|[^/]+\.(?:pem|key|p12|pfx)$)/i;
const rules = [
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{50,255})\b/,
  ],
  ["API token", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  [
    "private key",
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/,
  ],
  ["private deployment URL", /https?:\/\/[a-z0-9.-]+\.chatgpt\.site\b/i],
  ["internal workspace path", /\/(?:workspace|mnt\/data)\/[A-Za-z0-9_./-]+/],
  ["deployment identifier", /\bappgprj_[A-Za-z0-9]+\b/],
];

export function inspectPublicFile(path, contents) {
  const findings = [];
  if (sensitivePath.test(path) && !/(?:^|\/)\.env\.example$/.test(path))
    findings.push("sensitive file path");
  if (contents.includes(0)) return findings;
  const text = contents.toString("utf8");
  for (const [label, pattern] of rules)
    if (pattern.test(text)) findings.push(label);
  return findings;
}

async function main() {
  const paths = [
    ...new Set(
      execFileSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        { encoding: "utf8" },
      )
        .split("\0")
        .filter(Boolean),
    ),
  ];
  const findings = [];
  let checked = 0;
  for (const path of paths) {
    let info;
    try {
      info = await lstat(path);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (info.isSymbolicLink()) {
      findings.push(`${path}: symlink needs manual disclosure review`);
      continue;
    }
    if (!info.isFile()) continue;
    checked++;
    for (const label of inspectPublicFile(path, await readFile(path)))
      findings.push(`${path}: ${label}`);
  }
  if (findings.length) {
    console.error(findings.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      `Public-source guard passed for ${checked} files. History and unrecognized secrets require separate review.`,
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
