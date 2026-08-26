# Callout Tracker

Callout Tracker helps you stay organized in a large Obsidian vault by collecting important callouts into one clickable overview.

Instead of interrupting your writing to maintain a separate task list or idea document, leave callouts where they naturally belong in your notes. Mark a thought as an `idea`, a task as a `todo`, or a useful suggestion as a custom callout such as `note`, `idea`, or `clue`. Callout Tracker then lets you review those items together, find what still needs to be done, revisit suggestions from your notes, and develop ideas that need more attention.

The overview is grouped by callout type, searchable, and linked back to the exact note and line where each callout appears. This makes it easier to turn scattered thoughts across your vault into an organized workflow. It works locally in your vault and does not use network services.

## Usage

Add a `callout-tracker` code block to any note:

```callout-tracker
callouts: todo, idea, note
rootfolder: Campaign
search: dragon
```

`callouts:` is a comma- or space-separated list of callout types. If it is omitted, the default list is `idea, note, todo`.

`rootfolder:` limits the search to that folder and its subfolders. If it is omitted, Callout Tracker uses the default root folder from **Settings → Callout Tracker**. The setting is empty by default, which searches the whole vault.

`search:` is optional. When present, only callouts whose header or body contains the search text are displayed. The search is case-insensitive.

In the settings, use **Ignore prefixes** to exclude matching file and folder names. Enter multiple prefixes separated by commas; whitespace around each value is removed. The field contains `_` by default.

Under **Custom callouts**, select **Add custom callout** to define the appearance of a native callout. Each definition supports a name, font color, background color, optional border and border color, and optional icon name.

Each result shows its note and line number. Select a result to open the note and place the cursor on the callout.


Callouts can use either of these forms:

```markdown
> [!idea] A useful thought
> More details here.

>[!todo]
> Finish the draft.
```

## Development

```bash
npm install
npm run dev
```

Run a production build and lint check with:

```bash
npm run build
npm run lint
```
