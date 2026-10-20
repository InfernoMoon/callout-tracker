import { Plugin } from 'obsidian';
import { createCalloutTrackerApi } from './api';
import type { CalloutTrackerApi } from './api';
import { registerCalloutTrackerProcessor } from './callout-renderer';
import { registerCalloutCheckboxPostProcessor } from './callout-checkbox';
import { registerCalloutTrackerEditorSuggest } from './editor-suggest';
import { registerInsertCalloutCommand } from './commands/insert-callout';
import { CalloutStyleManager } from './callout-styles';
import { CalloutPropertyIndex } from './property-index';
import {
	DEFAULT_CALLOUT_INSERT_TEMPLATE,
	DEFAULT_CUSTOM_CALLOUTS,
	DEFAULT_SETTINGS,
	CalloutTrackerSettings,
	CalloutTrackerSettingTab,
} from './settings';
import type { CustomCallout } from './types';

export default class CalloutTrackerPlugin extends Plugin {
	settings!: CalloutTrackerSettings;
	calloutStyleManager!: CalloutStyleManager;
	propertyIndex!: CalloutPropertyIndex;
	api!: CalloutTrackerApi;

	async onload(): Promise<void> {
		const savedSettings = (await this.loadData()) as StoredCalloutTrackerSettings | null;
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			savedSettings ?? {},
		);
		this.settings.ignoredPrefixes = [...this.settings.ignoredPrefixes];
		const storedCallouts = (savedSettings?.customCallouts ?? this.settings.customCallouts) as StoredCustomCallout[];
		this.settings.customCallouts = storedCallouts.map((storedCallout) => {
			const {
				fontColor: legacyFontColor,
				backgroundColor: legacyBackgroundColor,
				...callout
			} = storedCallout;
			const defaultCallout = DEFAULT_CUSTOM_CALLOUTS.find(
				(candidate) => candidate.name === callout.name,
			);
			return {
				...defaultCallout,
				...callout,
				fontColorDark: callout.fontColorDark ?? legacyFontColor ?? defaultCallout?.fontColorDark ?? '#ffffff',
				fontColorLight: callout.fontColorLight ?? defaultCallout?.fontColorLight ?? '#333333',
				backgroundColorDark: callout.backgroundColorDark ?? legacyBackgroundColor ?? defaultCallout?.backgroundColorDark ?? '#383200',
				backgroundColorLight: callout.backgroundColorLight ?? defaultCallout?.backgroundColorLight ?? '#f2f2f2',
			};
		});
		this.settings.calloutInsertTemplates = this.settings.calloutInsertTemplates.map((template) => ({
			...template,
			isCollapsible: template.isCollapsible ?? false,
			startsCollapsed: template.startsCollapsed ?? false,
			properties: template.properties.map((property) => ({ ...property })),
		}));
		if (!savedSettings?.hasInitializedCalloutTemplateDefaults) {
			const hasMyToDoTemplate = this.settings.calloutInsertTemplates.some(
				(template) => template.name.toLocaleLowerCase() === DEFAULT_CALLOUT_INSERT_TEMPLATE.name.toLocaleLowerCase(),
			);
			if (!hasMyToDoTemplate) {
				this.settings.calloutInsertTemplates.push({
					...DEFAULT_CALLOUT_INSERT_TEMPLATE,
					properties: DEFAULT_CALLOUT_INSERT_TEMPLATE.properties.map((property) => ({ ...property })),
				});
			}
			this.settings.hasInitializedCalloutTemplateDefaults = true;
		}
		this.api = createCalloutTrackerApi(this);
		this.propertyIndex = new CalloutPropertyIndex(
			this.app,
			() => this.settings.ignoredPrefixes,
		);
		this.registerEvent(this.app.vault.on('create', (file) => {
			if (isPropertySourcePath(file.path)) {
				this.propertyIndex.invalidate();
			}
		}));
		this.registerEvent(this.app.vault.on('modify', (file) => {
			if (isPropertySourcePath(file.path)) {
				this.propertyIndex.invalidate();
			}
		}));
		this.registerEvent(this.app.vault.on('delete', (file) => {
			if (isPropertySourcePath(file.path)) {
				this.propertyIndex.invalidate();
			}
		}));
		this.registerEvent(this.app.vault.on('rename', () => {
			this.propertyIndex.invalidate();
		}));

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
		registerCalloutCheckboxPostProcessor(this);
		this.calloutStyleManager.update(
			this.settings.customCallouts,
			this.settings.keepPropertiesVisibleWhenCollapsed,
		);

		registerCalloutTrackerProcessor(this);
		this.registerEditorSuggest(registerCalloutTrackerEditorSuggest(this));
		registerInsertCalloutCommand(this);
		this.addSettingTab(new CalloutTrackerSettingTab(this.app, this));
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.propertyIndex.invalidate();
	}

	updateCalloutStyles(): void {
		this.calloutStyleManager.update(
			this.settings.customCallouts,
			this.settings.keepPropertiesVisibleWhenCollapsed,
		);
	}
}

function isPropertySourcePath(path: string): boolean {
	return /\.(?:md|canvas)$/i.test(path);
}

type StoredCustomCallout = Omit<
	CustomCallout,
	'fontColorDark' | 'fontColorLight' | 'backgroundColorDark' | 'backgroundColorLight'
> & {
	fontColorDark?: string;
	fontColorLight?: string;
	backgroundColorDark?: string;
	backgroundColorLight?: string;
	fontColor?: string;
	backgroundColor?: string;
};

type StoredCalloutTrackerSettings = Omit<Partial<CalloutTrackerSettings>, 'customCallouts'> & {
	customCallouts?: StoredCustomCallout[];
	ignoredFilePrefixes?: string[];
	ignoredFolderPrefixes?: string[];
};
