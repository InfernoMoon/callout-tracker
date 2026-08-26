import { Plugin } from 'obsidian';
import { registerCalloutTrackerProcessor } from './callout-renderer';
import { registerCalloutTrackerEditorSuggest } from './editor-suggest';
import { CalloutStyleManager } from './callout-styles';
import {
	DEFAULT_SETTINGS,
	CalloutTrackerSettings,
	CalloutTrackerSettingTab,
} from './settings';

export default class CalloutTrackerPlugin extends Plugin {
	settings!: CalloutTrackerSettings;
	calloutStyleManager!: CalloutStyleManager;

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

		this.calloutStyleManager = new CalloutStyleManager(this.app);
		this.registerMarkdownPostProcessor((element) => {
			this.calloutStyleManager.applyToElement(element);
		});
		this.calloutStyleManager.update(this.settings.customCallouts);

		registerCalloutTrackerProcessor(this);
		this.registerEditorSuggest(registerCalloutTrackerEditorSuggest(this.app));
		this.addSettingTab(new CalloutTrackerSettingTab(this.app, this));
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	updateCalloutStyles(): void {
		this.calloutStyleManager.update(this.settings.customCallouts);
	}
}

type StoredCalloutTrackerSettings = Partial<CalloutTrackerSettings> & {
	ignoredFilePrefixes?: string[];
	ignoredFolderPrefixes?: string[];
};
