import { App, Notice, PluginSettingTab, Setting, setIcon } from 'obsidian';
import {
	applyCalloutStyle,
	normalizeIconName,
} from './callout-styles';
import { CalloutIconSuggest } from './icon-suggest';
import type CalloutTrackerPlugin from './main';
import type { CalloutInsertTemplate, CalloutProperty, CustomCallout } from './types';

export interface CalloutTrackerSettings {
	rootFolder: string;
	ignoredPrefixes: string[];
	keepPropertiesVisibleWhenCollapsed: boolean;
	customCallouts: CustomCallout[];
	lastUsedCalloutType: string;
	lastUsedAddCheckbox: boolean;
	lastUsedCheckboxChecked: boolean;
	lastUsedCalloutIsCollapsible: boolean;
	lastUsedCalloutStartsCollapsed: boolean;
	lastUsedProperties: CalloutProperty[];
	calloutInsertTemplates: CalloutInsertTemplate[];
	hasInitializedCalloutTemplateDefaults: boolean;
}

export const DEFAULT_CALLOUT_INSERT_TEMPLATE: CalloutInsertTemplate = {
	name: 'MyToDo',
	calloutType: 'todo',
	title: 'ToDo: ',
	content: '',
	hasCheckbox: true,
	checkboxStartsChecked: false,
	isCollapsible: true,
	startsCollapsed: true,
	properties: [{ key: 'priority', value: '' }],
};

export const DEFAULT_CUSTOM_CALLOUTS: CustomCallout[] = [
	{
		name: 'todo',
		fontColorDark: '#45f27d',
		fontColorLight: '#176b37',
		backgroundColorDark: '#0a2410',
		backgroundColorLight: '#e9f8ee',
		hasBorder: true,
		borderColor: '#45f27d',
		borderWidth: '3px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'list-checks',
	},
	{
		name: 'idea',
		fontColorDark: '#dfbb05',
		fontColorLight: '#705e00',
		backgroundColorDark: '#383200',
		backgroundColorLight: '#fff8d9',
		hasBorder: true,
		borderColor: '#ebd107',
		borderWidth: '4px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'lightbulb',
	},
	{
		name: 'note',
		fontColorDark: '#05dfd8',
		fontColorLight: '#0f6563',
		backgroundColorDark: '#033035',
		backgroundColorLight: '#e6f7f6',
		hasBorder: true,
		borderColor: '#0dbbac',
		borderWidth: '4px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'sticky-note',
	},
	{
		name: 'hook',
		fontColorDark: '#f0a34b',
		fontColorLight: '#8a4c0b',
		backgroundColorDark: '#1a0d04',
		backgroundColorLight: '#fff1e2',
		hasBorder: true,
		borderColor: '#e78a32',
		borderWidth: '3px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'fishing-hook',
	},
	{
		name: 'rule',
		fontColorDark: '#73b787',
		fontColorLight: '#315e42',
		backgroundColorDark: '#08201e',
		backgroundColorLight: '#eaf3ec',
		hasBorder: true,
		borderColor: '#3e8252',
		borderWidth: '4px',
		borderStyle: 'solid',
		hasIcon: true,
		iconName: 'scale',
	},
	{
		name: 'clue',
		fontColorDark: '#e86fa7',
		fontColorLight: '#88385f',
		backgroundColorDark: '#180611',
		backgroundColorLight: '#fbeaf2',
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
	keepPropertiesVisibleWhenCollapsed: false,
	customCallouts: DEFAULT_CUSTOM_CALLOUTS,
	lastUsedCalloutType: 'todo',
	lastUsedAddCheckbox: false,
	lastUsedCheckboxChecked: false,
	lastUsedCalloutIsCollapsible: false,
	lastUsedCalloutStartsCollapsed: false,
	lastUsedProperties: [],
	calloutInsertTemplates: [DEFAULT_CALLOUT_INSERT_TEMPLATE],
	hasInitializedCalloutTemplateDefaults: true,
};

export class CalloutTrackerSettingTab extends PluginSettingTab {
	plugin: CalloutTrackerPlugin;

	constructor(app: App, plugin: CalloutTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		plugin.registerEvent(app.workspace.on('css-change', () => this.updateThemeToggleButtons()));
	}

	private addCustomCalloutHeaderButtons(setting: Setting): void {
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
		setting.addButton((button) => {
			button
				.setIcon(this.getThemeToggleIcon())
				.setTooltip(this.getThemeToggleTooltip())
				.setClass('callout-tracker__theme-toggle');
			return button.onClick(() => {
				const app = this.plugin.app as App & {
					commands?: { executeCommandById(commandId: string): boolean };
				};
				const toggled = app.commands?.executeCommandById('theme:toggle-light-dark') ?? false;
				if (!toggled) {
					new Notice('Could not switch theme. Update Obsidian and try again.');
					return;
				}
				this.updateThemeToggleButtons();
			});
		});
	}

	private getThemeToggleIcon(): string {
		return this.isDarkMode() ? 'sun' : 'moon';
	}

	private getThemeToggleTooltip(): string {
		return `Switch Obsidian to ${this.isDarkMode() ? 'light' : 'dark'} mode`;
	}

	private isDarkMode(): boolean {
		return document.body.classList.contains('theme-dark');
	}

	private updateThemeToggleButtons(): void {
		const nextTheme = this.isDarkMode() ? 'light' : 'dark';
		this.containerEl.querySelectorAll<HTMLElement>('.callout-tracker__theme-toggle').forEach((button) => {
			setIcon(button, nextTheme === 'light' ? 'sun' : 'moon');
			button.setAttribute('aria-label', `Switch Obsidian to ${nextTheme} mode`);
			button.setAttribute('title', `Switch Obsidian to ${nextTheme} mode`);
		});
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
				name: 'Keep properties visible when collapsed',
				desc: 'Keep callout properties visible while the rest of a collapsed callout is hidden.',
				render: (setting: Setting): void => {
					addKeepPropertiesVisibleWhenCollapsedControl(setting, this.plugin);
				},
			},
			{
				name: 'Custom callouts',
				desc: 'Define the appearance of native Obsidian callouts by name.',
				render: (setting: Setting): void => {
					setting.settingEl.addClass('callout-tracker__custom-callouts-setting');
					this.addCustomCalloutHeaderButtons(setting);

					const customCalloutsEl =
						setting.settingEl.querySelector<HTMLElement>(
							':scope > .callout-tracker__custom-callouts',
						) ?? setting.settingEl.createDiv({
							cls: 'callout-tracker__custom-callouts',
						});
					customCalloutsEl.empty();
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

		const keepPropertiesVisibleSetting = new Setting(containerEl)
			.setName('Keep properties visible when collapsed')
			.setDesc('Keep callout properties visible while the rest of a collapsed callout is hidden.');
		addKeepPropertiesVisibleWhenCollapsedControl(keepPropertiesVisibleSetting, this.plugin);

		const customCalloutsSetting = new Setting(containerEl)
			.setName('Custom callouts')
			.setDesc('Define the appearance of native Obsidian callouts by name.');
		customCalloutsSetting.settingEl.addClass('callout-tracker__custom-callouts-setting');
		this.addCustomCalloutHeaderButtons(customCalloutsSetting);

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

function addKeepPropertiesVisibleWhenCollapsedControl(
	setting: Setting,
	plugin: CalloutTrackerPlugin,
): void {
	setting.addToggle((toggle) =>
		toggle
			.setValue(plugin.settings.keepPropertiesVisibleWhenCollapsed)
			.onChange(async (value) => {
				plugin.settings.keepPropertiesVisibleWhenCollapsed = value;
				await plugin.saveSettings();
				plugin.updateCalloutStyles();
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
		fontColorDark: '#ffffff',
		fontColorLight: '#333333',
		backgroundColorDark: '#383200',
		backgroundColorLight: '#f2f2f2',
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

	addCalloutColorSetting(plugin, fieldsEl, callout, 'Text color (dark mode)', 'fontColorDark', () => refreshPreview());
	addCalloutColorSetting(plugin, fieldsEl, callout, 'Text color (light mode)', 'fontColorLight', () => refreshPreview());
	addCalloutColorSetting(plugin, fieldsEl, callout, 'Background color (dark mode)', 'backgroundColorDark', () => refreshPreview());
	addCalloutColorSetting(plugin, fieldsEl, callout, 'Background color (light mode)', 'backgroundColorLight', () => refreshPreview());

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
		.addColorPicker((color) => {
			color.setValue(callout.borderColor);
			return color.onChange(async (value) => {
				callout.borderColor = value;
				refreshPreview();
				await saveCalloutSettings(plugin);
			});
		});
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

type CalloutColorField = 'fontColorDark' | 'fontColorLight' | 'backgroundColorDark' | 'backgroundColorLight';

function addCalloutColorSetting(
	plugin: CalloutTrackerPlugin,
	containerEl: HTMLElement,
	callout: CustomCallout,
	name: string,
	field: CalloutColorField,
	refreshPreview: () => void,
): void {
	new Setting(containerEl)
		.setName(name)
		.addColorPicker((color) =>
			color.setValue(callout[field]).onChange(async (value) => {
				callout[field] = value;
				refreshPreview();
				await saveCalloutSettings(plugin);
			}),
		);
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
