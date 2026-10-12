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
import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import {
  canonicalModelMonikers,
  getCanonicalModels,
  getDeprecatedAliasesByModel,
  getModelBaseURL,
  getModelCatalog,
  getProviderModelName,
  resolveModelMoniker,
  sameModelProvider,
  testModel,
} from "./models.ts";

Deno.test("testModel accepts text from standardized content blocks", async () => {
  const working = await testModel({
    invoke() {
      return Promise.resolve({
        contentBlocks: [{ type: "text", text: "yes" }],
      });
    },
    stream() {
      return Promise.resolve({ async *[Symbol.asyncIterator]() {} });
    },
  });

  strictEqual(working, true);
});

Deno.test("resolveModelMoniker normalizes deprecated aliases", () => {
  strictEqual(resolveModelMoniker("chatgpt-4o-latest"), "gpt-5.3-chat-latest");
  strictEqual(resolveModelMoniker("gemini-2.0-flash"), "gemini-2.5-flash");
  strictEqual(resolveModelMoniker("gpt-4o"), "gpt-4o");
  strictEqual(
    getProviderModelName("gpt-5.3-chat-latest"),
    "gpt-5.3-chat-latest",
  );
});

Deno.test("llm7 models resolve provider names and base URL", () => {
  strictEqual(getProviderModelName("llm7/gpt-6-sol"), "gpt-6-sol");
  strictEqual(getProviderModelName("llm7/gpt-oss-20b"), "gpt-oss:20b");
  strictEqual(
    getProviderModelName("llm7/deepseek-v4.1-flash"),
    "DeepSeek-V4.1-Flash",
  );
  strictEqual(getModelBaseURL("llm7/gpt-6-sol"), "https://api.llm7.io/v1");
  strictEqual(getModelBaseURL("gpt-4o"), undefined);
});

Deno.test("sameModelProvider groups models by provider", () => {
  ok(sameModelProvider("llm7/gpt-6-sol", "llm7/kimi-k3"));
  ok(sameModelProvider("gpt-5", "gpt-4o"));
  ok(!sameModelProvider("llm7/gpt-6-sol", "gpt-5"));
  ok(!sameModelProvider("gemma3", "llm7/gpt-oss-20b"));
});

Deno.test("model catalog exposes every canonical model exactly once", () => {
  const catalog = getModelCatalog();
  deepStrictEqual(
    catalog.map((model) => model.name),
    [...canonicalModelMonikers],
  );
  deepStrictEqual(
    getCanonicalModels().map((model) => model.providerModelName),
    canonicalModelMonikers.map((model) => getProviderModelName(model)),
  );
});

Deno.test("deprecated aliases are grouped by canonical model", () => {
  const aliasesByModel = getDeprecatedAliasesByModel();
  deepStrictEqual(aliasesByModel["gpt-5.3-chat-latest"], [
    "chatgpt-4o-latest",
    "gpt-5-chat-latest",
  ]);
  deepStrictEqual(aliasesByModel["gemini-2.5-flash"], [
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
    "gemini-2.0-flash-thinking-exp-01-21",
    "gemini-2.5-flash-preview-04-17",
  ]);
});
