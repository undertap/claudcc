# cc-doctor

**Is your Claude Code setup optimal?**

A local, read-only dashboard that inspects the Claude Code installation on your machine — skills, plugins, MCP servers, hooks, CLAUDE.md, and settings — and scores each component by how helpful it's actually being to you.

No telemetry, no cloud. Runs on `localhost`, reads `~/.claude/` directly.

## Install & run

```bash
npx cc-doctor
```

That starts a local server, opens `http://localhost:7337` in your browser, and shows you a spatial map of your setup with helpfulness scores.

## The helpfulness score

Each skill / plugin / MCP / hook gets a score from 0–100 based on:

- **Usage** — how often it's invoked and in what share of your sessions
- **Ratings** — your own 1–5 ratings of recent sessions, attributed to the tools that were active
- **Status** — errors, missing configs, dormancy are all penalized

Without ratings, scores top out at 75 (we tell you the signal is usage-only). Once you start rating sessions, the ceiling opens up.

### Enabling session ratings

The rating hook is opt-in. Install it once:

```bash
npx cc-doctor install-hook
```

From then on, Claude Code asks you to rate each session in your terminal when it ends. Low ratings (≤3) get an optional "what didn't work?" follow-up. Ratings are attributed to every tool/MCP that was active in that session, so the dashboard can tell you which ones are actually pulling their weight.

Ratings live at `~/.cc-doctor/ratings.json` (local only). To remove the hook:

```bash
npx cc-doctor uninstall-hook
```

The installer backs up your `~/.claude/settings.json` before touching it.

## What it reads

| Source | What we extract |
| --- | --- |
| `~/.claude/skills/` + plugin-bundled skills | Skills (name, description, tools) |
| `~/.claude/plugins/marketplaces/**` | Installed plugins |
| `~/.claude/settings.json` → `mcpServers` | MCP servers |
| `~/.claude/mcp-needs-auth-cache.json` | MCP auth-error state |
| `~/.claude/settings.json` → `hooks` | Hooks |
| `~/.claude/CLAUDE.md`, `<cwd>/CLAUDE.md` | CLAUDE.md instructions |
| `~/.claude/settings.json`, `settings.local.json` | Model, permissions |
| `~/.claude/projects/**/*.jsonl` | Session logs → invocation counts, sparklines, last-used |
| `~/.cc-doctor/ratings.json` | Session ratings (populated by the hook) |

All reads. No writes to `~/.claude/` except `install-hook` / `uninstall-hook` (which back up first).

## Flags

```
cc-doctor                   Start the dashboard (opens browser)
cc-doctor install-hook      Install the session-rater Stop hook
cc-doctor uninstall-hook    Remove the session-rater hook
cc-doctor --port <n>        Serve on a specific port (default: 7337)
cc-doctor --no-open         Don't auto-open the browser
cc-doctor --version         Print version
```

## Architecture

```
bin/cli.js         # entry: parse flags, start server or run hook subcommand
server/
  index.js         # Node http server (no deps): static files + /api/*
  scan.js          # orchestrator — runs scanners in parallel, merges usage + ratings
  score.js         # helpfulness score formula
  paths.js         # CLAUDE_HOME, DOCTOR_HOME, safe fs helpers
  scanners/
    skills.js      # reads SKILL.md frontmatter
    plugins.js     # reads plugin.json / package.json
    mcp.js         # reads mcpServers from settings.json
    hooks.js       # reads hooks.* from settings.json
    claudemd.js    # global + project CLAUDE.md
    settings.js    # surfaces model + permissions as entity rows
    sessions.js    # parses ~/.claude/projects/**/*.jsonl for invocation counts
    ratings.js     # loads/saves ~/.cc-doctor/ratings.json
hook/
  rate-session.js  # Stop hook: prompts for rating, appends to ratings.json
  install.js       # install/uninstall in settings.json (idempotent, backs up)
web/
  index.html       # shell — loads React via CDN + bootstraps App
  src/
    styles.css     # warm-cream editorial theme, Instrument Serif + JetBrains Mono
    data.js        # fetches /api/data, fills window.__DATA__
    app.jsx        # main shell, sidebar + section routing
    systemmap.jsx  # spatial SVG of your whole setup
    drawer.jsx     # right-side detail drawer
    table.jsx      # entity list with score column
    rater.jsx      # helpfulness leaderboard + score pills
    charts.jsx     # spark / hero charts
```

The frontend uses in-browser Babel for the JSX (CDN React). That's fine for a local tool — it means zero install step for contributors. If that becomes a bottleneck we'll switch to a pre-built bundle.

## Design credit

UI ported from the "Claude Code Mentor" design in [Anthropic Design](https://claude.ai/design). Warm cream palette, Instrument Serif + JetBrains Mono + Inter, vermillion accent.

## License

MIT
