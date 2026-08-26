import { App, PluginSettingTab, Setting } from 'obsidian';
import type CalloutTrackerPlugin from './main';

export interface CalloutTrackerSettings {
	rootFolder: string;
	ignoredPrefixes: string[];
}

export const DEFAULT_SETTINGS: CalloutTrackerSettings = {
	rootFolder: '',
	ignoredPrefixes: ['_'],
};

export class CalloutTrackerSettingTab extends PluginSettingTab {
	plugin: CalloutTrackerPlugin;

	constructor(app: App, plugin: CalloutTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Default root folder')
			.setDesc(
				'Search this folder and its subfolders by default. Leave empty to search the entire vault.',
			)
			.addText((text) =>
				text
					.setPlaceholder('Vault-wide search')
					.setValue(this.plugin.settings.rootFolder)
					.onChange(async (value) => {
						this.plugin.settings.rootFolder = value.trim();
						await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Ignore prefixes')
			.setDesc('Skip files and folders whose names start with one of these prefixes.')
			.addText((text) =>
				text
					.setPlaceholder('_ , draft')
					.setValue(this.plugin.settings.ignoredPrefixes.join(', '))
					.onChange(async (value) => {
						this.plugin.settings.ignoredPrefixes = parsePrefixList(value);
						await this.plugin.saveSettings();
					}),
			);
	}
}

function parsePrefixList(value: string): string[] {
	return value
		.split(',')
		.map((prefix) => prefix.trim())
		.filter(Boolean);
}
