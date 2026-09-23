# Filter test data

These callouts test arithmetic inside `filter:` expressions.

> [!testFilter] Alpha
> cost:: 40
> bonus:: 5
> status:: planned

> [!testFilter] Beta
> cost:: 60
> bonus:: 10
> status:: planned

> [!testFilter] Gamma
> cost:: 20
> bonus:: 0
> status:: done

> [!testFilter] Delta
> cost:: 80
> bonus:: 20
> status:: planned

> [!testFunction] Empty note
> note::

> [!testFunction] Dragon hook
> tags:: dragon, forest
> status:: active

> [!testFunction] Planned hook
> tags:: village
> status:: planned

> [!testFunction] Finished hook
> tags:: city, dragon
> status:: finished

## Division

Expected: Beta, Delta

```callout-tracker
callouts: testFilter
filter: {cost} / 2 > 20
```

## Addition

Expected: Alpha, Beta, Delta

```callout-tracker
callouts: testFilter
filter: {cost} + {bonus} >= 45
```

## Multiplication

Expected: Alpha

```callout-tracker
callouts: testFilter
filter: {cost} * 2 = 80
```

## Arithmetic parentheses

Expected: Alpha, Beta, Delta

```callout-tracker
callouts: testFilter
filter: ({cost} + {bonus}) / 5 >= 9
```

## Arithmetic with string comparison

Expected: Beta, Delta

```callout-tracker
callouts: testFilter
filter: {cost} / 2 > 20 & {status} = "planned"
```

## OR with arithmetic

Expected: Gamma, Delta

```callout-tracker
callouts: testFilter
filter: {cost} < 25 | {cost} + {bonus} >= 100
```

## Operator precedence

`&` is evaluated before `|`.

Expected: Beta, Gamma, Delta

```callout-tracker
callouts: testFilter
filter: {cost} > 50 | {status} = "done" & {bonus} = 0
```

## Boolean parentheses

Expected: Beta, Delta

```callout-tracker
callouts: testFilter
filter: ({cost} > 50 | {status} = "done") & {bonus} > 0
```

## Arithmetic on one side of a comparison

Expected: Beta, Delta

```callout-tracker
callouts: testFilter
filter: {cost} + 5 > 45
```

## Missing property in arithmetic

Expected: No matching callouts.

```callout-tracker
callouts: testFilter
filter: {missing} + 1 > 0
```

## Does not exist

Expected: Alpha, Beta, Gamma, Delta

```callout-tracker
callouts: testFilter
filter: !exists({missing})
```

## Negated condition

Expected: Gamma

```callout-tracker
callouts: testFilter
filter: !(exists({status}) & {status} = "planned")
```

## Exists

Expected: Alpha, Beta, Gamma, Delta

```callout-tracker
callouts: testFilter
filter: exists({status})
```

## Exists with a comparison

Expected: Alpha, Beta, Delta

```callout-tracker
callouts: testFilter
filter: exists({status}) & {status} = "planned"
```

## Empty property

Expected: Empty note

```callout-tracker
callouts: testFunction
filter: empty({note})
```

## Contains

Expected: Dragon hook, Finished hook

```callout-tracker
callouts: testFunction
filter: contains({tags}, "dragon")
```

## Starts with

Expected: Dragon hook, Planned hook

```callout-tracker
callouts: testFunction
filter: startsWith({tags}, "dragon") | startsWith({tags}, "village")
```

## In

Expected: Dragon hook, Planned hook

```callout-tracker
callouts: testFunction
filter: in({status}, "active", "planned")
```
