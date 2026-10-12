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
import { Command, EnumType, ValidationError } from "@cliffy/command";
import { CompletionsCommand } from "@cliffy/command/completions";
import { Input } from "@cliffy/prompt";
import { isLanguageCode } from "@hongminhee/iso639-1";
import {
  ansiColorFormatter,
  configure,
  dispose,
  getLogger,
  getStreamSink,
} from "@logtape/logtape";
import { readAll } from "@std/io";
import { AsyncLocalStorage } from "node:async_hooks";
import metadata from "../deno.json" with { type: "json" };
import {
  getCanonicalModels,
  getModelBaseURL,
  getModelCatalog,
  getModelClass,
  getProviderModelName,
  type ModelLike,
  type ModelMoniker,
  modelMonikers,
  resolveModelMoniker,
  sameModelProvider,
  testModel,
} from "./models.ts";
import { scrape } from "./scrape.ts";
import { loadSettings, saveSettings } from "./settings.ts";
import { summarize } from "./summary.ts";
import { translate } from "./translate.ts";

const consoleSink = getStreamSink(Deno.stderr.writable, {
  formatter: ansiColorFormatter,
});

await configure({
  contextLocalStorage: new AsyncLocalStorage(),
  sinks: { console: (record) => consoleSink(record) },
  loggers: [
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
    { category: ["yoyak"], lowestLevel: "info", sinks: ["console"] },
  ],
});

const logger = getLogger(["yoyak", "cli"]);

async function exit(code?: number): Promise<never> {
  // FIXME: When LogTape provides a way to choose the appropriate level for the
  // log messages (`console.*`), we should use the console logger and get rid of
  // this custom exit function.
  await dispose();
  Deno.exit(code);
}

type GlobalOptions = {
  model?: ModelMoniker;
  apiKey?: string;
};

type GlobalTypes = {
  model: typeof modelMoniker;
};

async function getModel(
  options: { model?: ModelMoniker; apiKey?: string },
): Promise<ModelLike> {
  let { model, apiKey } = options;
  const settings = await loadSettings();
  model ??= settings?.model ?? undefined;
  apiKey ??= settings?.apiKey ?? undefined;
  if (model == null) {
    console.error(
      "-m/--model: The model must be specified for translation.",
    );
    return await exit(1);
  }
  if (apiKey == null) {
    console.error(
      "-a/--api-key: The API key must be specified for the model.",
    );
    return await exit(1);
  }
  const canonicalModel = resolveModelMoniker(model);
  const ModelClass = getModelClass(canonicalModel);
  const baseURL = getModelBaseURL(canonicalModel);
  return new ModelClass({
    model: getProviderModelName(canonicalModel),
    apiKey,
    ...(baseURL == null ? {} : { configuration: { baseURL } }),
  });
}

async function scrapeContent(
  url: string,
  options: { userAgent?: string },
): Promise<string | undefined> {
  if (url === "-") {
    const bytes = await readAll(Deno.stdin);
    return new TextDecoder().decode(bytes);
  }
  if (URL.canParse(url)) {
    const result = await scrape(url, { userAgent: options.userAgent });
    if (result == null) {
      console.error("Failed to scrape the web page.");
    }
    return result;
  }
  try {
    return await Deno.readTextFile(url);
  } catch (error) {
    logger.debug(
      "Failed to read the file {path}: {error}",
      { path: url, error },
    );
    console.error("Failed to read the file:", url);
    return undefined;
  }
}

function formatSource(input: string): string {
  if (URL.canParse(input)) return `Source: <${input}>`;
  if (input === "-") return "Source: (standard input)";
  return `Source: ${input}`;
}

function splitInputs(args: string[]): string[] {
  return args
    .flatMap((arg) => arg.split(/[;,]/))
    .map((arg) => arg.trim())
    .filter((arg) => arg !== "");
}

function validateInputs(inputs: string[], outputs: string[]): boolean {
  if (inputs.length === 0) {
    console.error("No input was given.");
    return false;
  }
  if (inputs.includes("-") && inputs.length > 1) {
    console.error(
      "The standard input (`-`) cannot be combined with other inputs.",
    );
    return false;
  }
  if (outputs.length > 0 && outputs.length !== inputs.length) {
    console.error(
      `-o/--output: Expected one output file per input, but got ` +
        `${outputs.length} output(s) for ${inputs.length} input(s).`,
    );
    return false;
  }
  return true;
}

function sleep(seconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, seconds * 1000);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

const scrapeCommand = new Command<GlobalOptions, GlobalTypes>()
  .arguments("<urls...:string>")
  .description(
    "Scrape one or more text files or web pages and return the content in " +
      "Markdown format without summarization.  Inputs can be separated by " +
      "spaces, commas, or semicolons.  If you want to scrape a text from " +
      "the standard input, give `-` as the argument; `-` cannot be " +
      "combined with other inputs.",
  )
  .option(
    "-l, --language <language:string>",
    "The language code in ISO 639-1 to translate the content into.  " +
      "Do not translate if not specified.",
    (language) => {
      if (!isLanguageCode(language)) {
        throw new ValidationError(
          "-l/--language: Expected a valid language code.",
        );
      }
      return language;
    },
  )
  .option(
    "-o, --output <path:string>",
    "Save the output to the given Markdown file.  Repeat the option once " +
      "per input to save each input separately.  The output is still " +
      "printed to the standard output.",
    { collect: true },
  )
  .option(
    "-t, --time <seconds:number>",
    "Wait the given number of seconds between processing each input.  " +
      "Useful for staying within provider rate limits such as llm7's " +
      "free tier.",
    {
      value(seconds) {
        if (seconds < 0 || !Number.isInteger(seconds)) {
          throw new ValidationError(
            "-t/--time: Expected a non-negative integer.",
          );
        }
        return seconds;
      },
    },
  )
  .option(
    "-u, --user-agent <userAgent:string>",
    "The User-Agent header to send in the HTTP request to the web page.",
  )
  .action(async (options, ...args: string[]) => {
    const inputs = splitInputs(args);
    const outputs = options.output ?? [];
    if (!validateInputs(inputs, outputs)) {
      return await exit(1);
    }
    const model = options.language == null
      ? undefined
      : await getModel(options);
    const abortController = new AbortController();
    if (options.language != null) {
      Deno.addSignalListener(
        "SIGINT",
        abortController.abort.bind(abortController),
      );
    }
    const signal = abortController.signal;
    const encoder = new TextEncoder();
    let failures = 0;
    for (let i = 0; i < inputs.length && !signal.aborted; i++) {
      if (i > 0 && options.time != null && options.time > 0) {
        logger.info(
          "Waiting {seconds} seconds before the next input.",
          { seconds: options.time },
        );
        await sleep(options.time, signal);
      }
      if (signal.aborted) break;
      const input = inputs[i];
      if (inputs.length > 1) {
        logger.info(
          "Processing input {index} of {total}: {input}",
          { index: i + 1, total: inputs.length, input },
        );
      }
      const result = await scrapeContent(input, {
        userAgent: options.userAgent,
      });
      if (result == null) {
        failures++;
        continue;
      }
      if (i > 0) console.log();
      const sourceHeader = `${formatSource(input)}\n\n`;
      if (options.language == null) {
        console.log(`${sourceHeader}${result}`);
        if (outputs[i] != null) {
          await Deno.writeTextFile(outputs[i], `${sourceHeader}${result}\n`);
        }
      } else {
        const chunks: string[] = [sourceHeader];
        await Deno.stdout.write(encoder.encode(sourceHeader));
        try {
          for await (
            const chunk of translate(model!, result, options.language, {
              signal,
            })
          ) {
            chunks.push(chunk);
            await Deno.stdout.write(encoder.encode(chunk));
          }
        } catch (error) {
          logger.debug("Translation aborted: {error}", { error });
        }
        console.log();
        if (outputs[i] != null) {
          await Deno.writeTextFile(outputs[i], `${chunks.join("")}\n`);
        }
      }
    }
    if (failures > 0) {
      return await exit(1);
    }
  });

const summaryCommand = new Command<GlobalOptions, GlobalTypes>()
  .arguments("<urls...:string>")
  .description(
    "Summarize one or more text files or web pages and return the content " +
      "in Markdown format.  Inputs can be separated by spaces, commas, or " +
      "semicolons.  If you want to summarize a text from the standard " +
      "input, give `-` as the argument; `-` cannot be combined with other " +
      "inputs.",
  )
  .option(
    "-l, --language <language:string>",
    "The language code in ISO 639-1 to translate the content into.  " +
      "Do not translate if not specified.",
    (language) => {
      if (!isLanguageCode(language)) {
        throw new ValidationError(
          "-l/--language: Expected a valid language code.",
        );
      }
      return language;
    },
  )
  .option(
    "-o, --output <path:string>",
    "Save the summary to the given Markdown file.  Repeat the option once " +
      "per input to save each input separately.  The summary is still " +
      "printed to the standard output.",
    { collect: true },
  )
  .option(
    "-p, --paragraphs <paragraphs:number>",
    "The number of paragraphs to produce.",
    {
      default: 1,
      value(paragraphs) {
        if (paragraphs < 1 || !Number.isInteger(paragraphs)) {
          throw new ValidationError(
            "-p/--paragraphs: Expected a positive integer.",
          );
        }
        return paragraphs;
      },
    },
  )
  .option(
    "-t, --time <seconds:number>",
    "Wait the given number of seconds between processing each input.  " +
      "Useful for staying within provider rate limits such as llm7's " +
      "free tier.",
    {
      value(seconds) {
        if (seconds < 0 || !Number.isInteger(seconds)) {
          throw new ValidationError(
            "-t/--time: Expected a non-negative integer.",
          );
        }
        return seconds;
      },
    },
  )
  .option(
    "-u, --user-agent <userAgent:string>",
    "The User-Agent header to send in the HTTP request to the web page.",
  )
  .action(async (options, ...args: string[]) => {
    const inputs = splitInputs(args);
    const outputs = options.output ?? [];
    if (!validateInputs(inputs, outputs)) {
      return await exit(1);
    }
    const model = await getModel(options);
    const abortController = new AbortController();
    Deno.addSignalListener(
      "SIGINT",
      abortController.abort.bind(abortController),
    );
    const signal = abortController.signal;
    const encoder = new TextEncoder();
    let failures = 0;
    for (let i = 0; i < inputs.length && !signal.aborted; i++) {
      if (i > 0 && options.time != null && options.time > 0) {
        logger.info(
          "Waiting {seconds} seconds before the next input.",
          { seconds: options.time },
        );
        await sleep(options.time, signal);
      }
      if (signal.aborted) break;
      const input = inputs[i];
      if (inputs.length > 1) {
        logger.info(
          "Processing input {index} of {total}: {input}",
          { index: i + 1, total: inputs.length, input },
        );
      }
      const result = await scrapeContent(input, {
        userAgent: options.userAgent,
      });
      if (result == null) {
        failures++;
        continue;
      }
      if (i > 0) console.log();
      const sourceHeader = `${formatSource(input)}\n\n`;
      const chunks: string[] = [sourceHeader];
      await Deno.stdout.write(encoder.encode(sourceHeader));
      try {
        for await (
          const chunk of summarize(model, result, {
            targetLanguage: options.language,
            paragraphs: options.paragraphs,
            signal,
          })
        ) {
          chunks.push(chunk);
          await Deno.stdout.write(encoder.encode(chunk));
        }
      } catch (error) {
        logger.debug("Translation aborted: {error}", { error });
      }
      console.log();
      if (outputs[i] != null) {
        await Deno.writeTextFile(outputs[i], `${chunks.join("")}\n`);
      }
    }
    if (failures > 0) {
      return await exit(1);
    }
  });

const getModelCommand = new Command<GlobalOptions, GlobalTypes>()
  .description(
    "Get the configured default model and the corresponding API key.",
  )
  .action(async () => {
    const settings = await loadSettings();
    if (settings == null) {
      console.error("No model is configured.");
      return await exit(1);
    }
    console.log(`Model: ${settings.model}`);
    console.log(`API key: ${settings.apiKey}`);
  });

const modelsCommand = new Command()
  .description("List the supported model names.")
  .option(
    "--json",
    "Print the supported models in JSON format, including deprecated aliases.",
  )
  .action((options: { json?: boolean }) => {
    if (options.json) {
      console.log(JSON.stringify({ models: getModelCatalog() }, null, 2));
      return;
    }
    for (const model of getCanonicalModels()) {
      console.log(model.name);
    }
  });

const modelMoniker = new EnumType(modelMonikers);

const setModelCommand = new Command<GlobalOptions, GlobalTypes>()
  .arguments("<model:model>")
  .description(
    "Set the default model and the corresponding API key.  If the new " +
      "model is served by the same provider as the stored one, the stored " +
      "API key can be reused by leaving the prompt empty.",
  )
  .action(async (options, model) => {
    const canonicalModel = resolveModelMoniker(model);
    const settings = await loadSettings();
    const storedApiKey = settings != null &&
        sameModelProvider(settings.model, canonicalModel)
      ? settings.apiKey
      : undefined;
    let apiKey = options.apiKey;
    if (apiKey == null) {
      const entered = await Input.prompt(
        storedApiKey == null
          ? "API key:"
          : "API key (leave empty to reuse the stored key):",
      );
      apiKey = entered === "" && storedApiKey != null ? storedApiKey : entered;
    }
    const llm = await getModel({ model, apiKey });
    if (!await testModel(llm)) {
      console.error(
        "The model is not working; check the API key or your network connection.",
      );
      return await exit(1);
    }
    await saveSettings({ model: canonicalModel, apiKey });
  });

const command = new Command()
  .globalType("model", modelMoniker)
  .name("yoyak")
  .version(metadata.version)
  .meta("License", "GPL-3.0")
  .description("An LLM-powered CLI tool for summarizing web pages.")
  .help({ hints: true })
  .globalOption("-m, --model <model:model>", "The model to use.", {
    depends: ["api-key"],
  })
  .globalOption("-a, --api-key <apiKey:string>", "The API key for the model.")
  .globalOption("-d, --debug", "Enable debug logging.", {
    async action(options) {
      if (!options.debug) return;
      await configure({
        contextLocalStorage: new AsyncLocalStorage(),
        sinks: { console: consoleSink },
        loggers: [
          {
            category: ["logtape", "meta"],
            lowestLevel: "warning",
            sinks: ["console"],
          },
          { category: ["yoyak"], lowestLevel: "debug", sinks: ["console"] },
        ],
        reset: true,
      });
    },
  })
  .command("summary", summaryCommand)
  .command("scrape", scrapeCommand)
  .command("models", modelsCommand)
  .command("get-model", getModelCommand)
  .command("set-model", setModelCommand)
  .command("completions", new CompletionsCommand());

if (import.meta.main) {
  const result = await command.parse(Deno.args);
  // @ts-ignore: result.cmd and the command can be the same
  if (result.cmd === command) {
    console.error("Please specify a subcommand.");
    await exit(1);
  }
}
