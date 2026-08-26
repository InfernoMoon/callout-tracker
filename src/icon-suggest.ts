import { AbstractInputSuggest, getIconIds, setIcon } from 'obsidian';
import type { App } from 'obsidian';

export class CalloutIconSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.limit = 100;
	}

	protected getSuggestions(query: string): string[] {
		const normalizedQuery = query.trim().toLowerCase().replace(/^lucide-/, '');
		return [...new Set(getIconIds().map(removeLucidePrefix))]
			.filter((iconName) => iconName.toLowerCase().includes(normalizedQuery))
			.slice(0, this.limit);
	}

	renderSuggestion(iconName: string, element: HTMLElement): void {
		const iconEl = element.createSpan({ cls: 'callout-tracker__icon-suggestion' });
		setIcon(iconEl, iconName);
		element.createSpan({ text: iconName });
	}
}

function removeLucidePrefix(iconName: string): string {
	return iconName.replace(/^lucide-/, '');
}
