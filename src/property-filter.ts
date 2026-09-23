import type { CalloutProperty } from './types';

type Literal =
	| { kind: 'number'; value: number }
	| { kind: 'string'; value: string };

type ValueExpression =
	| Literal
	| { kind: 'property'; name: string }
	| { kind: 'binary'; operator: '+' | '-' | '*' | '/'; left: ValueExpression; right: ValueExpression };

type Comparison = {
	left: ValueExpression;
	operator: ComparisonOperator;
	right: ValueExpression;
};

type FilterExpression =
	| { kind: 'comparison'; comparison: Comparison }
	| { kind: 'checked' }
	| { kind: 'hasCheckbox' }
	| { kind: 'exists'; property: string }
	| { kind: 'empty'; property: string }
	| { kind: 'missingOrEmpty'; property: string }
	| { kind: 'contains'; property: string; value: string }
	| { kind: 'startsWith'; property: string; value: string }
	| { kind: 'in'; property: string; values: Literal[] }
	| { kind: 'not'; expression: FilterExpression }
	| { kind: 'and'; left: FilterExpression; right: FilterExpression }
	| { kind: 'or'; left: FilterExpression; right: FilterExpression };

type ComparisonOperator = '=' | '!=' | '<' | '>' | '<=' | '>=';
type EvaluatedValue = number | string | null;

export class PropertyFilterError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PropertyFilterError';
	}
}

export type PropertyFilter = (properties: CalloutProperty[], checked?: boolean) => boolean;

export function createPropertyFilterMap(filters: Record<string, string>): Map<string, PropertyFilter> {
	const predicates = new Map<string, PropertyFilter>();
	for (const [name, expression] of Object.entries(filters)) {
		const predicate = createPropertyFilter(expression);
		if (predicate) {
			predicates.set(name.toLowerCase(), predicate);
		}
	}
	return predicates;
}

export function createPropertyFilter(expression: string | undefined): PropertyFilter | null {
	const source = expression?.trim() ?? '';
	if (!source) {
		return null;
	}

	const ast = new PropertyFilterParser(source).parse();
	return (properties, checked) => evaluate(ast, properties, checked);
}

class PropertyFilterParser {
	private position = 0;

	constructor(private readonly source: string) {}

	parse(): FilterExpression {
		const expression = this.parseOr();
		this.skipWhitespace();
		if (!this.atEnd()) {
			throw this.error(`Unexpected character '${this.source[this.position] ?? ''}'.`);
		}
		return expression;
	}

	private parseOr(): FilterExpression {
		let expression = this.parseAnd();
		while (this.consume('|')) {
			expression = { kind: 'or', left: expression, right: this.parseAnd() };
		}
		return expression;
	}

	private parseAnd(): FilterExpression {
		let expression = this.parsePrimary();
		while (this.consume('&')) {
			expression = { kind: 'and', left: expression, right: this.parsePrimary() };
		}
		return expression;
	}

	private parsePrimary(): FilterExpression {
		this.skipWhitespace();
		if (this.source[this.position] === '!' && this.source[this.position + 1] !== '=') {
			this.position++;
			this.skipWhitespace();
			if (this.source[this.position] !== '(' && !/[A-Za-z_]/.test(this.source[this.position] ?? '')) {
				throw this.error("Expected a function or '(' after '!'.");
			}
			return { kind: 'not', expression: this.parsePrimary() };
		}
		if (this.consumeKeyword('exists')) {
			this.expect('(');
			const property = this.readPropertyName();
			this.expect(')');
			return { kind: 'exists', property };
		}
		const functionName = this.readIdentifier();
		if (functionName !== null) {
			const normalizedName = functionName.toLowerCase();
			if (normalizedName === 'checked') {
				return { kind: 'checked' };
			}
			if (normalizedName === 'hascheckbox') {
				return { kind: 'hasCheckbox' };
			}
			return this.parseFilterFunction(functionName);
		}
		if (this.source[this.position] === '(') {
			const start = this.position;
			this.position++;
			try {
				const expression = this.parseOr();
				this.expect(')');
				return expression;
			} catch (error) {
				if (!(error instanceof PropertyFilterError)) {
					throw error;
				}
				this.position = start;
			}
		}

		return { kind: 'comparison', comparison: this.parseComparison() };
	}

	private parseComparison(): Comparison {
		const left = this.parseValueExpression();
		const operator = this.readComparisonOperator();
		const right = this.parseValueExpression();
		return { left, operator, right };
	}

	private parseValueExpression(): ValueExpression {
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

	private parseMultiplicative(): ValueExpression {
		let expression = this.parseValuePrimary();
		while (true) {
			const operator = this.consumeOperator('*') || this.consumeOperator('/');
			if (!operator) {
				return expression;
			}
			expression = {
				kind: 'binary',
				operator,
				left: expression,
				right: this.parseValuePrimary(),
			};
		}
	}

	private parseValuePrimary(): ValueExpression {
		this.skipWhitespace();
		const character = this.source[this.position];
		if (character === '(') {
			this.position++;
			const expression = this.parseValueExpression();
			this.expect(')');
			return expression;
		}
		if (character === '{') {
			return { kind: 'property', name: this.readPropertyName() };
		}
		if (character === '"' || character === "'") {
			return { kind: 'string', value: this.readQuotedString(character) };
		}

		const number = this.source.slice(this.position).match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/)?.[0];
		if (number) {
			this.position += number.length;
			return { kind: 'number', value: Number(number) };
		}

		throw this.error('Expected a number, string, property, or opening parenthesis.');
	}

	private readComparisonOperator(): ComparisonOperator {
		this.skipWhitespace();
		for (const operator of ['!=', '<=', '>=', '=', '<', '>'] as const) {
			if (this.source.startsWith(operator, this.position)) {
				this.position += operator.length;
				return operator;
			}
		}
		throw this.error('Expected one of =, !=, <, >, <=, or >=.');
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

	private consumeKeyword(keyword: string): boolean {
		this.skipWhitespace();
		if (!this.source.startsWith(keyword, this.position)) {
			return false;
		}

		const end = this.position + keyword.length;
		if (/[A-Za-z0-9_]/.test(this.source[end] ?? '')) {
			return false;
		}

		this.position = end;
		return true;
	}

	private readIdentifier(): string | null {
		this.skipWhitespace();
		const identifier = this.source.slice(this.position).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
		if (!identifier) {
			return null;
		}

		this.position += identifier.length;
		return identifier;
	}

	private parseFilterFunction(functionName: string): FilterExpression {
		const normalizedName = functionName.toLowerCase();
		this.expect('(');
		const property = this.readPropertyName();

		if (normalizedName === 'empty' || normalizedName === 'missingorempty') {
			this.expect(')');
			return normalizedName === 'empty'
				? { kind: 'empty', property }
				: { kind: 'missingOrEmpty', property };
		}

		this.expect(',');
		if (normalizedName === 'contains' || normalizedName === 'startswith') {
			const value = this.parseStringArgument(functionName);
			this.expect(')');
			return normalizedName === 'contains'
				? { kind: 'contains', property, value }
				: { kind: 'startsWith', property, value };
		}

		if (normalizedName === 'in') {
			const values: Literal[] = [this.parseLiteralArgument(functionName)];
			while (this.consume(',')) {
				values.push(this.parseLiteralArgument(functionName));
			}
			this.expect(')');
			return { kind: 'in', property, values };
		}

		throw this.error(`Unknown filter function '${functionName}'.`);
	}

	private parseStringArgument(functionName: string): string {
		const value = this.parseValueExpression();
		if (value.kind !== 'string') {
			throw this.error(`${functionName}() requires a quoted string argument.`);
		}
		return value.value;
	}

	private parseLiteralArgument(functionName: string): Literal {
		const value = this.parseValueExpression();
		if (value.kind !== 'number' && value.kind !== 'string') {
			throw this.error(`${functionName}() requires string or number values.`);
		}
		return value;
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

	private error(message: string): PropertyFilterError {
		return new PropertyFilterError(`${message} Position ${this.position + 1}.`);
	}
}

function evaluate(
	expression: FilterExpression,
	properties: CalloutProperty[],
	checked: boolean | undefined,
): boolean {
	if (expression.kind === 'not') {
		return !evaluate(expression.expression, properties, checked);
	}
	if (expression.kind === 'checked') {
		return checked === true;
	}
	if (expression.kind === 'hasCheckbox') {
		return checked !== undefined;
	}
	if (expression.kind === 'exists') {
		return findProperty(properties, expression.property) !== undefined;
	}
	if (expression.kind === 'empty') {
		const property = findProperty(properties, expression.property);
		return property !== undefined && property.value.trim().length === 0;
	}
	if (expression.kind === 'missingOrEmpty') {
		const property = findProperty(properties, expression.property);
		return property === undefined || property.value.trim().length === 0;
	}
	if (expression.kind === 'contains' || expression.kind === 'startsWith') {
		const property = findProperty(properties, expression.property);
		if (!property) {
			return false;
		}

		const value = property.value.trim().toLowerCase();
		const query = expression.value.trim().toLowerCase();
		return expression.kind === 'contains'
			? value.includes(query)
			: value.startsWith(query);
	}
	if (expression.kind === 'in') {
		const property = findProperty(properties, expression.property);
		if (!property) {
			return false;
		}
		const actual = normalizeValue(property.value);
		return expression.values.some((expected) => compare(actual, '=', expected.value));
	}
	if (expression.kind === 'and') {
		return evaluate(expression.left, properties, checked) && evaluate(expression.right, properties, checked);
	}
	if (expression.kind === 'or') {
		return evaluate(expression.left, properties, checked) || evaluate(expression.right, properties, checked);
	}

	const left = evaluateValue(expression.comparison.left, properties);
	const right = evaluateValue(expression.comparison.right, properties);
	return compare(left, expression.comparison.operator, right);
}

function evaluateValue(expression: ValueExpression, properties: CalloutProperty[]): EvaluatedValue {
	if (expression.kind === 'number' || expression.kind === 'string') {
		return expression.value;
	}
	if (expression.kind === 'property') {
		const property = findProperty(properties, expression.name);
		return property ? normalizeValue(property.value) : null;
	}

	const left = evaluateValue(expression.left, properties);
	const right = evaluateValue(expression.right, properties);
	if (left === null || right === null) {
		return null;
	}
	if (typeof left !== 'number' || typeof right !== 'number') {
		return null;
	}

	switch (expression.operator) {
		case '+':
			return left + right;
		case '-':
			return left - right;
		case '*':
			return left * right;
		case '/':
			if (right === 0) {
				throw new PropertyFilterError('Division by zero is not allowed.');
			}
			return left / right;
	}
}

function findProperty(properties: CalloutProperty[], name: string): CalloutProperty | undefined {
	return properties.find((property) => property.key.toLowerCase() === name.toLowerCase());
}

function normalizeValue(value: string): EvaluatedValue {
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}
	const number = Number(trimmed);
	return Number.isFinite(number) ? number : trimmed;
}

function compare(left: EvaluatedValue, operator: ComparisonOperator, right: EvaluatedValue): boolean {
	if (left === null || right === null) {
		return false;
	}
	if (typeof left === 'number' && typeof right === 'number') {
		return compareNumbers(left, operator, right);
	}
	if (operator !== '=' && operator !== '!=') {
		return false;
	}
	const equal = String(left).toLowerCase() === String(right).toLowerCase();
	return operator === '=' ? equal : !equal;
}

function compareNumbers(left: number, operator: ComparisonOperator, right: number): boolean {
	switch (operator) {
		case '=':
			return left === right;
		case '!=':
			return left !== right;
		case '<':
			return left < right;
		case '>':
			return left > right;
		case '<=':
			return left <= right;
		case '>=':
			return left >= right;
	}
}
