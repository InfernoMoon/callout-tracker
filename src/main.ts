import { Plugin } from 'obsidian';
import { registerCalloutTrackerProcessor } from './callout-renderer';
import {
	DEFAULT_SETTINGS,
	CalloutTrackerSettings,
	CalloutTrackerSettingTab,
} from './settings';

export default class CalloutTrackerPlugin extends Plugin {
	settings!: CalloutTrackerSettings;

	async onload(): Promise<void> {
		const savedSettings = (await this.loadData()) as StoredCalloutTrackerSettings | null;
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			savedSettings ?? {},
		);

		if (!savedSettings?.ignoredPrefixes) {
			const oldPrefixes = [
				...(savedSettings?.ignoredFilePrefixes ?? []),
				...(savedSettings?.ignoredFolderPrefixes ?? []),
			];
			if (oldPrefixes.length > 0) {
				this.settings.ignoredPrefixes = [...new Set(oldPrefixes)];
			}
		}

		registerCalloutTrackerProcessor(this);
		this.addSettingTab(new CalloutTrackerSettingTab(this.app, this));
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

type StoredCalloutTrackerSettings = Partial<CalloutTrackerSettings> & {
	ignoredFilePrefixes?: string[];
	ignoredFolderPrefixes?: string[];
};
