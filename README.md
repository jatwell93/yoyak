Yoyak: An LLM-powered CLI tool for summarizing web pages
========================================================

[![Demo session][Demo session thumbnail]][Demo session]

This is a small CLI tool that uses LLM to summarize and translate web pages.

> [!NOTE]
> This repository is a clone of [dahlia/yoyak] by Hong Minhee with a few
> extra features: llm7 model support, batched inputs with a configurable
> delay, `Source:` attribution lines, and Markdown file output.  All
> credit for the original tool goes to its author.

[dahlia/yoyak]: https://github.com/dahlia/yoyak
[Demo session thumbnail]:  https://asciinema.org/a/706701.svg
[Demo session]: https://asciinema.org/a/706701


Installation
------------

We distribute the official executables for Linux, macOS, and Windows.  You can
download them from the [releases page].

Or if you have [Deno] installed on your system, you can install this program by
running the following command:

~~~~ bash
deno install -gENRSW jsr:@hongminhee/yoyak/cli
~~~~

[releases page]: https://github.com/dahlia/yoyak/releases
[Deno]: https://deno.com/


Usage
-----

At very first, you need to set the model you want to use. You can do this by
running the following command (see also [supported models](#supported-models)
below):

~~~~ bash
yoyak set-model llm7/gpt-oss-20b
~~~~

It asks for the API key via the standard input, and stores it in configuration
file.  If you later switch to another model served by the same provider
(e.g., another `llm7/` model), you can reuse the stored key by pressing
<kbd>Enter</kbd> at the prompt instead of re-typing it.

If you want to discover the currently supported models from the terminal,
run:

~~~~ bash
yoyak models
~~~~

Then you can use the `yoyak summary` command to summarize a web page:

~~~~ bash
yoyak summary https://github.com/dahlia/yoyak
~~~~

It prints the summary of the web page to the standard output.  Use
`-o`/`--output` to also save it to a Markdown file:

~~~~ bash
yoyak summary -o summary.md https://github.com/dahlia/yoyak
~~~~

You can summarize several pages in one run by passing multiple inputs
separated by spaces, commas, or semicolons:

~~~~ bash
yoyak summary https://example.com/a https://example.com/b
yoyak summary "https://example.com/a,https://example.com/b"
~~~~

When processing multiple inputs, repeat `-o`/`--output` once per input to
save each summary to its own file:

~~~~ bash
yoyak summary -o a.md -o b.md https://example.com/a https://example.com/b
~~~~

Every output starts with a `Source:` line identifying the input it was
produced from—both on the terminal and in saved Markdown files—so batched
output and saved files stay attributable to their link.

Use `-t`/`--time` to wait a number of seconds between inputs.  This helps
stay within provider rate limits; llm7's free tier, for example, allows
60 requests per minute, so `--time 60` keeps a batch well below that:

~~~~ bash
yoyak summary --time 60 https://example.com/a https://example.com/b
~~~~

If you want to translate the summary to another language, you can use
the `-l`/`--language` option (which takes [ISO 639-1] language code):

~~~~ bash
yoyak summary -l ko https://github.com/dahlia/yoyak
~~~~

It translates the summary to Korean.

> [!TIP]
> You can also give a local file path or `-` as an input.  If `-` is given,
> the command reads the input from the standard input; `-` cannot be
> combined with other inputs.

The `yoyak scrape` command accepts the same input formats and supports
the `-o`/`--output` and `-t`/`--time` options as well.

[ISO 639-1]: https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes


Shell completion
----------------

Yoyak provides shell completion scripts for bash, fish, and zsh.

### Bash

To enable bash completion, add the following line to your *~/.bashrc* or
*~/.bash_profile*:

~~~~ bash
source <(yoyak completions bash)
~~~~

### Fish

To enable fish completion, add the following line to your
*~/.config/fish/config.fish*:

~~~~ fish
source (yoyak completions fish | psub)
~~~~

### Zsh

To enable zsh completion, add the following line to your *~/.zshrc*:

~~~~ zsh
source <(yoyak completions zsh)
~~~~

Or run the following command to use zsh fpath completions:[^1]

~~~~ zsh
yoyak completions zsh > /usr/local/share/zsh/site-functions/_yoyak
~~~~

[^1]: The *site-functions* path may vary depending on your system.


Supported models
----------------

Yoyak exposes the supported canonical model names directly from the CLI:

~~~~ bash
yoyak models
~~~~

For machine-readable output, use:

~~~~ bash
yoyak models --json
~~~~

Models prefixed with `llm7/` are served through [llm7], an OpenAI-compatible
API that offers free credits.  `yoyak set-model` accepts an llm7 API key for
them, e.g.:

~~~~ bash
yoyak set-model llm7/gpt-oss-20b
~~~~

Note that llm7 gates some models behind a paid balance; if `set-model` fails
with an *insufficient balance* error, top up or pick a free-tier model such
as `llm7/gpt-oss-20b`, `llm7/deepseek-v4-flash`, `llm7/glm-5.3-flash`,
`llm7/codestral`, `llm7/mistral-nemo`, or `llm7/nemotron-3-nano`.

[llm7]: https://llm7.io/

Older configured model names are still accepted and are mapped to the current
canonical names when settings are loaded or updated.


Etymology
---------

Yoyak ([要約]) is a Sino-Korean word that means *summary*.

[要約]: https://en.wiktionary.org/wiki/%EC%9A%94%EC%95%BD#Etymology_1

<!-- cSpell: ignore gENRSW psub fpath Sino-Korean -->
