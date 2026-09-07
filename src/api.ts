import { findCallouts } from './callout-scanner';
import type CalloutTrackerPlugin from './main';
import type { CalloutEntry } from './types';

const DEFAULT_CALLOUT_TYPES = ['idea', 'note', 'todo'];

export interface CalloutSearchOptions {
	callouts?: string[] | string;
	rootFolder?: string;
	search?: string;
}

export interface CalloutSearchResult {
	fileName: string;
	filePath: string;
	line: number;
	type: string;
	title: string;
	body: string;
}

export interface CalloutTrackerApi {
	test(): string;
	search(options?: CalloutSearchOptions): Promise<CalloutSearchResult[]>;
}

export function createCalloutTrackerApi(plugin: CalloutTrackerPlugin): CalloutTrackerApi {
	return {
		test: () => 'Haha the test worked!',
		search: async (options = {}) => {
			const calloutTypes = normalizeCalloutTypes(options.callouts);
			const entries = await findCallouts(
				plugin.app,
				options.rootFolder ?? plugin.settings.rootFolder,
				calloutTypes,
				plugin.settings.ignoredPrefixes,
			);
			const typeOrder = new Map(calloutTypes.map((type, index) => [type, index]));

			return filterEntries(entries, options.search)
				.sort(
					(first, second) =>
						(typeOrder.get(first.type) ?? Number.MAX_SAFE_INTEGER) -
						(typeOrder.get(second.type) ?? Number.MAX_SAFE_INTEGER),
				)
				.map(toSearchResult);
		},
	};
}

function normalizeCalloutTypes(value: string[] | string | undefined): string[] {
	const values = typeof value === 'string' ? value.split(/[\s,]+/) : value ?? DEFAULT_CALLOUT_TYPES;
	const types = values
		.map((type) => type.trim().toLowerCase())
		.filter(Boolean);

	return types.length > 0 ? [...new Set(types)] : [...DEFAULT_CALLOUT_TYPES];
}

function filterEntries(entries: CalloutEntry[], search: string | undefined): CalloutEntry[] {
	const query = search?.trim().toLowerCase() ?? '';
	if (!query) {
		return entries;
	}

	return entries.filter((entry) =>
		`${entry.fileName}\n${entry.title}\n${entry.body}`.toLowerCase().includes(query),
	);
}

function toSearchResult(entry: CalloutEntry): CalloutSearchResult {
	return {
		fileName: entry.fileName,
		filePath: entry.filePath,
		line: entry.startLine + 1,
		type: entry.type,
		title: entry.title,
		body: entry.body,
	};
}
