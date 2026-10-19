# Collapsible callout test data

## Default mode

Expected: **Open by default** starts expanded, **Closed by default** starts collapsed, and **No collapse marker** stays non-collapsible. Properties remain visible even when a result is collapsed. The file link opens each source callout.

```callout-tracker
callouts: testCollapse
collapse: Default
```

## Force all results collapsed

Expected: all five results start collapsed, including callouts without a source collapse marker. Selecting a title expands it.

```callout-tracker
callouts: testCollapse
collapse: Collapsed
```

## Force all results expanded

Expected: all five results start expanded, including callouts marked `-` in their source. Selecting a title collapses it.

```callout-tracker
callouts: testCollapse
collapse: Expanded
```

## Source callouts

> [!testCollapse]+ Open by default
> This body should be visible when the tracker renders.

> [!testCollapse]- Closed by default
> status:: visible while collapsed
> This body should be hidden until the tracker header is selected.

> [!testCollapse] No collapse marker
> This body should be visible, and selecting the card opens the source in Default mode.

> [!testCollapse]+ [ ] Open with checkbox
> The checkbox should update the source while preserving the plus marker.

> [!testCollapse]- [x] Closed with checkbox
> status:: visible while collapsed
> The checkbox should update the source while preserving the minus marker.
