import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
} from 'obsidian';
import type { TFile } from 'obsidian';
import type CalloutTrackerPlugin from './main';

type TrackerOption = {
	kind: 'setting';
	key: string;
	label: string;
	description: string;
};

type CalloutOption = {
	kind: 'callout';
	name: string;
};

type SummaryFunctionOption = {
	kind: 'summary-function';
	name: string;
	description: string;
};

type FilterFunctionOption = {
	kind: 'filter-function';
	name: string;
	description: string;
};

type DisplayOption = {
	kind: 'display';
	name: string;
	description: string;
};

type PropertyOption = {
	kind: 'property';
	name: string;
};

type Suggestion =
	| TrackerOption
	| CalloutOption
	| SummaryFunctionOption
	| FilterFunctionOption
	| DisplayOption
	| PropertyOption;

type SuggestionKind = Suggestion['kind'];

const OPTIONS: TrackerOption[] = [
	{ kind: 'setting', key: 'callouts', label: 'callouts', description: 'Callout types to include' },
	{ kind: 'setting', key: 'rootfolder', label: 'rootfolder', description: 'Folder to search' },
	{ kind: 'setting', key: 'search', label: 'search', description: 'Text to find in callout titles or bodies' },
	{ kind: 'setting', key: 'filter', label: 'filter', description: 'Filter by callout properties' },
	{ kind: 'setting', key: 'summary', label: 'summary', description: 'Calculate a value from matching callouts' },
	{ kind: 'setting', key: 'display', label: 'display', description: 'Choose which results to render' },
];

const SUMMARY_FUNCTIONS: SummaryFunctionOption[] = [
	{ kind: 'summary-function', name: 'count', description: 'Count matching callouts' },
	{ kind: 'summary-function', name: 'sum', description: 'Add numeric property values' },
	{ kind: 'summary-function', name: 'avg', description: 'Calculate the average of numeric values' },
	{ kind: 'summary-function', name: 'max', description: 'Find the largest numeric value' },
	{ kind: 'summary-function', name: 'min', description: 'Find the smallest numeric value' },
	{ kind: 'summary-function', name: 'median', description: 'Find the median of numeric values' },
	{ kind: 'summary-function', name: 'range', description: 'Find the difference between the largest and smallest values' },
];

const FILTER_FUNCTIONS: FilterFunctionOption[] = [
	{ kind: 'filter-function', name: 'exists', description: 'Match callouts that contain a property' },
	{ kind: 'filter-function', name: 'empty', description: 'Match callouts with an empty property' },
	{ kind: 'filter-function', name: 'contains', description: 'Match a property containing text' },
	{ kind: 'filter-function', name: 'startsWith', description: 'Match a property starting with text' },
	{ kind: 'filter-function', name: 'in', description: 'Match a property against exact values' },
];

const DISPLAY_OPTIONS: DisplayOption[] = [
	{ kind: 'display', name: 'All', description: 'Show summaries and callouts' },
	{ kind: 'display', name: 'OnlySummary', description: 'Show summaries only' },
	{ kind: 'display', name: 'OnlyCallouts', description: 'Show callouts only' },
];

export function registerCalloutTrackerEditorSuggest(
	plugin: CalloutTrackerPlugin,
): EditorSuggest<Suggestion> {
	return new CalloutTrackerEditorSuggest(plugin);
}

class CalloutTrackerEditorSuggest extends EditorSuggest<Suggestion> {
	private suggestionKind: SuggestionKind = 'setting';
	private propertySuggestionMode: 'expression' | 'callout' = 'expression';

	constructor(private readonly plugin: CalloutTrackerPlugin) {
		super(plugin.app);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (!file) {
			return null;
		}

		const beforeCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
		const insideTrackerBlock = isInsideCalloutTrackerBlock(editor, cursor.line);
		const propertyTrigger = getPropertyTrigger(editor, cursor, beforeCursor);
		if (propertyTrigger) {
			this.suggestionKind = 'property';
			this.propertySuggestionMode = propertyTrigger.mode;
			return propertyTrigger;
		}
		if (!insideTrackerBlock) {
			return null;
		}

		const calloutValue = getCalloutValueTrigger(beforeCursor, cursor);
		if (calloutValue) {
			this.suggestionKind = 'callout';
			return calloutValue;
		}

		const summaryFunction = getSummaryFunctionTrigger(beforeCursor, cursor);
		if (summaryFunction) {
			this.suggestionKind = 'summary-function';
			return summaryFunction;
		}

		const filterFunction = getFilterFunctionTrigger(beforeCursor, cursor);
		if (filterFunction) {
			this.suggestionKind = 'filter-function';
			return filterFunction;
		}

		const displayValue = getDisplayValueTrigger(beforeCursor, cursor);
		if (displayValue) {
			this.suggestionKind = 'display';
			return displayValue;
		}

		const match = beforeCursor.match(/^\s*([a-z]*)$/i);
		if (!match) {
			return null;
		}

		this.suggestionKind = 'setting';
		const query = match[1] ?? '';
		return {
			start: { line: cursor.line, ch: cursor.ch - query.length },
			end: cursor,
			query,
		};
	}

	getSuggestions(context: EditorSuggestContext): Suggestion[] | Promise<Suggestion[]> {
		const query = context.query.toLowerCase();
		if (this.suggestionKind === 'callout') {
			return this.plugin.settings.customCallouts
				.map((callout): CalloutOption => ({
					kind: 'callout',
					name: callout.name.trim(),
				}))
				.filter((option) => option.name && option.name.toLowerCase().startsWith(query));
		}
		if (this.suggestionKind === 'summary-function') {
			return SUMMARY_FUNCTIONS.filter((option) => option.name.startsWith(query));
		}
		if (this.suggestionKind === 'filter-function') {
			return FILTER_FUNCTIONS.filter((option) => option.name.startsWith(query));
		}
		if (this.suggestionKind === 'display') {
			return DISPLAY_OPTIONS.filter((option) => option.name.toLowerCase().startsWith(query));
		}
		if (this.suggestionKind === 'property') {
			return this.getPropertySuggestions(context);
		}

		const existingKeys = getExistingSettingKeys(context.editor, context.start.line);
		return OPTIONS.filter(
			(option) =>
				option.key.startsWith(query) &&
				(option.key === 'summary' || !existingKeys.has(option.key)),
		);
	}

	private async getPropertySuggestions(context: EditorSuggestContext): Promise<PropertyOption[]> {
		const propertyNames = await this.plugin.propertyIndex.getPropertyNames();
		const existingKeys = this.propertySuggestionMode === 'callout'
			? getExistingCalloutPropertyKeys(context.editor, context.end.line, context.end.ch)
			: new Set<string>();
		const query = context.query.toLowerCase();

		return propertyNames
			.filter((name) => name.toLowerCase().startsWith(query))
			.filter((name) => !existingKeys.has(name.toLowerCase()))
			.map((name): PropertyOption => ({
				kind: 'property',
				name,
			}));
	}

	renderSuggestion(value: Suggestion, element: HTMLElement): void {
		if (value.kind === 'callout') {
			element.createDiv({ text: value.name });
			return;
		}
		if (value.kind === 'summary-function') {
			element.createDiv({ text: `${value.name}()` });
			element.createDiv({ text: value.description, cls: 'callout-tracker__suggestion-description' });
			return;
		}
		if (value.kind === 'filter-function') {
			element.createDiv({ text: `${value.name}()` });
			element.createDiv({ text: value.description, cls: 'callout-tracker__suggestion-description' });
			return;
		}
		if (value.kind === 'display') {
			element.createDiv({ text: value.name });
			element.createDiv({ text: value.description, cls: 'callout-tracker__suggestion-description' });
			return;
		}
		if (value.kind === 'property') {
			element.createDiv({ text: value.name });
			return;
		}

		element.createDiv({ text: `${value.label}:` });
		element.createDiv({ text: value.description, cls: 'callout-tracker__suggestion-description' });
	}

	selectSuggestion(value: Suggestion): void {
		const context = this.context;
		if (!context) {
			return;
		}

		let replacement: string;
		let cursorOffset = 0;
		if (value.kind === 'callout') {
			replacement = `${value.name}, `;
		} else if (value.kind === 'summary-function') {
			replacement = `${value.name}()`;
		} else if (value.kind === 'filter-function') {
			const argumentsTemplate = value.name === 'contains' || value.name === 'startsWith'
				? '{}, ""'
				: value.name === 'in'
					? '{}, '
					: '{}';
			replacement = `${value.name}(${argumentsTemplate})`;
			cursorOffset = `${value.name}({`.length - replacement.length;
		} else if (value.kind === 'display') {
			replacement = value.name;
		} else if (value.kind === 'property') {
			if (this.propertySuggestionMode === 'callout') {
				const trigger = getCalloutPropertyTrigger(
					context.editor,
					context.end,
					context.editor.getLine(context.end.line).slice(0, context.end.ch),
				);
				replacement = `${value.name}${trigger?.hasDelimiterAfterCursor ? '' : ':: '}`;
			} else {
				const trigger = getExpressionPropertyTrigger(
					context.editor,
					context.end,
					context.editor.getLine(context.end.line).slice(0, context.end.ch),
				);
				replacement = value.name;
				if (trigger?.hasClosingBraceAfterCursor) {
					cursorOffset = trigger.closingBraceOffset + 1;
				} else {
					replacement += '}';
				}
			}
		} else {
			replacement = `${value.label}: `;
		}
		context.editor.replaceRange(replacement, context.start, context.end);
		context.editor.setCursor({
			line: context.start.line,
			ch: context.start.ch + replacement.length + cursorOffset - (value.kind === 'summary-function' ? 1 : 0),
		});
	}
}

interface PropertyTrigger extends EditorSuggestTriggerInfo {
	mode: 'expression' | 'callout';
	hasDelimiterAfterCursor: boolean;
	hasClosingBraceAfterCursor: boolean;
	closingBraceOffset: number;
}

function getPropertyTrigger(
	editor: Editor,
	cursor: EditorPosition,
	beforeCursor: string,
): PropertyTrigger | null {
	if (isInsideCalloutTrackerBlock(editor, cursor.line)) {
		return getExpressionPropertyTrigger(editor, cursor, beforeCursor);
	}

	return getCalloutPropertyTrigger(editor, cursor, beforeCursor);
}

function getExpressionPropertyTrigger(
	editor: Editor,
	cursor: EditorPosition,
	beforeCursor: string,
): PropertyTrigger | null {
	const settingMatch = beforeCursor.match(/^\s*(?:filter|summary)\s*:\s*(.*)$/i);
	if (!settingMatch || settingMatch[1] === undefined) {
		return null;
	}

	const value = settingMatch[1];
	const openingBrace = value.lastIndexOf('{');
	if (openingBrace < 0 || value.lastIndexOf('}') > openingBrace || isInsideQuotedString(value)) {
		return null;
	}

	const query = value.slice(openingBrace + 1);
	if (!/^[^\s{}:]*$/.test(query)) {
		return null;
	}
	const remainingLine = editor.getLine(cursor.line).slice(cursor.ch);
	const closingBrace = remainingLine.match(/^\s*}/);

	return {
		start: { line: cursor.line, ch: cursor.ch - query.length },
		end: cursor,
		query,
		mode: 'expression',
		hasDelimiterAfterCursor: false,
		hasClosingBraceAfterCursor: closingBrace !== null,
		closingBraceOffset: closingBrace?.[0].length ? closingBrace[0].length - 1 : 0,
	};
}

function getCalloutPropertyTrigger(
	editor: Editor,
	cursor: EditorPosition,
	beforeCursor: string,
): PropertyTrigger | null {
	const markerMatch = beforeCursor.match(/^\s*>\s*/);
	if (!markerMatch || !isPropertySection(editor, cursor.line)) {
		return null;
	}

	const propertyText = beforeCursor.slice(markerMatch[0].length);
	if (!/^[^\s:]*$/.test(propertyText) || propertyText.length === 0) {
		return null;
	}

	const remainingLine = editor.getLine(cursor.line).slice(cursor.ch);
	const hasDelimiterAfterCursor = /^\s*::/.test(remainingLine);
	if (beforeCursor.includes('::') || (!hasDelimiterAfterCursor && remainingLine.trim().length > 0)) {
		return null;
	}

	return {
		start: { line: cursor.line, ch: cursor.ch - propertyText.length },
		end: cursor,
		query: propertyText,
		mode: 'callout',
		hasDelimiterAfterCursor,
		hasClosingBraceAfterCursor: false,
		closingBraceOffset: 0,
	};
}

function getExistingCalloutPropertyKeys(
	editor: Editor,
	currentLine: number,
	cursorCharacter: number,
): Set<string> {
	const state = findCalloutBody(editor, currentLine);
	if (!state) {
		return new Set<string>();
	}

	const keys = new Set<string>();
	for (let line = state.headerLine + 1; line <= currentLine; line++) {
		const property = parseEditorProperty(editor.getLine(line));
		if (property) {
			keys.add(property.key.toLowerCase());
		}
	}

	const currentLineText = editor.getLine(currentLine);
	const beforeCursor = currentLineText.slice(0, cursorCharacter);
	const currentProperty = parseEditorProperty(currentLineText);
	if (currentProperty && /^\s*>\s*[^\s:]*$/.test(beforeCursor)) {
		keys.delete(currentProperty.key.toLowerCase());
	}

	return keys;
}

function isPropertySection(editor: Editor, currentLine: number): boolean {
	const state = findCalloutBody(editor, currentLine);
	if (!state || state.headerLine === currentLine) {
		return false;
	}

	for (let line = state.headerLine + 1; line < currentLine; line++) {
		if (!parseEditorProperty(editor.getLine(line))) {
			return false;
		}
	}

	return true;
}

function findCalloutBody(editor: Editor, currentLine: number): { headerLine: number } | null {
	if (!isEditorQuoteLine(editor.getLine(currentLine))) {
		return null;
	}

	let headerLine = currentLine;
	while (headerLine > 0 && isEditorQuoteLine(editor.getLine(headerLine - 1))) {
		headerLine--;
	}

	return isEditorCalloutHeader(editor.getLine(headerLine)) ? { headerLine } : null;
}

function parseEditorProperty(line: string): { key: string } | null {
	const content = stripEditorQuoteMarker(line);
	const match = content.match(/^([^\s:]+)\s*::/);
	return match?.[1] ? { key: match[1] } : null;
}

function isEditorQuoteLine(line: string): boolean {
	return /^\s*>/.test(line);
}

function stripEditorQuoteMarker(line: string): string {
	return line.replace(/^\s*>\s*/, '');
}

function isEditorCalloutHeader(line: string): boolean {
	return /^\s*>\s*\[![^\]\s]+\](?:\s|$)/.test(line);
}

function getCalloutValueTrigger(
	beforeCursor: string,
	cursor: EditorPosition,
): EditorSuggestTriggerInfo | null {
	const settingMatch = beforeCursor.match(/^\s*callouts\s*:/i);
	if (!settingMatch) {
		return null;
	}

	const value = beforeCursor.slice(settingMatch[0].length);
	const lastComma = value.lastIndexOf(',');
	const token = value.slice(lastComma + 1);
	const leadingWhitespace = token.length - token.trimStart().length;
	const query = token.trim();
	const startCh = settingMatch[0].length + lastComma + 1 + leadingWhitespace;

	return {
		start: { line: cursor.line, ch: startCh },
		end: cursor,
		query,
	};
}

function getSummaryFunctionTrigger(
	beforeCursor: string,
	cursor: EditorPosition,
): EditorSuggestTriggerInfo | null {
	const settingMatch = beforeCursor.match(/^\s*summary\s*:\s*(.*)$/i);
	if (!settingMatch || settingMatch[1] === undefined) {
		return null;
	}

	const value = settingMatch[1];
	if (isInsideQuotedString(value)) {
		return null;
	}

	const functionMatch = value.match(/(?:^|[+\-*/(\s])([a-z]*)$/i);
	if (!functionMatch || functionMatch[1] === undefined) {
		return null;
	}

	const query = functionMatch[1];
	if (!query) {
		return null;
	}

	return {
		start: { line: cursor.line, ch: cursor.ch - query.length },
		end: cursor,
		query,
	};
}

function getFilterFunctionTrigger(
	beforeCursor: string,
	cursor: EditorPosition,
): EditorSuggestTriggerInfo | null {
	const settingMatch = beforeCursor.match(/^\s*filter\s*:\s*(.*)$/i);
	if (!settingMatch || settingMatch[1] === undefined) {
		return null;
	}

	const value = settingMatch[1];
	if (isInsideQuotedString(value)) {
		return null;
	}

	const functionMatch = value.match(/(?:^|[&|(!+\-*/\s])([a-z]*)$/i);
	if (!functionMatch || functionMatch[1] === undefined || !functionMatch[1]) {
		return null;
	}

	const query = functionMatch[1];
	return {
		start: { line: cursor.line, ch: cursor.ch - query.length },
		end: cursor,
		query,
	};
}

function getDisplayValueTrigger(
	beforeCursor: string,
	cursor: EditorPosition,
): EditorSuggestTriggerInfo | null {
	const settingMatch = beforeCursor.match(/^\s*display\s*:\s*(.*)$/i);
	if (!settingMatch || settingMatch[1] === undefined) {
		return null;
	}

	const value = settingMatch[1];
	const query = value.match(/[A-Za-z]*$/)?.[0] ?? '';
	return {
		start: { line: cursor.line, ch: cursor.ch - query.length },
		end: cursor,
		query,
	};
}

function isInsideQuotedString(value: string): boolean {
	let quote: string | null = null;
	let escaped = false;
	for (const character of value) {
		if (escaped) {
			escaped = false;
			continue;
		}
		if (character === '\\') {
			escaped = true;
			continue;
		}
		if (quote === null && (character === '"' || character === "'")) {
			quote = character;
		} else if (quote === character) {
			quote = null;
		}
	}
	return quote !== null;
}

function getExistingSettingKeys(editor: Editor, currentLine: number): Set<string> {
	const keys = new Set<string>();
	const blockStart = findCalloutTrackerBlockStart(editor, currentLine);
	if (blockStart === null) {
		return keys;
	}

	for (let line = blockStart + 1; line <= currentLine; line++) {
		const text = editor.getLine(line).trim();
		if (/^(?:`{3,}|~{3,})\s*$/.test(text)) {
			break;
		}
		if (line !== currentLine) {
			const setting = text.match(/^([a-z][a-z0-9]*)\s*:/i);
			if (setting?.[1]) {
				keys.add(setting[1].toLowerCase());
			}
		}
	}
	return keys;
}

function isInsideCalloutTrackerBlock(editor: Editor, lineNumber: number): boolean {
	return findCalloutTrackerBlockStart(editor, lineNumber) !== null;
}

function findCalloutTrackerBlockStart(editor: Editor, lineNumber: number): number | null {
	let blockStart: number | null = null;
	for (let line = 0; line <= lineNumber; line++) {
		const text = editor.getLine(line).trim();
		if (blockStart === null && /^(?:`{3,}|~{3,})\s*callout-tracker\s*$/i.test(text)) {
			blockStart = line;
		} else if (blockStart !== null && /^(?:`{3,}|~{3,})\s*$/.test(text)) {
			blockStart = null;
		}
	}

	return blockStart;
}
