# Summary test data

These callouts contain only properties so the summary results are easy to verify.

> [!test] Alpha
> cost:: 40
> bonus:: 5
> status:: planned

> [!test] Beta
> cost:: 60
> bonus:: 10
> status:: planned

> [!test] Gamma
> cost:: 20
> bonus:: 0
> status:: done

> [!test] Delta
> cost:: 80
> bonus:: 20
> status:: planned

> [!test] No cost
> bonus:: 3
> status:: planned

## Count

Expected result: `5`

```callout-tracker
callouts: test
summary: count()
```

## Sum

Expected result: `200`

```callout-tracker
callouts: test
summary: sum({cost})
```

## Average

Expected result: `50`

```callout-tracker
callouts: test
summary: avg({cost})
```

## Maximum

Expected result: `80`

```callout-tracker
callouts: test
summary: max({cost})
```

## Minimum

Expected result: `20`

```callout-tracker
callouts: test
summary: min({cost})
```

## String formatting

Expected result: `Total: 200€ | Average: 50€`

```callout-tracker
callouts: test
summary: "Total: " + sum({cost}) + "€ | Average: " + avg({cost}) + "€"
```

## Arithmetic inside sum

Expected result: `118`

The callout without a cost is ignored. The calculation is `(cost / 2) + 4.5` for each callout before the values are summed.

```callout-tracker
callouts: test
summary: sum({cost} / 2 + 4.5)
```

## Arithmetic inside average

Expected result: `58.75`

The average uses `cost + bonus` for each callout with a numeric cost.

```callout-tracker
callouts: test
summary: avg({cost} + {bonus})
```

## Summary after filtering

Expected result: `Planned total: 180€ | Planned count: 4`

The summary uses only the callouts that match the filter.

```callout-tracker
callouts: test
filter: {status} = "planned"
summary: "Planned total: " + sum({cost}) + "€ | Planned count: " + count()
```

## Summary with a numeric filter

Expected result: `140`

```callout-tracker
callouts: test
filter: {cost} > 50
summary: sum({cost})
```

## No matching numeric values

Expected result: `0` and no matching callouts below it.

```callout-tracker
callouts: test
filter: {status} = "missing"
summary: sum({cost})
```
