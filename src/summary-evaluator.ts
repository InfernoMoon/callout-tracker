import type { CalloutEntry } from './types';

type SummaryValue = number | string | null;
type AggregateName = 'count' | 'sum' | 'avg' | 'max' | 'min' | 'median' | 'range';

type SummaryExpression =
	| { kind: 'literal'; value: number | string }
	| { kind: 'property'; name: string }
	| { kind: 'binary'; operator: '+' | '-' | '*' | '/'; left: SummaryExpression; right: SummaryExpression }
	| { kind: 'aggregate'; name: AggregateName; argument?: SummaryExpression };

export class SummaryExpressionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SummaryExpressionError';
	}
}

export function evaluateSummary(expression: string, entries: CalloutEntry[]): string {
	const parser = new SummaryExpressionParser(expression);
	const syntaxTree = parser.parse();
	const value = evaluateExpression(syntaxTree, entries, undefined, false, true);
	return value === null ? '' : String(value);
}

class SummaryExpressionParser {
	private position = 0;

	constructor(private readonly source: string) {}

	parse(): SummaryExpression {
		const expression = this.parseAdditive();
		this.skipWhitespace();
		if (!this.atEnd()) {
			throw this.error(`Unexpected character '${this.source[this.position] ?? ''}'.`);
		}
		return expression;
	}

	private parseAdditive(): SummaryExpression {
		let expression = this.parseMultiplicative();
		while (true) {
			const operator = this.consumeOperator('+') || this.consumeOperator('-');
			if (!operator) {
				return expression;
			}
			expression = {
				kind: 'binary',
				operator,
				left: expression,
				right: this.parseMultiplicative(),
			};
		}
	}

	private parseMultiplicative(): SummaryExpression {
		let expression = this.parsePrimary();
		while (true) {
			const operator = this.consumeOperator('*') || this.consumeOperator('/');
			if (!operator) {
				return expression;
			}
			expression = {
				kind: 'binary',
				operator,
				left: expression,
				right: this.parsePrimary(),
			};
		}
	}

	private parsePrimary(): SummaryExpression {
		this.skipWhitespace();
		const character = this.source[this.position];
		if (character === '(') {
			this.position++;
			const expression = this.parseAdditive();
			this.expect(')');
			return expression;
		}
		if (character === '"' || character === "'") {
			return { kind: 'literal', value: this.readQuotedString(character) };
		}
		if (character === '{') {
			return { kind: 'property', name: this.readPropertyName() };
		}

		const number = this.source.slice(this.position).match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/)?.[0];
		if (number) {
			this.position += number.length;
			return { kind: 'literal', value: Number(number) };
		}

		const name = this.source.slice(this.position).match(/^[A-Za-z][A-Za-z0-9_]*/)?.[0];
		if (name) {
			this.position += name.length;
			return this.parseFunction(name);
		}

		throw this.error('Expected a number, string, property, function, or opening parenthesis.');
	}

	private parseFunction(rawName: string): SummaryExpression {
		const name = rawName.toLowerCase();
		if (!isAggregateName(name)) {
			throw this.error(`Unknown summary function '${rawName}'.`);
		}

		this.expect('(');
		this.skipWhitespace();
		if (this.consume(')')) {
			if (name !== 'count') {
				throw this.error(`${name}() requires an expression.`);
			}
			return { kind: 'aggregate', name };
		}

		const argument = this.parseAdditive();
		this.expect(')');
		if (name === 'count') {
			if (argument.kind !== 'property') {
				throw this.error('count() requires a property reference when an argument is provided.');
			}
		}
		return { kind: 'aggregate', name, argument };
	}

	private readPropertyName(): string {
		this.expect('{');
		const end = this.source.indexOf('}', this.position);
		if (end < 0) {
			throw this.error("Expected '}'.");
		}

		const name = this.source.slice(this.position, end).trim();
		this.position = end;
		this.expect('}');
		if (!name || /\s|:/.test(name)) {
			throw this.error('Property names must not contain whitespace or colons.');
		}
		return name;
	}

	private readQuotedString(quote: string): string {
		this.position++;
		let value = '';
		while (!this.atEnd()) {
			const character = this.source[this.position++];
			if (character === quote) {
				return value;
			}
			if (character === '\\') {
				if (this.atEnd()) {
					break;
				}
				const escaped = this.source[this.position++];
				value += escaped === 'n' ? '\n' : escaped;
			} else {
				value += character;
			}
		}

		throw this.error('Unterminated quoted string.');
	}

	private consumeOperator(operator: '+' | '-' | '*' | '/'): '+' | '-' | '*' | '/' | null {
		this.skipWhitespace();
		if (this.source[this.position] !== operator) {
			return null;
		}
		this.position++;
		return operator;
	}

	private consume(character: string): boolean {
		this.skipWhitespace();
		if (this.source[this.position] !== character) {
			return false;
		}
		this.position++;
		return true;
	}

	private expect(character: string): void {
		if (!this.consume(character)) {
			throw this.error(`Expected '${character}'.`);
		}
	}

	private skipWhitespace(): void {
		while (/\s/.test(this.source[this.position] ?? '')) {
			this.position++;
		}
	}

	private atEnd(): boolean {
		return this.position >= this.source.length;
	}

	private error(message: string): SummaryExpressionError {
		return new SummaryExpressionError(`${message} Position ${this.position + 1}.`);
	}
}

function evaluateExpression(
	expression: SummaryExpression,
	entries: CalloutEntry[],
	entry: CalloutEntry | undefined,
	allowProperty: boolean,
	allowAggregate: boolean,
): SummaryValue {
	switch (expression.kind) {
		case 'literal':
			return expression.value;
		case 'property':
			if (!allowProperty) {
				throw new SummaryExpressionError(
					'Properties can only be used inside an aggregate function.',
				);
			}
			return getPropertyValue(entry, expression.name);
		case 'binary':
			return evaluateBinary(expression, entries, entry, allowProperty, allowAggregate);
		case 'aggregate':
			if (!allowAggregate) {
				throw new SummaryExpressionError('Aggregate functions cannot be nested.');
			}
			return evaluateAggregate(expression, entries);
	}
}

function evaluateBinary(
	expression: Extract<SummaryExpression, { kind: 'binary' }>,
	entries: CalloutEntry[],
	entry: CalloutEntry | undefined,
	allowProperty: boolean,
	allowAggregate: boolean,
): SummaryValue {
	const left = evaluateExpression(expression.left, entries, entry, allowProperty, allowAggregate);
	const right = evaluateExpression(expression.right, entries, entry, allowProperty, allowAggregate);
	if (left === null || right === null) {
		return null;
	}

	if (expression.operator === '+') {
		if (typeof left === 'string' || typeof right === 'string') {
			return String(left) + String(right);
		}
		return left + right;
	}

	if (typeof left !== 'number' || typeof right !== 'number') {
		throw new SummaryExpressionError(
			`Operator '${expression.operator}' requires numeric values.`,
		);
	}

	switch (expression.operator) {
		case '-':
			return left - right;
		case '*':
			return left * right;
		case '/':
			if (right === 0) {
				throw new SummaryExpressionError('Division by zero is not allowed.');
			}
			return left / right;
	}
}

function evaluateAggregate(
	expression: Extract<SummaryExpression, { kind: 'aggregate' }>,
	entries: CalloutEntry[],
): number {
	if (expression.name === 'count') {
		const argument = expression.argument;
		if (argument?.kind === 'property') {
			return entries.filter((entry) => hasProperty(entry, argument.name)).length;
		}
		return entries.length;
	}

	const values = entries
		.map((entry) =>
			expression.argument === undefined
				? null
				: evaluateExpression(expression.argument, entries, entry, true, false),
		)
		.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

	if (values.length === 0) {
		return 0;
	}

	switch (expression.name) {
		case 'sum':
			return values.reduce((total, value) => total + value, 0);
		case 'avg':
			return values.reduce((total, value) => total + value, 0) / values.length;
		case 'max':
			return Math.max(...values);
		case 'min':
			return Math.min(...values);
		case 'median': {
			const sorted = [...values].sort((left, right) => left - right);
			const middle = Math.floor(sorted.length / 2);
			return sorted.length % 2 === 0
				? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
				: sorted[middle] ?? 0;
		}
		case 'range':
			return Math.max(...values) - Math.min(...values);
	}
}

function hasProperty(entry: CalloutEntry, name: string): boolean {
	return entry.properties.some((property) => property.key.toLowerCase() === name.toLowerCase());
}

function getPropertyValue(entry: CalloutEntry | undefined, name: string): string | number | null {
	const property = entry?.properties.find(
		(candidate) => candidate.key.toLowerCase() === name.toLowerCase(),
	);
	if (!property) {
		return null;
	}

	const value = property.value.trim();
	if (value === '') {
		return null;
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : value;
}

function isAggregateName(value: string): value is AggregateName {
	return value === 'count' || value === 'sum' || value === 'avg' || value === 'max' || value === 'min' ||
		value === 'median' || value === 'range';
}
