# Callout Tracker

Callout Tracker creates a clickable index of selected Obsidian callouts. It works locally in your vault and does not use network services.

## Usage

Add a `callout-tracker` code block to any note:

```callout-tracker
callouts: todo, idea, note
rootfolder: Campaign
```

`callouts:` is a comma- or space-separated list of callout types. If it is omitted, the default list is `idea, note, todo`.

`rootfolder:` limits the search to that folder and its subfolders. If it is omitted, Callout Tracker uses the default root folder from **Settings → Callout Tracker**. The setting is empty by default, which searches the whole vault.

In the settings, use **Ignore prefixes** to exclude matching file and folder names. Enter multiple prefixes separated by commas; whitespace around each value is removed. The field contains `_` by default.

Under **Custom callouts**, select **Add custom callout** to define the appearance of a native callout. Each definition supports a name, font color, background color, optional border and border color, and optional icon name. The icon field suggests available Obsidian icons while you type and shows a live preview. These styles are applied to normal Obsidian callouts such as `> [!idea]` and update when the setting changes.

Each result shows its note and line number. Select a result to open the note and place the cursor on the callout.

When editing a `callout-tracker` block, type on a new line to get suggestions for `callouts:` and `rootfolder:`.

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
