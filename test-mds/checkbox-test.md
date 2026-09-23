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

## Checked

Expected: Checked callout, No-space title

```callout-tracker
callouts: testCheckbox
filter: checked
```

## Has checkbox

Expected: Unchecked callout, Checked callout, No-space title

```callout-tracker
callouts: testCheckbox
filter: hasCheckbox
```

## Explicitly unchecked

Expected: Unchecked callout

```callout-tracker
callouts: testCheckbox
filter: hasCheckbox & !checked
```

## No checkbox marker

Expected: No checkbox marker

```callout-tracker
callouts: testCheckbox
filter: !hasCheckbox
```
