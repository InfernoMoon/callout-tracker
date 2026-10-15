# Callout Tracker Query Expressions

Use for `callout-tracker` filters, named filters, summaries, sorting, and grouping. Filters and summaries share the same expression language with the API. Sorting is supported by both; grouping is block-only.

## Filters

Refer to properties with braces, such as `{cost}`. Strings must be quoted; both single and double quotes work. Numeric properties should contain numbers rather than currency or unit suffixes.

Supported operators are arithmetic `+`, `-`, `*`, `/`; comparisons `=`, `!=`, `<`, `>`, `<=`, `>=`; logical AND `&` and OR `|`; and negation `!`. Arithmetic follows normal precedence, `&` binds before `|`, and parentheses group conditions.

````markdown
```callout-tracker
callouts: cost
filter: ({cost} + {fee}) / 2 >= 25 & {status} = "planned"
```
````

| Function or keyword | Meaning |
| --- | --- |
| `exists({prop})` | The property exists, even if its value is empty |
| `empty({prop})` | The property exists with an empty or whitespace-only value |
| `missingOrEmpty({prop})` | The property is absent or empty |
| `contains({topic}, "dragon")` | Case-insensitive substring match |
| `startsWith({status}, "plan")` | Case-insensitive prefix match |
| `in({status}, "planned", "active")` | Equality with any listed string or number, not a substring search |
| `checked` | The header checkbox exists and is checked |
| `hasCheckbox` | The header has either a checked or unchecked checkbox |

Use `hasCheckbox & !checked` for unchecked checkbox tasks. `!checked` also matches callouts without a checkbox; `!hasCheckbox` selects those plain callouts. Keywords take no parentheses.

Negate a function or keyword directly, or parenthesize a comparison: `!exists({completed})`, `!checked`, `!({status} = "archived")`.

Property names and string comparisons are case-insensitive. Numeric comparisons use numeric values; relational operators do not compare ordinary text alphabetically. Missing and empty values make comparisons fail, including `!=`; use the existence functions when absence matters. Missing or non-numeric operands also make filter arithmetic fail. Division by zero raises an error rather than silently excluding the entry.

## Sorting and grouping

`orderBy:` accepts exactly one `asc(title)`, `desc(title)`, `asc({property})`, or `desc({property})` expression. `title` is the callout title; `{title}` would instead refer to a custom property with that name. Numeric pairs sort numerically; other values sort alphabetically without case sensitivity. Missing or empty values remain last in either direction.

`groupBy:` accepts exactly one property. `{status}` keeps first-seen group order; `asc({status})` and `desc({status})` sort group labels numerically or alphabetically. Property values differing only in case share a group. Missing or empty values go in a final **No value** group, regardless of direction.

````markdown
```callout-tracker
callouts: todo, idea
groupBy: asc({status})
orderBy: asc({priority})
```
````

Groups are collapsible and initially expanded. Without grouping, `orderBy:` sorts inside each callout type, preserving the `callouts:` type order. With grouping, it sorts entries across types inside each property group; ties fall back to type order and then checkbox order. Without an explicit sort, grouped entries follow type order and then checkbox order.

Neither setting accepts multiple keys or arbitrary JavaScript expressions. `groupBy: title` is invalid: grouping requires a property reference.

Grouping does not change summary inputs or create per-group summaries. For separate totals, use named-filter aggregates or separate tracker blocks with the relevant global filters.

## Named filters and summaries

Define a global `filter:` to select the block's input. Define `filter name:` for reusable predicates that individual aggregates can apply to that already-selected input. Names start with a letter and may contain letters, digits, underscores, or hyphens. References are case-insensitive; define each name once.

````markdown
```callout-tracker
callouts: cost
filter: exists({cost})
filter planned: {status} = "planned"
filter paid: checked
summary: "Total: " + sum({cost}) + "€"
summary: "Average: " + avg({cost}) + "€"
summary: "Items: " + count()
summary: "Planned: " + sum({cost}, planned) + "€"
summary: "Paid items: " + count(paid)
display: All
```
````

Each `summary:` creates its own row. Named filters do not alter displayed results or other aggregates unless referenced.

| Aggregate | Meaning |
| --- | --- |
| `count()` | Count all selected callouts |
| `count(planned)` | Count the named filter's subset |
| `count({cost})` | Count entries containing the property, including an empty value |
| `count({cost}, planned)` | Count property presence within a named subset |
| `sum(expression)` | Sum numeric values |
| `avg(expression)` | Mean of numeric values |
| `min(expression)`, `max(expression)` | Smallest or largest numeric value |
| `median(expression)` | Median, averaging the middle pair for an even count |
| `range(expression)` | Maximum minus minimum |

Each numeric aggregate accepts an optional named filter as its second argument, such as `sum({cost}, planned)` or `median({cost}, planned)`. Arithmetic works inside aggregates, such as `sum({cost} / 2 + 4.5)`, and between aggregates, such as `sum({cost}, planned) / count(planned)`.

Numeric aggregates skip missing or non-numeric direct property values and return `0` when no numeric values remain. Keep numeric inputs consistent: arithmetic involving text can raise an error instead of being skipped. Division by zero is an error, including ratios whose denominator is an empty subset.

Properties can appear only inside aggregates, and aggregates cannot be nested. Unknown named filters are errors. Quoted text and `+` compose the output; these expressions are parsed by the plugin rather than executed as JavaScript.

`display: All` shows summaries and callouts. `OnlySummary` hides callouts; `OnlyCallouts` hides summaries.

## Common checks

- A property below a blank quoted line or ordinary body text is not part of the property block.
- A named filter narrows an aggregate, not the whole overview.
- `!checked` includes plain callouts; use `hasCheckbox & !checked` when the checkbox must exist.
- Keep `orderBy:` and `groupBy:` to their supported single-key forms.
- A syntax error, arithmetic error, or unknown named filter is not evidence that the vault has no matching callouts.