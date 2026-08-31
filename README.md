# Callout Tracker

Callout Tracker helps you stay organized in a large vault by collecting important callouts into one clickable overview.

Instead of interrupting your writing to maintain a separate task list or idea document, leave callouts where they naturally belong in your notes. Mark a thought as an `idea`, a task as a `todo`, or a useful suggestion as a custom callout such as `note` or `warning`. Callout Tracker then lets you review those items together, find what still needs to be done, revisit suggestions from your notes, and develop ideas that need more attention.

The overview is grouped by callout type, searchable, and linked back to the exact note and line where each callout appears. This makes it easier to turn scattered thoughts across your vault into an organized workflow. It works locally in your vault and does not use network services.

![Callout Tracker Overview](assets/overview.gif)

## Usage

Use Callouts in your notes to mark important thoughts, tasks, and suggestions.
```
> [!idea] A useful thought
> More details here.

> [!todo] Finish the draft
```
<br>

Add a `callout-tracker` code block to any note:
```callout-tracker
callouts: todo, idea, note
rootfolder: MyRoot
search: myfilter
```

`callouts:` is a comma- or space-separated list of callout types. If it is omitted, the default list is `idea, note, todo`.

`rootfolder:` limits the search to that folder and its subfolders. If it is omitted, Callout Tracker uses the default root folder from **Settings → Callout Tracker**. The setting is empty by default, which searches the whole vault.

`search:` is optional. When present, only callouts whose header or body contains the search text are displayed. The search is case-insensitive.

In the settings, use **Ignore prefixes** to exclude matching file and folder names. Enter multiple prefixes separated by commas; whitespace around each value is removed. The field contains `_` by default.

## Customize callouts

Under **Custom callouts** settings you can define the appearance of a callouts and add custom ones. Each definition supports a name, font color, background color, optional border and border color, and optional icon name.
The settings show a live preview, so you can see how the callout will look while you edit it. These styles are applied both to normal Obsidian callouts and to callouts displayed in the tracker.

![Callout Settings](assets/callout-settings.png)
