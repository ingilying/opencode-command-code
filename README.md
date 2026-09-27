# opencode-command-code

An [OpenCode](https://opencode.ai/v2/docs/build/plugins) v2 plugin that adds a **Command Code**
provider, authenticated with your Command Code API key.

```
> build · deepseek/deepseek-v4-flash
```

## What it does

- Reads your API key from `~/.commandcode/auth.json` (the file `cmd login` writes). No key in config.
- Fetches the live Command Code catalog from `GET {baseURL}/models` and registers every model that
  speaks the OpenAI-compatible wire (`/chat/completions`).
- Registers the provider as `command-code`, so models are selected as `command-code/<model-id>`.
- Refreshes the catalog every 1 hour, so new models appear without restarting OpenCode.

Claude models that only expose the Anthropic Messages wire are skipped — Command Code rejects them
on `/chat/completions`.

## Requirements

- OpenCode 2.x
- A Command Code API key: run `cmd login`, or export `COMMAND_CODE_API_KEY`

## Install

```bash
npm install        # installs @opencode/plugin, required at runtime
```

Then point OpenCode at the directory. Global (`~/.config/opencode/opencode.jsonc`) or per project:

```jsonc
{
  "plugins": ["/path/to/opencode-command-code"]
}
```

Per project you can also drop the entry next to your code instead of listing it:

```
<project>/.opencode/plugins/command-code/index.ts
```

## Usage

```bash
opencode run -m command-code/deepseek/deepseek-v4-flash "hello"
opencode run -m command-code/zai-org/GLM-5.3 "explain this repo"
```

Model IDs are the ones from the Command Code catalog, `/`-separated from the provider:
`command-code/deepseek/deepseek-v4-flash`, `command-code/Qwen/Qwen3.8-Max`, …

Availability still follows your Command Code plan — models above your tier answer with
`MODEL_NOT_IN_PLAN`.

## Configuration

Plugin options (object form in `plugins`):

```jsonc
{
  "plugins": [
    {
      "package": "/path/to/opencode-command-code",
      "options": {
        "apiKey": "...",
        "baseURL": "https://api.commandcode.ai/provider/v1"
      }
    }
  ]
}
```

| Option | Env var | Default |
| --- | --- | --- |
| `apiKey` | `COMMAND_CODE_API_KEY` | key from `~/.commandcode/auth.json` |
| `baseURL` | `COMMAND_CODE_BASE_URL` | `https://api.commandcode.ai/provider/v1` |

## Notes

- If you previously hand-wired Command Code in `opencode.jsonc`, remove that `providers.commandcode`
  block — it hardcodes the API key in plaintext and duplicates this plugin's provider.
- Load failures and registration errors are logged: run OpenCode with `--print-logs` and look for
  `[command-code]`.
