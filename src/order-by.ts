import type { CalloutEntry } from './types';

export type OrderByDirection = 'asc' | 'desc';

export interface OrderBySpec {
	direction: OrderByDirection;
	field: 'property' | 'title';
	property: string;
}

export class OrderByError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OrderByError';
	}
}

export function parseOrderBy(expression: string | undefined): OrderBySpec | null {
	const source = expression?.trim() ?? '';
	if (!source) {
		return null;
	}

	if (source.includes(',')) {
		throw new OrderByError('Only one orderBy expression is supported.');
	}

	const match = source.match(/^\s*(asc|desc)\s*\(\s*(.*)\s*\)\s*$/i);
	if (!match || !match[1] || !match[2]) {
		throw new OrderByError('Expected asc(title), asc({property}), desc(title), or desc({property}).');
	}

	const target = match[2].trim();
	if (target.toLowerCase() === 'title') {
		return {
			direction: match[1].toLowerCase() as OrderByDirection,
			field: 'title',
			property: 'title',
		};
	}

	const propertyMatch = target.match(/^\{([^{}\s:]+)\}$/);
	if (!propertyMatch || !propertyMatch[1]) {
		throw new OrderByError('Expected title or a property in braces.');
	}

	return {
		direction: match[1].toLowerCase() as OrderByDirection,
		field: 'property',
		property: propertyMatch[1],
	};
}

export function compareCalloutsByOrder(
	first: CalloutEntry,
	second: CalloutEntry,
	spec: OrderBySpec,
): number {
	const firstValue = getSortValue(first, spec);
	const secondValue = getSortValue(second, spec);
	if (firstValue === null && secondValue === null) {
		return 0;
	}
	if (firstValue === null) {
		return 1;
	}
	if (secondValue === null) {
		return -1;
	}

	let result: number;
	if (typeof firstValue === 'number' && typeof secondValue === 'number') {
		result = firstValue - secondValue;
	} else {
		result = String(firstValue).localeCompare(String(secondValue), undefined, {
			sensitivity: 'base',
		});
	}

	return spec.direction === 'desc' ? -result : result;
}

function getSortValue(entry: CalloutEntry, spec: OrderBySpec): string | number | null {
	if (spec.field === 'title') {
		return entry.title.trim() || null;
	}

	const property = entry.properties.find(
		(candidate) => candidate.key.toLowerCase() === spec.property.toLowerCase(),
	);
	if (!property || property.value.trim() === '') {
		return null;
	}

	const value = property.value.trim();
	const number = Number(value);
	return Number.isFinite(number) ? number : value;
}
