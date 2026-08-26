import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
} from 'obsidian';
import type { App, TFile } from 'obsidian';

interface TrackerOption {
	key: 'callouts' | 'rootfolder';
	description: string;
}

const OPTIONS: TrackerOption[] = [
	{ key: 'callouts', description: 'Callout types to include' },
	{ key: 'rootfolder', description: 'Folder to search' },
];

export function registerCalloutTrackerEditorSuggest(app: App): EditorSuggest<TrackerOption> {
	return new CalloutTrackerEditorSuggest(app);
}

class CalloutTrackerEditorSuggest extends EditorSuggest<TrackerOption> {
	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (!file || !isInsideCalloutTrackerBlock(editor, cursor.line)) {
			return null;
		}

		const beforeCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
		const match = beforeCursor.match(/^\s*([a-z]*)$/i);
		if (!match) {
			return null;
		}

		const query = match[1] ?? '';
		return {
			start: { line: cursor.line, ch: cursor.ch - query.length },
			end: cursor,
			query,
		};
	}

	getSuggestions(context: EditorSuggestContext): TrackerOption[] {
		const query = context.query.toLowerCase();
		return OPTIONS.filter((option) => option.key.startsWith(query));
	}

	renderSuggestion(value: TrackerOption, element: HTMLElement): void {
		element.createDiv({ text: `${value.key}:` });
		element.createDiv({ text: value.description, cls: 'callout-tracker__suggestion-description' });
	}

	selectSuggestion(value: TrackerOption): void {
		const context = this.context;
		if (!context) {
			return;
		}

		const replacement = `${value.key}: `;
		context.editor.replaceRange(replacement, context.start, context.end);
		context.editor.setCursor({
			line: context.start.line,
			ch: context.start.ch + replacement.length,
		});
	}
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
