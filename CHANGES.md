Yoyak changelog
===============

Version 0.7.0
-------------

To be released.

 -  Added `-o`/`--output` option to `yoyak summary` and `yoyak scrape`
    commands to save the output to a Markdown file.  The output is still
    printed to the standard output.

 -  `yoyak summary` and `yoyak scrape` now accept multiple inputs in one
    run.  Inputs can be separated by spaces, commas, or semicolons, and
    `-o`/`--output` can be repeated once per input to save each output
    to its own Markdown file.  If an input fails, the run continues with
    the remaining inputs and exits non-zero at the end.

 -  The output of `yoyak summary` and `yoyak scrape` now starts with a
    `Source:` line identifying the input it was produced from, both on
    the standard output and in saved Markdown files, so batched runs and
    saved files remain attributable to their inputs.

 -  Added `-t`/`--time` option to `yoyak summary` and `yoyak scrape`
    commands to wait a given number of seconds between processing each
    input, which helps stay within provider rate limits such as llm7's
    free tier (60 requests per minute).

 -  `yoyak set-model` now offers to reuse the stored API key when switching
    between models of the same provider (e.g., between `llm7/` models),
    so the key does not need to be re-entered.

 -  Added models served through [llm7], an OpenAI-compatible API that offers
    free credits.  They are prefixed with `llm7/` and share a single llm7
    API key:

     -  `llm7/claude-haiku-5-5`
     -  `llm7/claude-opus-5-5`
     -  `llm7/claude-sonnet-5`
     -  `llm7/codestral`
     -  `llm7/deepseek-v4-flash`
     -  `llm7/deepseek-v4-pro`
     -  `llm7/deepseek-v4.1-flash`
     -  `llm7/gemini-3.8-flash-high`
     -  `llm7/gemini-3.1-flash-lite`
     -  `llm7/glm-5.3`
     -  `llm7/glm-5.3-flash`
     -  `llm7/gpt-6-sol`
     -  `llm7/gpt-6.1-sol`
     -  `llm7/gpt-oss-20b`
     -  `llm7/grok-4.6`
     -  `llm7/kimi-k3`
     -  `llm7/llama-4-maverick`
     -  `llm7/mistral-large-3`
     -  `llm7/mistral-nemo`
     -  `llm7/minimax-m3`
     -  `llm7/nemotron-3-nano`

[llm7]: https://llm7.io/


Version 0.6.0
-------------

Released on March 23, 2026.

 -  Added `-p`/`--paragraphs` option to `yoyak summary` command to specify the
    number of paragraphs to produce.  The default value is 1.

 -  Added model `gemma3`. [[#2] by Juil Kim]

 -  Refreshed the supported model catalog to track current provider offerings,
    including newer Gemini 3 and GPT-5.4 era models.

 -  Older configured model names remain accepted and are automatically mapped
    to the current canonical model names when settings are loaded or updated.

 -  Added `yoyak models` command to list supported model names directly from
    the terminal, with optional JSON output for scripts and tooling. [[#3]]

[#2]: https://github.com/dahlia/yoyak/pull/2
[#3]: https://github.com/dahlia/yoyak/issues/3


Version 0.5.2
-------------

Released on April 18, 2025.

 -  Added more models:

     -  `gemini-2.5-flash-preview-04-17`
     -  `gemini-2.5-pro-preview-03-25`
     -  `gpt-4.1`
     -  `o3`
     -  `o4-mini`


Version 0.5.1
-------------

Released on March 10, 2025.

 -  Enhanced translation capabilities to properly handle documents of any size,
    ensuring complete translations without content loss.


Version 0.5.0
-------------

Released on March 6, 2025.

 -  The `yoyak scrape` and `yoyak summary` commands now accept a local file path
    and `-` as an argument.  If `-` is given, the commands read the input from
    the standard input.

 -  The output of the `yoyak scrape` and `yoyak summary` commands is now
    streamed to the standard output.  This change allows you to process the
    output in real-time.

 -  The `yoyak scrape` and `yoyak summary` commands now accept `SIGINT`
    <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop the process gracefully.  If they are
    interrupted, no more tokens are consumed, and the process is terminated
    after the current token is processed.

 -  Added `-d`/`--debug` option to enable debug logging.

 -  Added more models:

     -  `claude-3-7-sonnet-latest`
     -  `gemini-2.0-flash-lite`
     -  `gemini-2.0-flash`
     -  `gpt-4.5-preview`


Version 0.4.0
-------------

Released on February 17, 2025.

 -  Moved the path of the configuration file to:

     -  Linux: *`$XDG_CONFIG_HOME`/yoyak/config.toml* or
        *`$HOME`/.config/yoyak/config.toml*
     -  macOS: *`$XDG_CONFIG_HOME`/yoyak/config.toml* or
        *`$HOME`/.config/yoyak/config.toml*
     -  Windows: *`%APPDATA%`\yoyak\config.toml*

 -  The `-l`/`--language` option now skips translation if the source language is
    the same as the target language.


Version 0.3.0
-------------

Released on February 10, 2025.

 -  We now distribute the official executables for Linux, macOS, and Windows.
    You can download them from the [releases page].

 -  Added `-u`/`--user-agent` option to `yoyak scrape` and `yoyak summary`
    commands to specify a custom `User-Agent` string.

 -  Yoyak now can be identified through its unique `User-Agent` string.  The
    `User-Agent` string is `Yoyak/0.3.0` followed by the version of Deno, e.g.,
    `Yoyak/0.3.0 (Deno/2.1.9)`.  [[#1]]

[#1]: https://github.com/dahlia/yoyak/issues/1
[releases page]: https://github.com/dahlia/yoyak/releases


Version 0.2.0
-------------

Released on February 7, 2025.

 -  Now more text encodings other than UTF-8 are supported.  All available
    encodings are listed in the [iconv-lite project's documentation].

 -  Added more Gemini models:

     -  `gemini-2.0-flash-lite-preview-02-05`
     -  `gemini-2.0-flash-thinking-exp-01-21`
     -  `gemini-2.0-pro-exp-02-05`

[iconv-lite project's documentation]: https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings


Version 0.1.0
-------------

Initial release.  Released on February 5, 2025.
