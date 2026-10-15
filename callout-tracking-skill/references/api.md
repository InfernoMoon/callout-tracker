# Callout Tracker API

Read this reference when structured callout data is needed for searches, reasoning, recommendations, or organization. The API is available only after Callout Tracker is enabled and loaded in the target vault.

## Access and scope

Prefer this API when it can answer the request. Locate the plugin by its API and manifest identity rather than relying on a registry key or selecting another plugin that happens to expose `api.search`:

```javascript
const api = Object.values(app.plugins.plugins)
  .find(plugin => plugin?.manifest?.id === 'callout-tracker'
    && typeof plugin.api?.search === 'function')?.api;
```

`test()` is only for diagnosing the bridge. Ordinary searches use asynchronous `search`; calculations use asynchronous `summarize`. Await the result before JSON serialization, or return a promise ending in `.then(result => JSON.stringify(result))`.

## Search

```javascript
await api.search(); // Default types and configured root.

await api.search({
  callouts: ['hook', 'clue'],
  rootFolder: 'Campaign',
  search: 'dragon',
  filter: 'exists({status}) & {status} = "planned"',
  orderBy: 'asc(title)',
});
```

| Option | Behavior |
| --- | --- |
| `callouts` | Array or comma-/space-separated string of types; omitted or empty defaults to `idea, note, todo` |
| `rootFolder` | Vault-relative folder; omitted uses the configured root, and an empty string searches the whole vault |
| `search` | Case-insensitive text in filename, title, properties, and body |
| `filter` | The same property, arithmetic, checkbox, and function expressions used by tracker blocks |
| `orderBy` | One `asc(title)`, `desc(title)`, `asc({property})`, or `desc({property})` expression |

The API returns a flat array in requested callout-type order, with `orderBy` sorting within each type. Missing/empty sort values are last. It has **no `groupBy` option** and does not promise the renderer's default checkbox ordering.

The block setting is `rootfolder:`; the API option is `rootFolder`. Do not interchange their spelling. Root selection still respects configured ignored file/folder prefixes.

Each result contains `fileName`, `filePath`, `type`, `title`, `body`, and `properties` (an array of `{key, value}` objects). Markdown results also contain a **1-based** `line`. Canvas results omit `line`; they identify the Canvas file rather than a node or source line.

Checkbox state is available to filter predicates such as `checked` and `hasCheckbox`, but is **not returned as a `checked` field** in version 1.1.6. Properties are separated from `body` and header checkbox markers are separated from `title`.

An empty array is a successful search with no matches. An `undefined` result from an optional-chained bridge can indicate an unloaded or unavailable plugin; it is not an empty result. Preserve actual CLI/API errors rather than guessing their cause.

Unlike block `search:`, API `search` also checks the filename.

## Summaries

`summarize(options)` accepts the search options plus a required `summary` string and optional `namedFilters` mapping names to filter-expression strings:

```javascript
await api.summarize({
  callouts: ['cost'],
  filter: 'exists({cost})',
  namedFilters: {
    planned: '{status} = "planned"',
  },
  summary: '"Total: " + sum({cost}, planned) + "€"',
  orderBy: 'desc({cost})',
});
```

The result is `{value, callouts}`. `value` is the calculated string. `callouts` contains every result of the global search/filter, not just a named aggregate's subset, with the same shape and ordering as `search`.

Pass the **whole expression as a string**. Functions such as `sum` belong to the plugin's expression language; do not call JavaScript `sum({cost})` while constructing the options. See [query expressions](queries.md#named-filters-and-summaries) for all aggregates, named-filter syntax, and arithmetic limits.

## Obsidian CLI bridge

Use the general `obsidian-note-taking` command workflow to select the vault and diagnose CLI access. This PowerShell example retrieves a calculated total and its globally matching callouts:

```powershell
$calloutQuery = @'
(async () => {
  const api = Object.values(app.plugins.plugins)
    .find(plugin => plugin?.manifest?.id === 'callout-tracker'
      && typeof plugin.api?.search === 'function')?.api;
  if (!api) throw new Error('Callout Tracker API is unavailable in this vault');
  return JSON.stringify(await api.summarize({
    callouts: ['cost'],
    filter: 'exists({cost})',
    namedFilters: { planned: `{status} = 'planned'` },
    summary: `'Total: ' + sum({cost}, planned) + '€'`,
    orderBy: 'desc({cost})',
  }));
})()
'@
obsidian vault="Vault Name" eval "code=$calloutQuery"
```

Replace `Vault Name` with the intended vault. Use the same bridge with `api.search()` for defaults or `api.search(options)` for selected types, text, and filters. The single-quoted here-string preserves JavaScript quotes and backticks; adapt argument handling for other shells rather than copying incompatible quoting. Keep user-provided text as data rather than inserting it into executable code without proper encoding.

## Failures and read-only fallback

- For unavailable CLI access or connection failures, ask the user to open Obsidian, enable **Settings → General → Command line interface**, complete registration, and restart the terminal, then retry. See the [official CLI documentation](https://obsidian.md/help/cli).
- If CLI setup still fails or the setting is missing, check the installer requirement: **1.12.7 or newer**. The Windows terminal launcher is `Obsidian.com`. Ask the user to update the installer if needed and restart Obsidian and the terminal.
- If the CLI works but this API is unavailable, check that Callout Tracker is enabled in the selected vault. If an expression fails, report and correct its syntax or data issue rather than treating it as a CLI setup failure.
- If a newer documented feature is unsupported, compare the installed plugin version with the skill's 1.1.6 target.

When the API is unavailable and a read-only task can still be answered from files, search only the intended scope. Respect selected types, root, ignored prefixes, and checkbox/property parsing. Preserve paths and Markdown line numbers; Canvas matches require reading text nodes from the Canvas JSON. Do not treat ordinary blockquotes as callouts. Disclose that results came from a file scan and any limits in matching plugin behavior.

Do not edit notes merely because returned items appear stale, duplicated, or completed.

Sources: [API](https://github.com/InfernoMoon/callout-tracker/blob/fc0d60a07a6bdf73b62b23c84fa047602c76e410/src/api.ts), [scanner](https://github.com/InfernoMoon/callout-tracker/blob/fc0d60a07a6bdf73b62b23c84fa047602c76e410/src/callout-scanner.ts), and [expression reference](queries.md).