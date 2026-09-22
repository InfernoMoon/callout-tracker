import type { CalloutProperty } from './types';

type Literal =
	| { kind: 'number'; value: number }
	| { kind: 'string'; value: string };

type Comparison = {
	propertyName: string;
	operator: ComparisonOperator;
	literal: Literal;
};

type FilterExpression =
	| { kind: 'comparison'; comparison: Comparison }
	| { kind: 'and'; left: FilterExpression; right: FilterExpression }
	| { kind: 'or'; left: FilterExpression; right: FilterExpression };

type ComparisonOperator = '=' | '!=' | '<' | '>' | '<=' | '>=';

export class PropertyFilterError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PropertyFilterError';
	}
}

export type PropertyFilter = (properties: CalloutProperty[]) => boolean;

export function createPropertyFilter(expression: string | undefined): PropertyFilter | null {
	const source = expression?.trim() ?? '';
	if (!source) {
		return null;
	}

	const parser = new PropertyFilterParser(source);
	const ast = parser.parse();
	return (properties) => evaluate(ast, properties);
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
			expression = {
				kind: 'or',
				left: expression,
				right: this.parseAnd(),
			};
		}
		return expression;
	}

	private parseAnd(): FilterExpression {
		let expression = this.parsePrimary();
		while (this.consume('&')) {
			expression = {
				kind: 'and',
				left: expression,
				right: this.parsePrimary(),
			};
		}
		return expression;
	}

	private parsePrimary(): FilterExpression {
		if (this.consume('(')) {
			const expression = this.parseOr();
			this.expect(')');
			return expression;
		}

		return { kind: 'comparison', comparison: this.parseComparison() };
	}

	private parseComparison(): Comparison {
		this.skipWhitespace();
		this.expect('{');
		const propertyName = this.readUntil('}').trim();
		if (!propertyName || /\s|:/.test(propertyName)) {
			throw this.error('Property names must not contain whitespace or colons.');
		}
		this.expect('}');

		const operator = this.readOperator();
		const literal = this.readLiteral();
		return { propertyName, operator, literal };
	}

	private readOperator(): ComparisonOperator {
		this.skipWhitespace();
		for (const operator of ['!=', '<=', '>=', '=', '<', '>'] as const) {
			if (this.source.startsWith(operator, this.position)) {
				this.position += operator.length;
				return operator;
			}
		}
		throw this.error('Expected one of =, !=, <, >, <=, or >=.');
	}

	private readLiteral(): Literal {
		this.skipWhitespace();
		const character = this.source[this.position];
		if (character === '"' || character === "'") {
			return { kind: 'string', value: this.readQuotedString(character) };
		}

		const number = this.source.slice(this.position).match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/)?.[0];
		if (number) {
			this.position += number.length;
			return { kind: 'number', value: Number(number) };
		}

		throw this.error('Expected a quoted string or number.');
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

	private readUntil(character: string): string {
		const start = this.position;
		const end = this.source.indexOf(character, this.position);
		if (end < 0) {
			throw this.error(`Expected '${character}'.`);
		}
		this.position = end;
		return this.source.slice(start, end);
	}

	private expect(character: string): void {
		this.skipWhitespace();
		if (this.source[this.position] !== character) {
			throw this.error(`Expected '${character}'.`);
		}
		this.position++;
	}

	private consume(character: string): boolean {
		this.skipWhitespace();
		if (this.source[this.position] !== character) {
			return false;
		}
		this.position++;
		return true;
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

function evaluate(expression: FilterExpression, properties: CalloutProperty[]): boolean {
	if (expression.kind === 'and') {
		return evaluate(expression.left, properties) && evaluate(expression.right, properties);
	}
	if (expression.kind === 'or') {
		return evaluate(expression.left, properties) || evaluate(expression.right, properties);
	}

	const property = properties.find(
		(candidate) => candidate.key.toLowerCase() === expression.comparison.propertyName.toLowerCase(),
	);
	if (!property) {
		return false;
	}

	return compare(property.value, expression.comparison.operator, expression.comparison.literal);
}

function compare(value: string, operator: ComparisonOperator, literal: Literal): boolean {
	const numericValue = Number(value.trim());
	const valueIsNumber = value.trim() !== '' && Number.isFinite(numericValue);

	if (literal.kind === 'number') {
		if (!valueIsNumber) {
			return false;
		}
		return compareNumbers(numericValue, operator, literal.value);
	}

	if (operator !== '=' && operator !== '!=') {
		return false;
	}
	const equal = value.toLowerCase() === literal.value.toLowerCase();
	return operator === '=' ? equal : !equal;
}

function compareNumbers(value: number, operator: ComparisonOperator, literal: number): boolean {
	switch (operator) {
		case '=':
			return value === literal;
		case '!=':
			return value !== literal;
		case '<':
			return value < literal;
		case '>':
			return value > literal;
		case '<=':
			return value <= literal;
		case '>=':
			return value >= literal;
	}
}
