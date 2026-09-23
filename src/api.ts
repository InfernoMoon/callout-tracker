import { findCallouts } from './callout-scanner';
import { createPropertyFilter } from './property-filter';
import { evaluateSummary } from './summary-evaluator';
import type CalloutTrackerPlugin from './main';
import type { CalloutEntry, CalloutProperty } from './types';

const DEFAULT_CALLOUT_TYPES = ['idea', 'note', 'todo'];

export interface CalloutSearchOptions {
	callouts?: string[] | string;
	rootFolder?: string;
	search?: string;
	/** Supports comparisons, arithmetic, logical operators, and exists({property}). */
	filter?: string;
}

export interface CalloutSummaryOptions extends CalloutSearchOptions {
	summary: string;
}

export interface CalloutSearchResult {
	fileName: string;
	filePath: string;
	line?: number;
	type: string;
	title: string;
	body: string;
	properties: CalloutProperty[];
}

export interface CalloutSummaryResult {
	value: string;
	callouts: CalloutSearchResult[];
}

export interface CalloutTrackerApi {
	test(): string;
	search(options?: CalloutSearchOptions): Promise<CalloutSearchResult[]>;
	summarize(options: CalloutSummaryOptions): Promise<CalloutSummaryResult>;
}

export function createCalloutTrackerApi(plugin: CalloutTrackerPlugin): CalloutTrackerApi {
	return {
		test: () => 'Haha the test worked!',
		search: async (options = {}) =>
			(await findMatchingEntries(plugin, options)).map(toSearchResult),
		summarize: async (options) => {
			const entries = await findMatchingEntries(plugin, options);
			return {
				value: evaluateSummary(options.summary, entries),
				callouts: entries.map(toSearchResult),
			};
		},
	};
}

async function findMatchingEntries(
	plugin: CalloutTrackerPlugin,
	options: CalloutSearchOptions,
): Promise<CalloutEntry[]> {
	const calloutTypes = normalizeCalloutTypes(options.callouts);
	const entries = await findCallouts(
		plugin.app,
		options.rootFolder ?? plugin.settings.rootFolder,
		calloutTypes,
		plugin.settings.ignoredPrefixes,
	);
	const typeOrder = new Map(calloutTypes.map((type, index) => [type, index]));

	return filterEntries(entries, options.search, createPropertyFilter(options.filter)).sort(
		(first, second) =>
			(typeOrder.get(first.type) ?? Number.MAX_SAFE_INTEGER) -
			(typeOrder.get(second.type) ?? Number.MAX_SAFE_INTEGER),
	);
}

function normalizeCalloutTypes(value: string[] | string | undefined): string[] {
	const values = typeof value === 'string' ? value.split(/[\s,]+/) : value ?? DEFAULT_CALLOUT_TYPES;
	const types = values
		.map((type) => type.trim().toLowerCase())
		.filter(Boolean);

	return types.length > 0 ? [...new Set(types)] : [...DEFAULT_CALLOUT_TYPES];
}

function filterEntries(
	entries: CalloutEntry[],
	search: string | undefined,
	filterPredicate: ReturnType<typeof createPropertyFilter>,
): CalloutEntry[] {
	const query = search?.trim().toLowerCase() ?? '';
	return entries.filter((entry) =>
		(!query || getSearchableText(entry).includes(query)) &&
		(!filterPredicate || filterPredicate(entry.properties)),
	);
}

function getSearchableText(entry: CalloutEntry): string {
	const properties = entry.properties
		.map((property) => `${property.key}: ${property.value}`)
		.join('\n');
	return `${entry.fileName}\n${entry.title}\n${properties}\n${entry.body}`.toLowerCase();
}

function toSearchResult(entry: CalloutEntry): CalloutSearchResult {
	return {
		fileName: entry.fileName,
		filePath: entry.filePath,
		...(entry.startLine === undefined ? {} : { line: entry.startLine + 1 }),
		type: entry.type,
		title: entry.title,
		body: entry.body,
		properties: entry.properties,
	};
}
