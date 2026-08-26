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
	key: 'callouts' | 'rootfolder' | 'search';
	description: string;
};

type CalloutOption = {
	kind: 'callout';
	name: string;
};

type Suggestion = TrackerOption | CalloutOption;

const OPTIONS: TrackerOption[] = [
	{ kind: 'setting', key: 'callouts', description: 'Callout types to include' },
	{ kind: 'setting', key: 'rootfolder', description: 'Folder to search' },
	{ kind: 'setting', key: 'search', description: 'Text to find in callout titles or bodies' },
];

export function registerCalloutTrackerEditorSuggest(
	plugin: CalloutTrackerPlugin,
): EditorSuggest<Suggestion> {
	return new CalloutTrackerEditorSuggest(plugin);
}

class CalloutTrackerEditorSuggest extends EditorSuggest<Suggestion> {
	private suggestionKind: 'setting' | 'callout' = 'setting';

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

		return OPTIONS.filter((option) => option.key.startsWith(query));
	}

	renderSuggestion(value: Suggestion, element: HTMLElement): void {
		if (value.kind === 'callout') {
			element.createDiv({ text: value.name });
			return;
		}

		element.createDiv({ text: `${value.key}:` });
		element.createDiv({ text: value.description, cls: 'callout-tracker__suggestion-description' });
	}

	selectSuggestion(value: Suggestion): void {
		const context = this.context;
		if (!context) {
			return;
		}

		const replacement = value.kind === 'callout' ? `${value.name}, ` : `${value.key}: `;
		context.editor.replaceRange(replacement, context.start, context.end);
		context.editor.setCursor({
			line: context.start.line,
			ch: context.start.ch + replacement.length,
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
