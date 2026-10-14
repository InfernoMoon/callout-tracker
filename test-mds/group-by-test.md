# Group by test data

These callouts test visual grouping, ordering inside groups, missing values, and summaries across all groups.

> [!testGroup] Alpha
> status:: planned
> priority:: 2
> cost:: 40

> [!testGroup] Beta
> status:: done
> priority:: 1
> cost:: 80

> [!testGroup] Gamma
> status:: planned
> priority:: 1
> cost:: 20

> [!testGroup] Delta
> status:: done
> priority:: 3
> cost:: 60

> [!testGroup] No status
> priority:: 4
> cost:: 10

> [!testGroup] Empty status
> status::
> priority:: 5
> cost:: 5

## Grouped and sorted

Expected groups in first-seen order: planned, done, No value.

Expected order inside `planned`: Gamma, Alpha.

Expected order inside `done`: Beta, Delta.

The `No status` and `Empty status` callouts should be in the final `No value` group.

```callout-tracker
callouts: testGroup
groupBy: {status}
orderBy: asc({priority})
```

## Groups ascending

Expected groups: done, planned, No value.

Expected order inside `planned`: Gamma, Alpha.

```callout-tracker
callouts: testGroup
groupBy: asc({status})
orderBy: asc({priority})
```

## Groups descending

Expected groups: planned, done, No value.

```callout-tracker
callouts: testGroup
groupBy: desc({status})
```

## Numeric group order

Expected groups: 1, 2, 3, 4, 5.

```callout-tracker
callouts: testGroup
groupBy: asc({priority})
```

## Summary ignores groups

Expected summary: `Count: 6 | Total cost: 215`

The summary is calculated across all matching callouts, not separately for each group.

```callout-tracker
callouts: testGroup
groupBy: {status}
summary: "Count: " + count() + " | Total cost: " + sum({cost})
```

## Invalid groupBy

Expected result: an `Invalid groupBy` error.

```callout-tracker
callouts: testGroup
groupBy: {status}, {priority}
```

## Invalid group order syntax

Expected result: an `Invalid groupBy` error.

```callout-tracker
callouts: testGroup
groupBy: ascending({status})
```
