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
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { getLogger } from "@logtape/logtape";
import { getMessageText, type MessageLike } from "./model_text.ts";

const logger = getLogger(["yoyak", "models"]);

/**
 * The list of canonical model names to advertise and persist.
 */
export const canonicalModelMonikers = [
  "claude-3-5-haiku-latest",
  "claude-3-5-sonnet-latest",
  "claude-3-7-sonnet-latest",
  "claude-opus-4-0",
  "claude-opus-4-1-20250805",
  "claude-sonnet-4-0",
  "deepseek-chat",
  "deepseek-reasoner",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-3.1-flash-lite-preview",
  "gemma3",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5.1",
  "gpt-5.3-chat-latest",
  "gpt-5.4",
  "gpt-5.1-chat-latest",
  "llm7/claude-haiku-5-5",
  "llm7/claude-opus-5-5",
  "llm7/claude-sonnet-5",
  "llm7/codestral",
  "llm7/deepseek-v4-flash",
  "llm7/deepseek-v4-pro",
  "llm7/deepseek-v4.1-flash",
  "llm7/gemini-3.8-flash-high",
  "llm7/gemini-3.1-flash-lite",
  "llm7/glm-5.3",
  "llm7/glm-5.3-flash",
  "llm7/gpt-6-sol",
  "llm7/gpt-6.1-sol",
  "llm7/gpt-oss-20b",
  "llm7/grok-4.6",
  "llm7/kimi-k3",
  "llm7/llama-4-maverick",
  "llm7/mistral-large-3",
  "llm7/mistral-nemo",
  "llm7/minimax-m3",
  "llm7/nemotron-3-nano",
  "o3",
  "o4-mini",
] as const;

/**
 * The canonical string representation of a model.
 */
export type CanonicalModelMoniker = typeof canonicalModelMonikers[number];

/**
 * Model names kept for backward compatibility.
 */
export const deprecatedModelMonikers = [
  "chatgpt-4o-latest",
  "claude-3-opus-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash-thinking-exp-01-21",
  "gemini-2.0-pro-exp-02-05",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-pro-preview-03-25",
  "gpt-4.5-preview",
  "o1",
  "o1-mini",
  "o1-preview",
  "o3-mini",
  "gpt-5-chat-latest",
] as const;

export type DeprecatedModelMoniker = typeof deprecatedModelMonikers[number];

export const deprecatedModelAliases: Readonly<
  Record<DeprecatedModelMoniker, CanonicalModelMoniker>
> = {
  "chatgpt-4o-latest": "gpt-5.3-chat-latest",
  "claude-3-opus-latest": "claude-opus-4-0",
  "gemini-1.5-flash": "gemini-2.5-flash",
  "gemini-1.5-flash-8b": "gemini-2.5-flash-lite",
  "gemini-1.5-pro": "gemini-2.5-pro",
  "gemini-2.0-flash-exp": "gemini-2.5-flash",
  "gemini-2.0-flash": "gemini-2.5-flash",
  "gemini-2.0-flash-lite": "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite-preview-02-05": "gemini-2.5-flash-lite",
  "gemini-2.0-flash-thinking-exp-01-21": "gemini-2.5-flash",
  "gemini-2.0-pro-exp-02-05": "gemini-2.5-pro",
  "gemini-2.5-flash-preview-04-17": "gemini-2.5-flash",
  "gemini-2.5-pro-preview-03-25": "gemini-2.5-pro",
  "gpt-4.5-preview": "gpt-4.1",
  "gpt-5-chat-latest": "gpt-5.3-chat-latest",
  "o1": "o3",
  "o1-mini": "o4-mini",
  "o1-preview": "o3",
  "o3-mini": "o4-mini",
} as const;

/**
 * The list of accepted model names.
 */
export const modelMonikers = [
  ...canonicalModelMonikers,
  ...deprecatedModelMonikers,
] as const;

/**
 * The accepted string representation of a model.
 */
export type ModelMoniker = typeof modelMonikers[number];

/**
 * Tests if the given value is a model moniker.
 * @param value The value to test.
 * @returns Whether the value is a model moniker.
 */
export function isModelMoniker(value: unknown): value is ModelMoniker {
  return modelMonikers.includes(value as ModelMoniker);
}

/**
 * The model object.
 */
export type Model =
  | ChatOpenAI
  | ChatAnthropic
  | ChatDeepSeek
  | ChatGoogleGenerativeAI
  | ChatOllama;

export interface ModelStreamOptions {
  signal?: AbortSignal;
}

export interface ModelLike {
  invoke(...args: unknown[]): Promise<MessageLike>;
  stream(...args: unknown[]): Promise<AsyncIterable<MessageLike>>;
}

/**
 * The constructor of a model.
 */
export type ModelClass = new (
  ...args: unknown[]
) => ModelLike;

function asModelClass(modelClass: unknown): ModelClass {
  return modelClass as ModelClass;
}

export interface CanonicalModelInfo {
  readonly name: CanonicalModelMoniker;
  readonly providerModelName: string;
  readonly baseURL?: string;
}

export interface ModelCatalogEntry extends CanonicalModelInfo {
  readonly deprecatedAliases: readonly DeprecatedModelMoniker[];
}

/**
 * The base URL of the llm7 OpenAI-compatible API.
 */
const llm7BaseURL = "https://api.llm7.io/v1";

/**
 * The per-model provider configuration.
 */
const modelConfigs: Record<
  CanonicalModelMoniker,
  {
    readonly modelClass: ModelClass;
    readonly providerModelName: string;
    readonly baseURL?: string;
  }
> = {
  "claude-3-5-haiku-latest": {
    modelClass: asModelClass(ChatAnthropic),
    providerModelName: "claude-3-5-haiku-latest",
  },
  "claude-3-5-sonnet-latest": {
    modelClass: asModelClass(ChatAnthropic),
    providerModelName: "claude-3-5-sonnet-latest",
  },
  "claude-3-7-sonnet-latest": {
    modelClass: asModelClass(ChatAnthropic),
    providerModelName: "claude-3-7-sonnet-latest",
  },
  "claude-opus-4-0": {
    modelClass: asModelClass(ChatAnthropic),
    providerModelName: "claude-opus-4-0",
  },
  "claude-opus-4-1-20250805": {
    modelClass: asModelClass(ChatAnthropic),
    providerModelName: "claude-opus-4-1-20250805",
  },
  "claude-sonnet-4-0": {
    modelClass: asModelClass(ChatAnthropic),
    providerModelName: "claude-sonnet-4-0",
  },
  "deepseek-chat": {
    modelClass: asModelClass(ChatDeepSeek),
    providerModelName: "deepseek-chat",
  },
  "deepseek-reasoner": {
    modelClass: asModelClass(ChatDeepSeek),
    providerModelName: "deepseek-reasoner",
  },
  "gemini-2.5-flash": {
    modelClass: asModelClass(ChatGoogleGenerativeAI),
    providerModelName: "gemini-2.5-flash",
  },
  "gemini-2.5-flash-lite": {
    modelClass: asModelClass(ChatGoogleGenerativeAI),
    providerModelName: "gemini-2.5-flash-lite",
  },
  "gemini-2.5-pro": {
    modelClass: asModelClass(ChatGoogleGenerativeAI),
    providerModelName: "gemini-2.5-pro",
  },
  "gemini-3-flash-preview": {
    modelClass: asModelClass(ChatGoogleGenerativeAI),
    providerModelName: "gemini-3-flash-preview",
  },
  "gemini-3-pro-preview": {
    modelClass: asModelClass(ChatGoogleGenerativeAI),
    providerModelName: "gemini-3-pro-preview",
  },
  "gemini-3.1-flash-lite-preview": {
    modelClass: asModelClass(ChatGoogleGenerativeAI),
    providerModelName: "gemini-3.1-flash-lite-preview",
  },
  "gemma3": {
    modelClass: asModelClass(ChatOllama),
    providerModelName: "gemma3",
  },
  "gpt-4.1": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-4.1",
  },
  "gpt-4.1-mini": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-4.1-mini",
  },
  "gpt-4.1-nano": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-4.1-nano",
  },
  "gpt-4o": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-4o",
  },
  "gpt-4o-mini": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-4o-mini",
  },
  "gpt-5": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-5",
  },
  "gpt-5-mini": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-5-mini",
  },
  "gpt-5-nano": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-5-nano",
  },
  "gpt-5.1": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-5.1",
  },
  "gpt-5.3-chat-latest": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-5.3-chat-latest",
  },
  "gpt-5.4": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-5.4",
  },
  "gpt-5.1-chat-latest": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-5.1-chat-latest",
  },
  "llm7/claude-haiku-5-5": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "claude-haiku-5-5",
    baseURL: llm7BaseURL,
  },
  "llm7/claude-opus-5-5": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "claude-opus-5-5",
    baseURL: llm7BaseURL,
  },
  "llm7/claude-sonnet-5": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "claude-sonnet-5",
    baseURL: llm7BaseURL,
  },
  "llm7/codestral": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "codestral-latest",
    baseURL: llm7BaseURL,
  },
  "llm7/deepseek-v4-flash": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "DeepSeek-V4-Flash-0731",
    baseURL: llm7BaseURL,
  },
  "llm7/deepseek-v4-pro": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "deepseek-v4-pro",
    baseURL: llm7BaseURL,
  },
  "llm7/deepseek-v4.1-flash": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "DeepSeek-V4.1-Flash",
    baseURL: llm7BaseURL,
  },
  "llm7/gemini-3.8-flash-high": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gemini-3.8-flash-high",
    baseURL: llm7BaseURL,
  },
  "llm7/gemini-3.1-flash-lite": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gemini-3.1-flash-lite",
    baseURL: llm7BaseURL,
  },
  "llm7/glm-5.3": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "glm-5.3",
    baseURL: llm7BaseURL,
  },
  "llm7/glm-5.3-flash": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "GLM-5.3-Flash",
    baseURL: llm7BaseURL,
  },
  "llm7/gpt-6-sol": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-6-sol",
    baseURL: llm7BaseURL,
  },
  "llm7/gpt-6.1-sol": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-6.1-sol",
    baseURL: llm7BaseURL,
  },
  "llm7/gpt-oss-20b": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "gpt-oss:20b",
    baseURL: llm7BaseURL,
  },
  "llm7/grok-4.6": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "grok-4.6",
    baseURL: llm7BaseURL,
  },
  "llm7/kimi-k3": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "kimi-k3",
    baseURL: llm7BaseURL,
  },
  "llm7/llama-4-maverick": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "llama-4-maverick",
    baseURL: llm7BaseURL,
  },
  "llm7/mistral-large-3": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "mistral-large-3:675b",
    baseURL: llm7BaseURL,
  },
  "llm7/mistral-nemo": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "mistral-Nemo-Instruct-2407",
    baseURL: llm7BaseURL,
  },
  "llm7/minimax-m3": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "minimax-m3",
    baseURL: llm7BaseURL,
  },
  "llm7/nemotron-3-nano": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "nemotron-3-nano:30b",
    baseURL: llm7BaseURL,
  },
  "o3": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "o3",
  },
  "o4-mini": {
    modelClass: asModelClass(ChatOpenAI),
    providerModelName: "o4-mini",
  },
};

/**
 * Resolves deprecated aliases to their canonical model names.
 * @param model The model name to resolve.
 * @returns The canonical model name.
 */
export function resolveModelMoniker(
  model: ModelMoniker,
): CanonicalModelMoniker {
  return deprecatedModelAliases[model as keyof typeof deprecatedModelAliases] ??
    model;
}

/**
 * Gets the constructor for the given canonical model name.
 * @param model The canonical model name.
 * @returns The corresponding constructor.
 */
export function getModelClass(model: CanonicalModelMoniker): ModelClass {
  return modelConfigs[model].modelClass;
}

/**
 * Gets the provider-specific model name for the canonical model.
 * @param model The canonical model name.
 * @returns The provider-specific model name.
 */
export function getProviderModelName(model: CanonicalModelMoniker): string {
  return modelConfigs[model].providerModelName;
}

/**
 * Gets the base URL of the OpenAI-compatible API for the canonical model, if
 * the model is served through a custom endpoint (e.g., llm7).
 * @param model The canonical model name.
 * @returns The base URL, or `undefined` if the provider default is used.
 */
export function getModelBaseURL(
  model: CanonicalModelMoniker,
): string | undefined {
  return modelConfigs[model].baseURL;
}

/**
 * Tests if two canonical models are served by the same provider, i.e., they
 * share the same model class and API endpoint and hence can share a single
 * API key.
 * @param a The first canonical model name.
 * @param b The second canonical model name.
 * @returns Whether the two models are served by the same provider.
 */
export function sameModelProvider(
  a: CanonicalModelMoniker,
  b: CanonicalModelMoniker,
): boolean {
  return getModelClass(a) === getModelClass(b) &&
    getModelBaseURL(a) === getModelBaseURL(b);
}

/**
 * Gets the canonical model list with provider-specific identifiers.
 * @returns The canonical model list.
 */
export function getCanonicalModels(): readonly CanonicalModelInfo[] {
  return canonicalModelMonikers.map((name) => ({
    name,
    providerModelName: getProviderModelName(name),
    baseURL: getModelBaseURL(name),
  }));
}

/**
 * Gets deprecated aliases grouped by canonical model name.
 * @returns Deprecated aliases for each canonical model.
 */
export function getDeprecatedAliasesByModel(): Readonly<
  Record<CanonicalModelMoniker, readonly DeprecatedModelMoniker[]>
> {
  const aliasesByModel = {} as Record<
    CanonicalModelMoniker,
    readonly DeprecatedModelMoniker[]
  >;
  for (const name of canonicalModelMonikers) {
    aliasesByModel[name] = deprecatedModelMonikers.filter((alias) =>
      deprecatedModelAliases[alias] === name
    );
  }
  return aliasesByModel;
}

/**
 * Gets the model catalog including canonical names and deprecated aliases.
 * @returns The model catalog.
 */
export function getModelCatalog(): readonly ModelCatalogEntry[] {
  const aliasesByModel = getDeprecatedAliasesByModel();
  return getCanonicalModels().map((model) => ({
    ...model,
    deprecatedAliases: aliasesByModel[model.name],
  }));
}

/**
 * Tests the given model if it is working.
 * @param model The model to test.
 * @returns Whether the model is working.
 */
export async function testModel(model: ModelLike): Promise<boolean> {
  const message = new HumanMessage("Please say “yes.”");
  logger.debug("Testing model with message: {message}", { message });
  try {
    const response = await model.invoke([message]);
    logger.debug("Model response: {response}", { response });
    return getMessageText(response).match(/\byes\b/i) != null;
  } catch (error) {
    logger.debug("Model failed to respond: {error}", { error });
    return false;
  }
}
