# Checkbox test data

Use this note to test interactive checkboxes in the Callout Tracker results.

```callout-tracker
callouts: testCheckbox
```

The rendered order should be: no checkbox marker, unchecked, then checked.

> [!testCheckbox] No checkbox marker
> This should appear before unchecked and checked callouts.

> [!testCheckbox] [ ] Unchecked callout
> This should become checked when clicked in the tracker.

> [!testCheckbox] [x] Checked callout
> This should become unchecked when clicked in the tracker.

> [!testCheckbox] [x]No-space title
> The checkbox should still be recognized when there is no space after `[x]`.
