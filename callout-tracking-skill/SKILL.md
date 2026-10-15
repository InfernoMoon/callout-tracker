---
name: callout-tracking
description: Create, edit, and query Obsidian callouts and Callout Tracker overviews, including property filters, checkbox state, grouping, sorting, summaries, and structured API queries.
---

# Callout Tracking

Maintain tracked callouts and useful overviews without rewriting unrelated notes.

Use `obsidian-note-taking` for note-editing, file-format, and block-placement rules. Read [query expressions](references/queries.md) when composing filters, summaries, sorting, or grouping, and [the API reference](references/api.md) when retrieving structured results.

## Write tracked callouts

The marker is required; the title is optional. A tracked header starts with `>`, optional whitespace, and `[!type]`, optionally followed immediately by a folding marker (`-` or `+`), then whitespace before any title. Every continuation line begins with `>`; the first unquoted line ends the callout.

> [!idea] Possible betrayal
> The merchant may be working for the enemy.
> Look for evidence before confronting them.

Separate adjacent tracked callouts with an unquoted blank line. Nested callouts are part of the outer tracked body rather than independent results.

### Optional folding

- `[!idea]- Title`: foldable callout, initially collapsed.
- `[!idea]+ Title`: foldable callout, initially expanded.
- `[!idea] Title`: ordinary callout without folding.

Place the sign directly after `]`, before the title. Choose folding when useful and preserve existing folding markers during unrelated edits. These options control the source callout's presentation; `groupBy:` separately controls collapsible tracker groups. See [Obsidian's folding syntax](https://obsidian.md/help/callouts).

### Properties

Place consecutive `key:: value` lines directly below the header:

> [!cost] Buy tickets
> cost:: 46
> status:: planned
> priority:: 2
>
> For the evening event.

Property names cannot contain whitespace or colons. The property section ends at its first non-property line; a blank `>` line separates it from ordinary text. Values are plain text, not YAML or JSON. Keep numeric properties numeric when using arithmetic, such as `cost:: 46` with the currency in the summary. Property references use braces, such as `{cost}`; lookups are case-insensitive.

### Checkboxes and completion

Default to TODO callouts **without checkboxes**. Preserve existing checkbox use or add it when requested:

> [!todo] [ ] Prepare the dungeon

> [!todo] [x] Prepare the dungeon

The checkbox belongs at the beginning of the title after the callout marker; `[x]` and `[X]` mean checked. Tracker checkboxes update the original Markdown header. Canvas results have no source line and do not offer that tracker toggle.

When completion is authorized, check an existing checkbox; otherwise remove the completed TODO callout. Preserve unrelated note content. A query finding an old or completed item does not itself authorize an edit.

## Tracker blocks

A minimal overview uses:

````markdown
```callout-tracker
callouts: todo, idea
```
````

Block contents are plain-text settings, not YAML. Add optional settings only when useful; omit empty or unnecessary lines.

| Setting | Meaning |
| --- | --- |
| `callouts:` | Comma- or space-separated types; omitted defaults to `idea, note, todo`, not every custom type |
| `rootfolder:` | Folder and subfolders; omitted uses the configured default root; empty means the whole vault |
| `search:` | One case-insensitive text search in title, properties, and body; omitted or empty adds no text restriction |
| `filter:` | One global property/checkbox expression selecting displayed callouts and summary input |
| `filter name:` | A named filter for summary aggregates; different names can be defined in the same block |
| `summary:` | A calculated row above results; repeat for multiple rows |
| `groupBy:` | One property: `{status}`, `asc({status})`, or `desc({status})` |
| `orderBy:` | One sort key: `asc(title)`, `desc(title)`, `asc({priority})`, or `desc({priority})` |
| `display:` | `All` (default), `OnlySummary`, or `OnlyCallouts` |

Without `groupBy:`, results follow the `callouts:` type order. Without `orderBy:`, each type shows entries without a checkbox, then unchecked entries, then checked entries. Property groups and explicit sorting change this arrangement; see [sorting and grouping](references/queries.md#sorting-and-grouping).

Search and the global filter select the input first. Named filters narrow individual aggregates; they do not hide displayed callouts. Grouping changes presentation, and summaries still use all selected callouts rather than calculating per-group totals.

The plugin scans Markdown files and Canvas text nodes. Markdown results open the source line; Canvas results open the `.canvas` file. Settings under **Callout Tracker** control the default root, ignored prefixes, and custom callout styling. The default ignored prefix `_` excludes matching file basenames and any containing folders. Read relevant settings when needed; change configuration only when requested.

Autocomplete offers settings, configured callout names (including after commas), properties, filter/summary functions, named-filter references, and sort/group expressions. Ordinary settings are single-use; `summary:` repeats and `filter name:` allows distinct names. Do not duplicate single-use settings: the parser keeps the last value.

## Query structured data

Prefer the Callout Tracker API when it can provide the required results. Read [references/api.md](references/api.md) for `search`, `summarize`, result fields, and CLI examples. Use `test()` only to diagnose bridge availability.

Do not substitute UI automation, a Node.js REPL, source-code inspection, or manual vault scanning for an available API query. If the plugin or bridge is unavailable, report the actual failure; a targeted read-only file scan may answer the request, with its source and limitations disclosed.

An empty result is not a bridge failure. Queries and recommendations do not authorize editing, completing, or deleting the returned items.

## Callout meanings and maintenance

- `[!idea]`: proposed or speculative content; preserve that status.
- `[!note]`: important context, without implying unfinished work.
- `[!todo]`: unfinished preparation, a missing decision, or a concrete follow-up action.

Use established custom types when they fit better; follow applicable vault conventions for additional types. Custom-callout settings control text/background colors, borders, and icons in both notes and tracker results.

Keep callouts short, specific, and near the content they describe. Use callout types and properties for this tracking system rather than Obsidian tags. Avoid duplicating the same tracked item across notes unless context makes the duplication useful. Preserve links, Markdown, and unrelated callouts during edits.

## Verification

Check the requested type/folder scope, ignored prefixes, property placement, checkbox semantics, and expression syntax. Verify summary inputs, named-filter references, and sort/group behavior with the relevant reference. Invalid expressions produce errors; an empty result can also be a valid query with no matches. Report only observed API or rendering results.

Sources: [README](https://github.com/InfernoMoon/callout-tracker#readme)