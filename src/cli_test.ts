// yoyak: An LLM-powered CLI tool for summarizing web pages
// Copyright (C) 2025 Hong Minhee <https://hongminhee.org/>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import { ok, strictEqual } from "node:assert/strict";
import { dirname, fromFileUrl, join } from "@std/path";
import { canonicalModelMonikers } from "./models.ts";

const ROOT = dirname(dirname(fromFileUrl(import.meta.url)));
const CLI = join(ROOT, "src", "cli.ts");

async function runCli(args: string[], stdin?: string) {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env",
      "--allow-sys",
      "--allow-read",
      "--allow-write",
      CLI,
      ...args,
    ],
    stdin: stdin == null ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
    cwd: ROOT,
  });
  const child = command.spawn();
  if (stdin != null) {
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(stdin));
    await writer.close();
  }
  const output = await child.output();
  return {
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
}

Deno.test("cli help surfaces the main commands", async () => {
  const result = await runCli(["--help"]);
  strictEqual(result.code, 0);
  ok(result.stdout.includes("models"));
  ok(result.stdout.includes("summary"));
  ok(result.stdout.includes("scrape"));
  ok(result.stdout.includes("completions"));
});

Deno.test("cli subcommand help remains available", async () => {
  const models = await runCli(["models", "--help"]);
  const summary = await runCli(["summary", "--help"]);
  const scrape = await runCli(["scrape", "--help"]);
  strictEqual(models.code, 0);
  strictEqual(summary.code, 0);
  strictEqual(scrape.code, 0);
  ok(models.stdout.includes("List the supported model names"));
  ok(summary.stdout.includes("Summarize one or more text files"));
  ok(scrape.stdout.includes("Scrape one or more text files"));
});

Deno.test("cli models prints canonical model names only", async () => {
  const result = await runCli(["models"]);
  strictEqual(result.code, 0);
  strictEqual(result.stderr, "");
  strictEqual(result.stdout, `${canonicalModelMonikers.join("\n")}\n`);
  ok(!result.stdout.includes("chatgpt-4o-latest"));
});

Deno.test("cli models --json prints catalog metadata", async () => {
  const result = await runCli(["models", "--json"]);
  strictEqual(result.code, 0);
  const parsed = JSON.parse(result.stdout) as {
    models: Array<{
      name: string;
      providerModelName: string;
      deprecatedAliases: string[];
    }>;
  };
  strictEqual(parsed.models[0].name, canonicalModelMonikers[0]);
  strictEqual(
    parsed.models.find((model) => model.name === "gpt-5.3-chat-latest")
      ?.deprecatedAliases[0],
    "chatgpt-4o-latest",
  );
  strictEqual(
    parsed.models.find((model) => model.name === "gemini-2.5-flash")
      ?.deprecatedAliases.includes("gemini-2.0-flash"),
    true,
  );
});

Deno.test("cli emits bash completions", async () => {
  const result = await runCli(["completions", "bash"]);
  strictEqual(result.code, 0);
  ok(result.stdout.startsWith("#!/usr/bin/env bash"));
  ok(result.stdout.includes("_yoyak()"));
});

Deno.test("cli scrape reads from a local file", async () => {
  const tempDir = await Deno.makeTempDir();
  const path = join(tempDir, "sample.md");

  try {
    await Deno.writeTextFile(path, "# Sample\n\nText");
    const result = await runCli(["scrape", path]);
    strictEqual(result.code, 0);
    strictEqual(result.stdout, `Source: ${path}\n\n# Sample\n\nText\n`);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("cli scrape reads from stdin", async () => {
  const result = await runCli(["scrape", "-"], "# From stdin");
  strictEqual(result.code, 0);
  strictEqual(result.stdout, "Source: (standard input)\n\n# From stdin\n");
});

Deno.test("cli scrape saves output to a Markdown file", async () => {
  const tempDir = await Deno.makeTempDir();
  const path = join(tempDir, "sample.md");
  const output = join(tempDir, "out.md");

  try {
    await Deno.writeTextFile(path, "# Sample\n\nText");
    const result = await runCli(["scrape", "-o", output, path]);
    strictEqual(result.code, 0);
    strictEqual(result.stdout, `Source: ${path}\n\n# Sample\n\nText\n`);
    strictEqual(
      await Deno.readTextFile(output),
      `Source: ${path}\n\n# Sample\n\nText\n`,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("cli scrape processes multiple space-separated inputs", async () => {
  const tempDir = await Deno.makeTempDir();
  const pathA = join(tempDir, "a.md");
  const pathB = join(tempDir, "b.md");

  try {
    await Deno.writeTextFile(pathA, "# A");
    await Deno.writeTextFile(pathB, "# B");
    const result = await runCli(["scrape", pathA, pathB]);
    strictEqual(result.code, 0);
    strictEqual(
      result.stdout,
      `Source: ${pathA}\n\n# A\n\nSource: ${pathB}\n\n# B\n`,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("cli scrape splits inputs on commas and semicolons", async () => {
  const tempDir = await Deno.makeTempDir();
  const pathA = join(tempDir, "a.md");
  const pathB = join(tempDir, "b.md");
  const pathC = join(tempDir, "c.md");

  try {
    await Deno.writeTextFile(pathA, "# A");
    await Deno.writeTextFile(pathB, "# B");
    await Deno.writeTextFile(pathC, "# C");
    const result = await runCli(["scrape", `${pathA},${pathB};${pathC}`]);
    strictEqual(result.code, 0);
    strictEqual(
      result.stdout,
      `Source: ${pathA}\n\n# A\n\nSource: ${pathB}\n\n# B\n\n` +
        `Source: ${pathC}\n\n# C\n`,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("cli scrape saves each input to its own output file", async () => {
  const tempDir = await Deno.makeTempDir();
  const pathA = join(tempDir, "a.md");
  const pathB = join(tempDir, "b.md");
  const outA = join(tempDir, "out-a.md");
  const outB = join(tempDir, "out-b.md");

  try {
    await Deno.writeTextFile(pathA, "# A");
    await Deno.writeTextFile(pathB, "# B");
    const result = await runCli([
      "scrape",
      "-o",
      outA,
      "-o",
      outB,
      pathA,
      pathB,
    ]);
    strictEqual(result.code, 0);
    strictEqual(
      result.stdout,
      `Source: ${pathA}\n\n# A\n\nSource: ${pathB}\n\n# B\n`,
    );
    strictEqual(await Deno.readTextFile(outA), `Source: ${pathA}\n\n# A\n`);
    strictEqual(await Deno.readTextFile(outB), `Source: ${pathB}\n\n# B\n`);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("cli scrape rejects mismatched output and input counts", async () => {
  const tempDir = await Deno.makeTempDir();
  const pathA = join(tempDir, "a.md");
  const pathB = join(tempDir, "b.md");
  const output = join(tempDir, "out.md");

  try {
    await Deno.writeTextFile(pathA, "# A");
    await Deno.writeTextFile(pathB, "# B");
    const result = await runCli(["scrape", "-o", output, pathA, pathB]);
    strictEqual(result.code, 1);
    ok(result.stderr.includes("-o/--output"));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("cli scrape rejects mixing standard input with other inputs", async () => {
  const tempDir = await Deno.makeTempDir();
  const pathA = join(tempDir, "a.md");

  try {
    await Deno.writeTextFile(pathA, "# A");
    const result = await runCli(["scrape", "-", pathA]);
    strictEqual(result.code, 1);
    ok(result.stderr.includes("standard input"));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("cli scrape waits between inputs with --time", async () => {
  const tempDir = await Deno.makeTempDir();
  const pathA = join(tempDir, "a.md");
  const pathB = join(tempDir, "b.md");

  try {
    await Deno.writeTextFile(pathA, "# A");
    await Deno.writeTextFile(pathB, "# B");
    const started = Date.now();
    const result = await runCli(["scrape", "--time=1", pathA, pathB]);
    const elapsed = Date.now() - started;
    strictEqual(result.code, 0);
    strictEqual(
      result.stdout,
      `Source: ${pathA}\n\n# A\n\nSource: ${pathB}\n\n# B\n`,
    );
    ok(elapsed >= 1000);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("cli scrape rejects a negative --time", async () => {
  const tempDir = await Deno.makeTempDir();
  const pathA = join(tempDir, "a.md");

  try {
    await Deno.writeTextFile(pathA, "# A");
    const result = await runCli(["scrape", "--time=-1", pathA]);
    ok(result.code !== 0);
    ok(result.stderr.includes("--time"));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
