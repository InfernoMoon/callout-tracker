import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import { normalizeIconName } from './callout-styles';
import { CalloutIconSuggest } from './icon-suggest';
import type CalloutTrackerPlugin from './main';
import type { CustomCallout } from './types';

export interface CalloutTrackerSettings {
	rootFolder: string;
	ignoredPrefixes: string[];
	customCallouts: CustomCallout[];
}

export const DEFAULT_SETTINGS: CalloutTrackerSettings = {
	rootFolder: '',
	ignoredPrefixes: ['_'],
	customCallouts: [],
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

		new Setting(containerEl)
			.setName('Custom callouts')
			.setDesc('Define the appearance of native Obsidian callouts by name.')
			.addButton((button) =>
				button
					.setButtonText('Add custom callout')
					.setCta()
					.onClick(async () => {
						this.plugin.settings.customCallouts.push(createDefaultCustomCallout());
						await this.plugin.saveSettings();
						this.plugin.updateCalloutStyles();
						this.display();
					}),
			);

		const customCalloutsEl = containerEl.createDiv({
			cls: 'callout-tracker__custom-callouts',
		});
		for (const [index, callout] of this.plugin.settings.customCallouts.entries()) {
			renderCustomCallout(this.plugin, customCalloutsEl, callout, index, this);
		}
	}
}

function parsePrefixList(value: string): string[] {
	return value
		.split(',')
		.map((prefix) => prefix.trim())
		.filter(Boolean);
}

function createDefaultCustomCallout(): CustomCallout {
	return {
		name: 'custom-callout',
		fontColor: '#ffffff',
		backgroundColor: '#383200',
		hasBorder: true,
		borderColor: '#ebd107',
		hasIcon: true,
		iconName: 'lightbulb',
	};
}

function renderCustomCallout(
	plugin: CalloutTrackerPlugin,
	containerEl: HTMLElement,
	callout: CustomCallout,
	index: number,
	settingTab: CalloutTrackerSettingTab,
): void {
	const calloutEl = containerEl.createEl('details', {
		cls: 'callout-tracker__custom-callout',
	});
	const summaryEl = calloutEl.createEl('summary', {
		text: callout.name || 'Unnamed callout',
	});
	const fieldsEl = calloutEl.createDiv({ cls: 'callout-tracker__custom-callout-fields' });

	new Setting(fieldsEl)
		.setName('Name')
		.setDesc('The value used in > [!name].')
		.addText((text) =>
			text.setValue(callout.name).onChange(async (value) => {
				callout.name = value.trim().toLowerCase().replace(/\s+/g, '-');
				summaryEl.setText(callout.name || 'Unnamed callout');
				await saveCalloutSettings(plugin);
			}),
		);

	new Setting(fieldsEl)
		.setName('Font color')
		.addColorPicker((color) =>
			color.setValue(callout.fontColor).onChange(async (value) => {
				callout.fontColor = value;
				await saveCalloutSettings(plugin);
			}),
		);

	new Setting(fieldsEl)
		.setName('Background color')
		.addColorPicker((color) =>
			color.setValue(callout.backgroundColor).onChange(async (value) => {
				callout.backgroundColor = value;
				await saveCalloutSettings(plugin);
			}),
		);

	new Setting(fieldsEl)
		.setName('Has border')
		.addToggle((toggle) =>
			toggle.setValue(callout.hasBorder).onChange(async (value) => {
				callout.hasBorder = value;
				await saveCalloutSettings(plugin);
			}),
		);

	new Setting(fieldsEl)
		.setName('Border color')
		.addColorPicker((color) =>
			color.setValue(callout.borderColor).onChange(async (value) => {
				callout.borderColor = value;
				await saveCalloutSettings(plugin);
			}),
		);

	new Setting(fieldsEl)
		.setName('Has icon')
		.addToggle((toggle) =>
			toggle.setValue(callout.hasIcon).onChange(async (value) => {
				callout.hasIcon = value;
				await saveCalloutSettings(plugin);
			}),
		);

	let iconPreviewEl: HTMLElement | null = null;
	let iconSuggest: CalloutIconSuggest | null = null;
	const iconSetting = new Setting(fieldsEl)
		.setName('Icon name')
		.setDesc('Use a lucide icon name, for example lightbulb.')
		.addText((text) => {
			text.setValue(callout.iconName).onChange(async (value) => {
				callout.iconName = value.trim();
				if (iconPreviewEl) {
					updateIconPreview(iconPreviewEl, callout.iconName);
				}
				await saveCalloutSettings(plugin);
			});
			iconSuggest = new CalloutIconSuggest(plugin.app, text.inputEl);
			iconSuggest.onSelect(async (value) => {
				callout.iconName = value;
				iconSuggest?.setValue(value);
				if (iconPreviewEl) {
					updateIconPreview(iconPreviewEl, callout.iconName);
				}
				await saveCalloutSettings(plugin);
			});
			return text;
		});
	iconPreviewEl = iconSetting.controlEl.createDiv({
		cls: 'callout-tracker__icon-preview',
	});
	updateIconPreview(iconPreviewEl, callout.iconName);

	new Setting(fieldsEl).addButton((button) =>
		button
			.setButtonText('Remove')
			.setWarning()
			.onClick(async () => {
				plugin.settings.customCallouts.splice(index, 1);
				await plugin.saveSettings();
				plugin.updateCalloutStyles();
				settingTab.display();
			}),
	);
}

async function saveCalloutSettings(plugin: CalloutTrackerPlugin): Promise<void> {
	await plugin.saveSettings();
	plugin.updateCalloutStyles();
}

function updateIconPreview(containerEl: HTMLElement, iconName: string): void {
	containerEl.empty();
	const normalizedIconName = normalizeIconName(iconName);
	if (normalizedIconName) {
		setIcon(containerEl, normalizedIconName);
	} else {
		containerEl.setText('—');
	}
}
