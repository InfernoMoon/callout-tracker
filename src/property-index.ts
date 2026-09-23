import type { App } from 'obsidian';
import { findAllCallouts } from './callout-scanner';

export class CalloutPropertyIndex {
	private propertyNames = new Set<string>();
	private dirty = true;
	private generation = 0;
	private rebuildPromise: Promise<string[]> | null = null;

	constructor(
		private readonly app: App,
		private readonly getIgnoredPrefixes: () => string[],
	) {}

	invalidate(): void {
		this.dirty = true;
		this.generation++;
	}

	async getPropertyNames(): Promise<string[]> {
		if (!this.dirty) {
			return [...this.propertyNames];
		}

		this.rebuildPromise ??= this.rebuild();

		try {
			return await this.rebuildPromise;
		} finally {
			this.rebuildPromise = null;
		}
	}

	private async rebuild(): Promise<string[]> {
		const generation = this.generation;
		const entries = await findAllCallouts(this.app, this.getIgnoredPrefixes());
		const names = new Set<string>();
		for (const entry of entries) {
			for (const property of entry.properties) {
				if (property.key.trim()) {
					names.add(property.key);
				}
			}
		}

		this.propertyNames = names;
		if (generation === this.generation) {
			this.dirty = false;
		}

		return [...names].sort((left, right) => left.localeCompare(right));
	}
}
