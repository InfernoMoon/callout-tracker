# Callout Tracker API

Read this reference completely when structured callout data is needed for searches, reasoning, recommendations, or AI-assisted organization.

## Availability and preferred access

The API exists only after the Callout Tracker plugin is enabled and loaded in the target Obsidian vault. Do not claim it is available until a query succeeds.

Use this access order:

1. Use the Callout Tracker API when the target vault and plugin bridge are available.
2. If the API returns `undefined`, report that the plugin may be disabled, unloaded, or unavailable through the current bridge.
3. If the task is read-only and can still be answered from vault files, fall back to a targeted file search.
4. Do not edit notes merely because a query found stale, duplicate, or completed items.

The `test()` method is only for diagnosing whether the bridge works; do not use it for ordinary searches.

## Search method

The main method is asynchronous:

```javascript
api.search(options?)
```

Supported options:

| Option | Type and behavior |
| --- | --- |
| `callouts` | Array or comma-separated string of types; defaults to `idea`, `note`, and `todo` |
| `rootFolder` | Optional vault-relative folder; defaults to the plugin's configured root |
| `search` | Optional case-insensitive text matched against filename, title, properties, and body |
| `filter` | Optional property and arithmetic filter, such as `{status} = "planned"` or `{cost} / 2 > 20` |

Each result contains:

- `fileName`
- `filePath`
- `line`
- `type`
- `title`
- `body`
- `properties` — an array of `{key, value}` objects

An empty array is a successful query with no matches. An `undefined` result usually indicates that the plugin is not enabled or loaded. Preserve and report actual CLI or bridge errors rather than replacing them with guesses.

Markdown results include a 1-based `line`. Canvas results do not include a line because Canvas callouts are stored inside text nodes; open the `.canvas` file instead.

## Summary method

Use `api.summarize(options)` when a calculated value and the matching callouts are needed together:

```javascript
api.summarize({
  callouts: ['cost'],
  filter: '{status} = "planned"',
  summary: '"Total: " + sum({cost}) + "€"',
})
```

The summary method accepts the same `callouts`, `rootFolder`, `search`, and `filter` options as `api.search()`, plus a required `summary` expression. Supported functions are `count()`, `sum(expression)`, `avg(expression)`, `max(expression)`, and `min(expression)`. It returns:

```javascript
{
  value: 'Total: 180€',
  callouts: [...],
}
```

Numeric functions ignore missing or non-numeric property values. `count()` counts all callouts remaining after search and filtering. Summary expressions are parsed explicitly and are not executed as JavaScript.

## Obsidian CLI bridge

Locate the loaded plugin by the presence of `api.search` instead of assuming the plugin registry key:

```javascript
Object.values(app.plugins.plugins).find(plugin => plugin?.api?.search)?.api
```

Always serialize the asynchronous result:

```javascript
Object.values(app.plugins.plugins)
  .find(plugin => plugin?.api?.search)
  ?.api.search(options)
  .then(results => JSON.stringify(results))
```

Adapt command quoting to the active shell. Avoid constructing commands from untrusted text without proper argument handling.

Retrieve the default callouts:

```text
obsidian vault="Vault Name" eval 'code=Object.values(app.plugins.plugins).find(p => p?.api?.search)?.api.search().then(results => JSON.stringify(results))'
```

Query selected types and text:

```text
obsidian vault="Vault Name" eval "code=Object.values(app.plugins.plugins).find(p => p?.api?.search)?.api.search({callouts:['hook','clue'],search:'dragon',rootFolder:'Campaign'}).then(results => JSON.stringify(results))"
```

The block setting is named `rootfolder:`, while the API option is `rootFolder`. Do not interchange their capitalization.

To calculate a summary through the Obsidian CLI:

```text
obsidian vault="Vault Name" eval 'code=Object.values(app.plugins.plugins).find(p=>p?.api?.summarize)?.api.summarize({callouts:["cost"],filter:"{cost} > 40",summary:"Total: " + sum({cost}) + "€"}).then(result=>JSON.stringify(result))'
```

## Read-only fallback

When the API is unavailable, search only the intended vault scope. Parse a callout from its `[!type]` marker through the consecutive following lines beginning with `>`.

- Preserve source file paths and line numbers in reported results.
- Apply type, folder, and text filters consistently with the request.
- Do not treat arbitrary blockquotes as tracked callouts.
- State that results came from a file scan rather than the plugin API, especially if exact parity with plugin behavior cannot be guaranteed.

## Troubleshooting API queries

If an API query fails:

1. Tell the user to enable **Settings → General → Command line interface** in Obsidian, then retry the command.

2. If the command still fails, tell the user to update the Obsidian installer. Download Obsidian again from [obsidian.md/download](https://obsidian.md/download) and install the Windows executable. Use installer version **1.12.7 or newer**.

3. After installing, restart Obsidian and the terminal, then retry the final API command.
