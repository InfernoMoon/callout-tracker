import type { CalloutEntry } from './types';

export interface GroupBySpec {
	property: string;
	direction?: 'asc' | 'desc';
}

export interface CalloutGroup {
	label: string;
	entries: CalloutEntry[];
}

export class GroupByError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GroupByError';
	}
}

export function parseGroupBy(expression: string | undefined): GroupBySpec | null {
	const source = expression?.trim() ?? '';
	if (!source) {
		return null;
	}

	const plainMatch = source.match(/^\s*\{([^{}\s:]+)\}\s*$/);
	if (plainMatch?.[1]) {
		return { property: plainMatch[1] };
	}

	const orderedMatch = source.match(/^\s*(asc|desc)\s*\(\s*\{([^{}\s:]+)\}\s*\)\s*$/i);
	if (!orderedMatch?.[1] || !orderedMatch[2]) {
		throw new GroupByError('Expected {property}, asc({property}), or desc({property}).');
	}

	return {
		property: orderedMatch[2],
		direction: orderedMatch[1].toLowerCase() as 'asc' | 'desc',
	};
}

export function groupCallouts(entries: CalloutEntry[], spec: GroupBySpec): CalloutGroup[] {
	const groups = new Map<string, CalloutGroup>();
	let missingGroup: CalloutGroup | undefined;

	for (const entry of entries) {
		const value = getGroupValue(entry, spec.property);
		if (value === null) {
			missingGroup ??= { label: 'No value', entries: [] };
			missingGroup.entries.push(entry);
			continue;
		}

		const key = value.toLocaleLowerCase();
		let group = groups.get(key);
		if (!group) {
			group = { label: value, entries: [] };
			groups.set(key, group);
		}
		group.entries.push(entry);
	}

	const orderedGroups = [...groups.values()];
	if (spec.direction) {
		orderedGroups.sort((first, second) => {
			const result = compareGroupLabels(first.label, second.label);
			return spec.direction === 'desc' ? -result : result;
		});
	}

	return missingGroup ? [...orderedGroups, missingGroup] : orderedGroups;
}

function compareGroupLabels(first: string, second: string): number {
	const firstNumber = Number(first);
	const secondNumber = Number(second);
	if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
		return firstNumber - secondNumber;
	}

	return first.localeCompare(second, undefined, { sensitivity: 'base' });
}

function getGroupValue(entry: CalloutEntry, propertyName: string): string | null {
	const property = entry.properties.find(
		(candidate) => candidate.key.toLowerCase() === propertyName.toLowerCase(),
	);
	const value = property?.value.trim();
	return value || null;
}
