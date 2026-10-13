# Order by test data

These callouts test ascending and descending property sorting. Callouts without the sort property, or with an empty value, should always appear last.

> [!testOrder] Alpha
> priority:: 2
> cost:: 40
> name:: Alpha

> [!testOrder] Beta
> priority:: 1
> cost:: 80
> name:: Beta

> [!testOrder] Gamma
> priority:: 3
> cost:: 20
> name:: Gamma

> [!testOrder] No priority
> cost:: 60
> name:: No priority

> [!testOrder] Empty priority
> priority::
> cost:: 10
> name:: Empty priority

## Ascending

Expected order: Beta, Alpha, Gamma, No priority, Empty priority

```callout-tracker
callouts: testOrder
orderBy: asc({priority})
```

## Descending

Expected order: Gamma, Alpha, Beta, No priority, Empty priority

```callout-tracker
callouts: testOrder
orderBy: desc({priority})
```

## Text sorting

Expected order: Alpha, Beta, Empty priority, Gamma, No priority

```callout-tracker
callouts: testOrder
orderBy: asc({name})
```

The text test sorts the `name::` property alphabetically.

## Title ascending

Expected order: Alpha, Beta, Empty priority, Gamma, No priority

```callout-tracker
callouts: testOrder
orderBy: asc(title)
```

## Title descending

Expected order: No priority, Gamma, Empty priority, Beta, Alpha

```callout-tracker
callouts: testOrder
orderBy: desc(title)
```

## Invalid syntax

Expected result: an `Invalid orderBy` error.

```callout-tracker
callouts: testOrder
orderBy: ascending({priority})
```

## Multiple expressions

Expected result: an `Invalid orderBy` error.

```callout-tracker
callouts: testOrder
orderBy: asc({priority}), desc({cost})
```
