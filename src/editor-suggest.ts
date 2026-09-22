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

type DisplayOption = {
	kind: 'display';
	name: string;
	description: string;
};

type Suggestion = TrackerOption | CalloutOption | SummaryFunctionOption | DisplayOption;

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
	private suggestionKind: 'setting' | 'callout' | 'summary-function' | 'display' = 'setting';

	constructor(private readonly plugin: CalloutTrackerPlugin) {
		super(plugin.app);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (!file || !isInsideCalloutTrackerBlock(editor, cursor.line)) {
			return null;
		}

		const beforeCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
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

	getSuggestions(context: EditorSuggestContext): Suggestion[] {
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
		if (this.suggestionKind === 'display') {
			return DISPLAY_OPTIONS.filter((option) => option.name.toLowerCase().startsWith(query));
		}

	const existingKeys = getExistingSettingKeys(context.editor, context.start.line);
		return OPTIONS.filter(
			(option) =>
				option.key.startsWith(query) &&
				(option.key === 'summary' || !existingKeys.has(option.key)),
		);
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
		if (value.kind === 'display') {
			element.createDiv({ text: value.name });
			element.createDiv({ text: value.description, cls: 'callout-tracker__suggestion-description' });
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

		const replacement = value.kind === 'callout'
			? `${value.name}, `
			: value.kind === 'summary-function'
				? `${value.name}()`
				: value.kind === 'display'
					? value.name
				: `${value.label}: `;
		context.editor.replaceRange(replacement, context.start, context.end);
		context.editor.setCursor({
			line: context.start.line,
			ch: context.start.ch + replacement.length - (value.kind === 'summary-function' ? 1 : 0),
		});
	}
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
	let inside = false;
	for (let line = 0; line <= currentLine; line++) {
		const text = editor.getLine(line).trim();
		if (!inside && /^(?:`{3,}|~{3,})\s*callout-tracker\s*$/i.test(text)) {
			inside = true;
			continue;
		}
		if (inside && /^(?:`{3,}|~{3,})\s*$/.test(text)) {
			break;
		}
		if (inside && line !== currentLine) {
			const setting = text.match(/^([a-z][a-z0-9]*)\s*:/i);
			if (setting?.[1]) {
				keys.add(setting[1].toLowerCase());
			}
		}
	}
	return keys;
}

function isInsideCalloutTrackerBlock(editor: Editor, lineNumber: number): boolean {
	let inside = false;
	for (let line = 0; line <= lineNumber; line++) {
		const text = editor.getLine(line).trim();
		if (!inside && /^(?:`{3,}|~{3,})\s*callout-tracker\s*$/i.test(text)) {
			inside = true;
		} else if (inside && /^(?:`{3,}|~{3,})\s*$/.test(text)) {
			inside = false;
		}
	}

	return inside;
}
