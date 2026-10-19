import { AbstractInputSuggest } from 'obsidian';
import type { App } from 'obsidian';

export class CalloutPropertySuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		inputEl: HTMLInputElement,
		private readonly getPropertyNames: () => Promise<string[]>,
		private readonly getExcludedNames: () => string[],
	) {
		super(app, inputEl);
		this.onSelect((name) => this.setValue(name));
	}

	protected async getSuggestions(query: string): Promise<string[]> {
		const normalizedQuery = query.toLocaleLowerCase();
		const excludedNames = new Set(
			this.getExcludedNames().map((name) => name.toLocaleLowerCase()),
		);
		const propertyNames = await this.getPropertyNames();

		return propertyNames
			.filter((name) => name.toLocaleLowerCase().startsWith(normalizedQuery))
			.filter((name) => !excludedNames.has(name.toLocaleLowerCase()))
			.slice(0, this.limit);
	}

	renderSuggestion(name: string, element: HTMLElement): void {
		element.setText(name);
	}
}
