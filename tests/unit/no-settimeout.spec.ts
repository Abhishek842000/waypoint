import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const roots = [
  path.resolve(__dirname, "../../packages/jobs/src"),
  path.resolve(__dirname, "../../apps/worker/src"),
  path.resolve(__dirname, "../../apps/api/src"),
];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("escalation timing must be durable", () => {
  it("does not call setTimeout in the API, worker, or jobs package", () => {
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        const src = fs.readFileSync(file, "utf8");
        if (/\bsetTimeout\s*\(/.test(src)) offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
