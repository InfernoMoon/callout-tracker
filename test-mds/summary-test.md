# Summary test data

These callouts contain only properties so the summary results are easy to verify.

> [!testSum] Alpha
> cost:: 40
> bonus:: 5
> status:: planned

> [!testSum] Beta
> cost:: 60
> bonus:: 10
> status:: planned

> [!testSum] Gamma
> cost:: 20
> bonus:: 0
> status:: done

> [!testSum] Delta
> cost:: 80
> bonus:: 20
> status:: planned

> [!testSum] No cost
> bonus:: 3
> status:: planned

## Count

Expected result: `5`

```callout-tracker
callouts: testSum
summary: count()
```

## Sum

Expected result: `200`

```callout-tracker
callouts: testSum
summary: sum({cost})
```

## Count with a property

Expected result: `4`

The callout without a cost property is not counted.

```callout-tracker
callouts: testSum
summary: count({cost})
```

## Average

Expected result: `50`

```callout-tracker
callouts: testSum
summary: avg({cost})
```

## Maximum

Expected result: `80`

```callout-tracker
callouts: testSum
summary: max({cost})
```

## Minimum

Expected result: `20`

```callout-tracker
callouts: testSum
summary: min({cost})
```

## Median

Expected result: `50`

The numeric costs are `20`, `40`, `60`, and `80`, so the median is the average of `40` and `60`.

```callout-tracker
callouts: testSum
summary: median({cost})
```

## Range

Expected result: `60`

The range is `80 - 20`.

```callout-tracker
callouts: testSum
summary: range({cost})
```

## String formatting

Expected result: `Total: 200€ | Average: 50€`

```callout-tracker
callouts: testSum
summary: "Total: " + sum({cost}) + "€ | Average: " + avg({cost}) + "€"
```

## Arithmetic inside sum

Expected result: `118`

The callout without a cost is ignored. The calculation is `(cost / 2) + 4.5` for each callout before the values are summed.

```callout-tracker
callouts: testSum
summary: sum({cost} / 2 + 4.5)
```

## Arithmetic inside average

Expected result: `58.75`

The average uses `cost + bonus` for each callout with a numeric cost.

```callout-tracker
callouts: testSum
summary: avg({cost} + {bonus})
```

## Summary after filtering

Expected result: `Planned total: 180€ | Planned count: 4`

The summary uses only the callouts that match the filter.

```callout-tracker
callouts: testSum
filter: {status} = "planned"
summary: "Planned total: " + sum({cost}) + "€ | Planned count: " + count()
```

## Summary with a numeric filter

Expected result: `140`

```callout-tracker
callouts: testSum
filter: {cost} > 50
summary: sum({cost})
```

## Named filters

Expected result: `Planned twice: 360 | Done: 20`

Named filters are applied separately to the callouts already selected by the block. This lets one summary combine multiple subsets.

```callout-tracker
callouts: testSum
filter planned: {status} = "planned"
filter done: {status} = "done"
summary: "Planned twice: " + sum({cost}, planned) * 2 + " | Done: " + sum({cost}, done)
```

## No matching numeric values

Expected result: `0` and no matching callouts below it.

```callout-tracker
callouts: testSum
filter: {status} = "missing"
summary: sum({cost})
```

## Display only the summary

Expected: the summary row is shown, and the callout results are hidden.

```callout-tracker
callouts: testSum
display: OnlySummary
summary: "Total: " + sum({cost}) + "€"
```

## Display only the callouts

Expected: the callout results are shown, and no summary row is shown.

```callout-tracker
callouts: testSum
display: OnlyCallouts
summary: "This summary is hidden"
```

## Display everything

Expected: both the summary row and the callout results are shown.

```callout-tracker
callouts: testSum
display: All
summary: "Total: " + sum({cost}) + "€"
```

## Multiple summary rows

Expected rows:

```text
Total: 200€
Average: 50€
Items: 5
```

```callout-tracker
callouts: testSum
summary: "Total: " + sum({cost}) + "€"
summary: "Average: " + avg({cost}) + "€"
summary: "Items: " + count()
```
