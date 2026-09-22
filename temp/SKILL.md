---
name: callout-tracking
description: Create, edit, query, and maintain Obsidian callouts and Callout Tracker overview blocks for organizing campaign ideas, notes, todos, hooks, rules, clues, properties, and summaries.
---

# Callout Tracking

Use this skill when creating, reviewing, organizing, querying, or cleaning up tracked callouts in the campaign vault.

## Callout format

A valid callout starts with `>` followed by optional whitespace and `[!callout-name]`.

The header is optional:

> [!idea] Possible betrayal

A callout can contain multiple following lines. Every continuation line must start with `>` followed by optional whitespace:

> [!idea] Possible betrayal
> The merchant may be working for the enemy.
> Look for evidence before confronting them.

The callout ends at the first following line that does not start with `>`.

Preserve existing links, Markdown formatting, and other callouts when editing.

## Use Callout Tracker

To create a dedicated overview note, such as `Callout Tracker.md`, use:

```callout-tracker
callouts: callout-name, another-callout-name
rootfolder: MyRoot
search: optional text
filter: {status} = "planned"
summary: "Count: " + count()
display: All
```

The plugin scans the selected folder and displays matching callouts grouped by type. Each result is clickable and opens the source note at the callout’s line.

`rootfolder:` is optional. If omitted, the plugin uses its configured default root folder. An empty default root folder searches the entire vault. Markdown and Canvas files are scanned.

`callouts:` accepts one or more callout names separated by commas or spaces. The order determines how results are grouped: callouts of the first type appear first, followed by the next types.

Only add optional settings when they are useful. Do not add empty or unnecessary settings.

While editing a block, the plugin suggests available settings. `callouts:`, `rootfolder:`, `search:`, `filter:`, and `display:` are single-use settings and are not suggested again once present in the same block. `summary:` can be added repeatedly. After `callouts:`, it suggests callout names configured in the plugin settings. Suggestions also work after commas.

## Add a search section

Add a `search:` line to a `callout-tracker` block:

```callout-tracker
callouts: todo, idea
rootfolder: Campaign
search: tavern
```

For tracker blocks, the search is case-insensitive and checks the callout header and body.

Remove the `search:` line or leave it empty to show all selected callouts.

Multiple overview blocks can be used for different purposes:

```callout-tracker
callouts: todo
search: unresolved
```

```callout-tracker
callouts: idea, hook
search: village
```

## Filter callouts by properties

Callout properties use `key:: value` lines directly below the callout header:

> [!cost] Buy tickets
> cost:: 46
> status:: planned

Property names cannot contain spaces. The property section ends at the first continuation line that is not a property. A blank `>` line can separate properties from normal callout text.

Use `filter:` to compare properties. It supports strings, numbers, arithmetic (`+`, `-`, `*`, `/`), comparisons (`=`, `!=`, `<`, `>`, `<=`, `>=`), parentheses, `&`, and `|`:

```callout-tracker
callouts: cost
filter: ({cost} + {fee}) / 2 >= 25 & {status} = "planned"
```

Missing or non-numeric values fail arithmetic comparisons. `&` is evaluated before `|`.

## Display summaries

Use one or more `summary:` lines to render calculated rows above the matching callouts:

```callout-tracker
callouts: cost
filter: {status} = "planned"
summary: "Total: " + sum({cost}) + "€"
summary: "Average: " + avg({cost}) + "€"
summary: "Items: " + count()
display: All
```

Supported functions are `count()`, `sum(expression)`, `avg(expression)`, `max(expression)`, and `min(expression)`. Properties can only be used inside these functions. Numeric functions ignore missing or non-numeric values; `count()` counts all callouts remaining after search and filtering.

`display:` defaults to `All`. Use `OnlySummary` to hide callouts or `OnlyCallouts` to hide summaries.

## Query the Callout Tracker API

Use the Callout Tracker API when structured callout data is needed for reasoning, recommendations, or AI-assisted organization.

Read [references/api.md](references/api.md) for the complete API reference and CLI examples.

Do not use UI automation, a Node.js REPL, source-code inspection, or manual file scanning when the API can provide the required results.

The API is available after the Callout Tracker plugin is enabled and loaded in the target vault.

The main method is:

`api.search(options?)`

Supported options:

- `callouts`: An array or comma-separated string of callout types. Defaults to `idea`, `note`, and `todo`.
- `rootFolder`: An optional folder path. Defaults to the plugin’s configured root folder.
- `search`: Optional case-insensitive text searched in the file name, callout title, and callout body.
- `filter`: Optional property and arithmetic filter, such as `{status} = "planned"` or `{cost} / 2 > 20`.

Each result contains:

- `fileName`
- `filePath`
- `line`
- `type`
- `title`
- `body`
- `properties`: An array of `{key, value}` property objects.

When using the Obsidian CLI from Bash, locate the plugin by its API instead of using `app.plugins.plugins["callout-tracker"]`. Nested quotes can be stripped by the shell.

To retrieve all default callouts:

`obsidian vault="Vault Name" eval 'code=Object.values(app.plugins.plugins).find(p => p?.api?.search)?.api.search().then(results => JSON.stringify(results))'`

To query specific types and text:

`obsidian vault="Vault Name" eval "code=Object.values(app.plugins.plugins).find(p => p?.api?.search)?.api.search({callouts:['hook','clue'],search:'dragon',rootFolder:'Campaign'}).then(results => JSON.stringify(results))"`

To calculate a summary and receive the matching callouts:

`obsidian vault="Vault Name" eval 'code=Object.values(app.plugins.plugins).find(p=>p?.api?.summarize)?.api.summarize({callouts:["cost"],filter:"{cost} > 40",summary:"Total: " + sum({cost}) + "€"}).then(result=>JSON.stringify(result))'`

The summary API returns an object with `value` and `callouts`. The `callouts` array uses the same result shape as `api.search()`.

The API search is asynchronous. Always serialize the result with `.then(results => JSON.stringify(results))`.

An empty array means that no matching callouts were found. An `undefined` result usually means that Callout Tracker is not enabled or loaded. Report actual CLI errors instead of guessing.

The `test()` API method should only be used to diagnose whether the bridge is working.

## Callout meanings

- `[!idea]` — proposed or speculative content.
- `[!note]` — important context that should be surfaced, but is not unfinished work.
- `[!todo]` — unfinished preparation, unresolved questions, or a concrete follow-up action.
- `[!hook]` — a possible plot hook, lead, or story opportunity.
- `[!rule]` — a campaign rule, constraint, or agreed decision.
- `[!clue]` — an unresolved clue, discovery, or piece of information to revisit.

Use any custom callout type defined in Callout Tracker settings when it better describes the item. Check `AGENTS.md` or other vault instructions for additional project-specific callout types.

## Rules

- Keep callouts short, specific, and close to the content they describe.
- For `[!idea]`, clearly preserve its proposed status.
- For `[!todo]`, describe the missing decision or action instead of writing a vague reminder.
- For `[!hook]`, record the story opportunity and its relevant context.
- For `[!rule]`, write the rule or decision clearly enough to apply later.
- For `[!clue]`, preserve what is known and identify what remains unresolved.
- Use custom callout types when they improve organization.
- Do not use tags for this tracking system. Use properties when structured values, filtering, or summaries are useful.
- Do not duplicate the same tracked item across multiple notes unless the duplication is useful for context.
- When a TODO is completed, remove it or rewrite it to reflect the remaining work.
- Do not rewrite unrelated note content.
- Preserve existing links, formatting, and other callouts when editing.
