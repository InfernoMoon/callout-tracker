import { App, PluginSettingTab, Setting, setIcon } from 'obsidian';
import { applyCalloutStyle, normalizeIconName } from './callout-styles';
import { CalloutIconSuggest } from './icon-suggest';
import type CalloutTrackerPlugin from './main';
import type { CustomCallout } from './types';

export interface CalloutTrackerSettings {
	rootFolder: string;
	ignoredPrefixes: string[];
	customCallouts: CustomCallout[];
}

export const DEFAULT_CUSTOM_CALLOUTS: CustomCallout[] = [
	{
		name: 'todo',
		fontColor: '#45f27d',
		backgroundColor: '#0a2410',
		hasBorder: true,
		borderColor: '#45f27d',
		borderWidth: '3px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'list-checks',
	},
	{
		name: 'idea',
		fontColor: '#dfbb05',
		backgroundColor: '#383200',
		hasBorder: true,
		borderColor: '#ebd107',
		borderWidth: '4px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'lightbulb',
	},
	{
		name: 'note',
		fontColor: '#05dfd8',
		backgroundColor: '#003238',
		hasBorder: true,
		borderColor: '#0dbbac',
		borderWidth: '4px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'sticky-note',
	},
	{
		name: 'hook',
		fontColor: '#f0a34b',
		backgroundColor: '#1a0d04',
		hasBorder: true,
		borderColor: '#e78a32',
		borderWidth: '3px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'fishing-hook',
	},
	{
		name: 'rule',
		fontColor: '#73b787',
		backgroundColor: '#08201e',
		hasBorder: true,
		borderColor: '#3e8252',
		borderWidth: '4px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'scale',
	},
	{
		name: 'clue',
		fontColor: '#e86fa7',
		backgroundColor: '#180611',
		hasBorder: true,
		borderColor: '#ff5fa2',
		borderWidth: '3px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'search',
	},
];

export const DEFAULT_SETTINGS: CalloutTrackerSettings = {
	rootFolder: '',
	ignoredPrefixes: ['_'],
	customCallouts: DEFAULT_CUSTOM_CALLOUTS,
};

export class CalloutTrackerSettingTab extends PluginSettingTab {
	plugin: CalloutTrackerPlugin;

	constructor(app: App, plugin: CalloutTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions() {
		return [
			{
				name: 'Default root folder',
				desc: 'Search this folder and its subfolders by default. Leave empty to search the entire vault.',
				render: (setting: Setting): void => {
					addRootFolderControl(setting, this.plugin);
				},
			},
			{
				name: 'Ignore prefixes',
				desc: 'Skip files and folders whose names start with one of these prefixes.',
				render: (setting: Setting): void => {
					addIgnoredPrefixesControl(setting, this.plugin);
				},
			},
			{
				name: 'Custom callouts',
				desc: 'Define the appearance of native Obsidian callouts by name.',
				render: (setting: Setting): void => {
					setting.addButton((button) =>
						button
							.setButtonText('Add custom callout')
							.setCta()
							.onClick(async () => {
								this.plugin.settings.customCallouts.push(createDefaultCustomCallout());
								await this.plugin.saveSettings();
								this.plugin.updateCalloutStyles();
								this.refreshSettings();
							}),
					);

					const customCalloutsEl = (setting.settingEl.parentElement ?? setting.settingEl).createDiv({
						cls: 'callout-tracker__custom-callouts',
					});
					for (const [index, callout] of this.plugin.settings.customCallouts.entries()) {
						renderCustomCallout(this.plugin, customCalloutsEl, callout, index, this);
					}
				},
			},
		];
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const rootFolderSetting = new Setting(containerEl)
			.setName('Default root folder')
			.setDesc(
				'Search this folder and its subfolders by default. Leave empty to search the entire vault.',
			);
		addRootFolderControl(rootFolderSetting, this.plugin);

		const ignoredPrefixesSetting = new Setting(containerEl)
			.setName('Ignore prefixes')
			.setDesc('Skip files and folders whose names start with one of these prefixes.');
		addIgnoredPrefixesControl(ignoredPrefixesSetting, this.plugin);

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
						this.refreshSettings();
					}),
			);

		const customCalloutsEl = containerEl.createDiv({
			cls: 'callout-tracker__custom-callouts',
		});
		for (const [index, callout] of this.plugin.settings.customCallouts.entries()) {
			renderCustomCallout(this.plugin, customCalloutsEl, callout, index, this);
		}
	}

	refreshSettings(): void {
		const declarativeTab = this as PluginSettingTab & { update?: () => void };
		if (typeof declarativeTab.update === 'function') {
			declarativeTab.update();
			return;
		}
		this.display();
	}
}

function addRootFolderControl(setting: Setting, plugin: CalloutTrackerPlugin): void {
	setting.addText((text) =>
		text
			.setPlaceholder('Vault-wide search')
			.setValue(plugin.settings.rootFolder)
			.onChange(async (value) => {
				plugin.settings.rootFolder = value.trim();
				await plugin.saveSettings();
			}),
	);
}

function addIgnoredPrefixesControl(setting: Setting, plugin: CalloutTrackerPlugin): void {
	setting.addText((text) =>
		text
			.setPlaceholder('_ , draft')
			.setValue(plugin.settings.ignoredPrefixes.join(', '))
			.onChange(async (value) => {
				plugin.settings.ignoredPrefixes = parsePrefixList(value);
				await plugin.saveSettings();
			}),
	);
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
	});
	const summaryIconEl = summaryEl.createDiv({ cls: 'callout-icon' });
	const summaryNameEl = summaryEl.createSpan({
		text: callout.name || 'Unnamed callout',
	});
	const fieldsEl = calloutEl.createDiv({ cls: 'callout-tracker__custom-callout-fields' });
	let refreshPreview = (): void => undefined;

	new Setting(fieldsEl)
		.setName('Name')
		.setDesc('The value used in > [!name].')
		.addText((text) =>
			text.setValue(callout.name).onChange(async (value) => {
				callout.name = value.trim().toLowerCase().replace(/\s+/g, '-');
				summaryNameEl.setText(callout.name || 'Unnamed callout');
				await saveCalloutSettings(plugin);
			}),
		);

	new Setting(fieldsEl)
		.setName('Font color')
		.addColorPicker((color) =>
			color.setValue(callout.fontColor).onChange(async (value) => {
				callout.fontColor = value;
				refreshPreview();
				await saveCalloutSettings(plugin);
			}),
		);

	new Setting(fieldsEl)
		.setName('Background color')
		.addColorPicker((color) =>
			color.setValue(callout.backgroundColor).onChange(async (value) => {
				callout.backgroundColor = value;
				refreshPreview();
				await saveCalloutSettings(plugin);
			}),
		);

	let borderColorSetting: Setting | null = null;
	new Setting(fieldsEl)
		.setName('Has border')
		.addToggle((toggle) =>
			toggle.setValue(callout.hasBorder).onChange(async (value) => {
				callout.hasBorder = value;
				borderColorSetting?.settingEl.toggle(value);
				refreshPreview();
				await saveCalloutSettings(plugin);
			}),
		);

	borderColorSetting = new Setting(fieldsEl)
		.setName('Border color')
		.addColorPicker((color) =>
			color.setValue(callout.borderColor).onChange(async (value) => {
				callout.borderColor = value;
				refreshPreview();
				await saveCalloutSettings(plugin);
			}),
		);
	borderColorSetting.settingEl.toggle(callout.hasBorder);

	let iconSetting: Setting | null = null;
	new Setting(fieldsEl)
		.setName('Has icon')
		.addToggle((toggle) =>
			toggle.setValue(callout.hasIcon).onChange(async (value) => {
				callout.hasIcon = value;
				iconSetting?.settingEl.toggle(value);
				refreshPreview();
				await saveCalloutSettings(plugin);
			}),
		);

	let iconPreviewEl: HTMLElement | null = null;
	let iconSuggest: CalloutIconSuggest | null = null;
	iconSetting = new Setting(fieldsEl)
		.setName('Icon name')
		.setDesc('Use a lucide icon name, for example lightbulb.')
		.addText((text) => {
			text.setValue(callout.iconName).onChange(async (value) => {
				callout.iconName = value.trim();
				refreshPreview();
				if (iconPreviewEl) {
					updateIconPreview(iconPreviewEl, callout.iconName);
				}
				await saveCalloutSettings(plugin);
			});
			iconSuggest = new CalloutIconSuggest(plugin.app, text.inputEl);
			iconSuggest.onSelect(async (value) => {
				callout.iconName = value;
				refreshPreview();
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
	iconSetting.settingEl.toggle(callout.hasIcon);
	updateIconPreview(iconPreviewEl, callout.iconName);

	new Setting(fieldsEl).addButton((button) =>
		button
			.setButtonText('Remove')
			.setWarning()
			.onClick(async () => {
				plugin.settings.customCallouts.splice(index, 1);
				await plugin.saveSettings();
				plugin.updateCalloutStyles();
				settingTab.refreshSettings();
			}),
	);

	refreshPreview = (): void => {
		applyCalloutStyle(calloutEl, callout);
		summaryIconEl.empty();
		if (callout.hasIcon && callout.iconName.trim()) {
			setIcon(summaryIconEl, normalizeIconName(callout.iconName));
		}
	};
	refreshPreview();
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
