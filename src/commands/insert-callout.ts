import { Modal, Notice, Setting } from 'obsidian';
import type {
	ButtonComponent,
	DropdownComponent,
	Editor,
	TextAreaComponent,
	TextComponent,
} from 'obsidian';
import type CalloutTrackerPlugin from '../main';
import { CalloutPropertySuggest } from '../property-suggest';
import { SaveCalloutTemplateModal } from './save-callout-template-modal';
import type { CalloutInsertTemplate, CalloutProperty, CustomCallout } from '../types';

interface CalloutPropertyInputRow {
	element: HTMLElement;
	nameInput: HTMLInputElement;
	valueInput: HTMLInputElement;
	suggest: CalloutPropertySuggest;
}

export function registerInsertCalloutCommand(plugin: CalloutTrackerPlugin): void {
	plugin.addCommand({
		id: 'insert-callout',
		name: 'Insert callout',
		editorCallback: (editor) => {
			new InsertCalloutModal(plugin, editor).open();
		},
	});
}

class InsertCalloutModal extends Modal {
	private readonly plugin: CalloutTrackerPlugin;
	private readonly editor: Editor;
	private readonly calloutTypes: string[];
	private typeInput: HTMLInputElement | null = null;
	private typeInputComponent: TextComponent | null = null;
	private typeDropdown: DropdownComponent | null = null;
	private templateDropdown: DropdownComponent | null = null;
	private deleteTemplateButton: ButtonComponent | null = null;
	private titleInput: TextComponent | null = null;
	private contentInput: TextAreaComponent | null = null;
	private insertButton: HTMLButtonElement | null = null;
	private addCheckboxInput: HTMLInputElement | null = null;
	private checkedByDefaultInput: HTMLInputElement | null = null;
	private checkedByDefaultLabel: HTMLElement | null = null;
	private collapsibleInput: HTMLInputElement | null = null;
	private collapsedByDefaultInput: HTMLInputElement | null = null;
	private collapsedByDefaultLabel: HTMLElement | null = null;
	private propertiesContainer: HTMLElement | null = null;
	private propertyRows: CalloutPropertyInputRow[] = [];
	private overrideTemplateButton: HTMLButtonElement | null = null;
	private hasCheckbox = false;
	private checkboxStartsChecked = false;
	private isCollapsible = false;
	private startsCollapsed = false;
	private selectedTemplateName = '';
	private isRefreshingTemplateDropdown = false;
	private isSavingTemplate = false;
	private isInserting = false;

	private readonly handleInputKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter') {
			event.preventDefault();
			void this.insertCallout();
		}
	};

	private readonly handleContentKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			void this.insertCallout();
		}
	};

	private readonly handleAddCheckboxChange = (): void => {
		const enabled = this.addCheckboxInput?.checked ?? false;
		this.hasCheckbox = enabled;
		if (this.checkedByDefaultInput) {
			this.checkedByDefaultInput.disabled = !enabled;
			if (!enabled) {
				this.checkedByDefaultInput.checked = false;
				this.checkboxStartsChecked = false;
			}
		}
		this.checkedByDefaultLabel?.classList.toggle('is-disabled', !enabled);
	};

	private readonly handleCheckedByDefaultChange = (): void => {
		this.checkboxStartsChecked = this.checkedByDefaultInput?.checked ?? false;
	};

	private readonly handleCollapsibleChange = (): void => {
		const enabled = this.collapsibleInput?.checked ?? false;
		this.isCollapsible = enabled;
		if (this.collapsedByDefaultInput) {
			this.collapsedByDefaultInput.disabled = !enabled;
			if (!enabled) {
				this.collapsedByDefaultInput.checked = false;
				this.startsCollapsed = false;
			}
		}
		this.collapsedByDefaultLabel?.classList.toggle('is-disabled', !enabled);
	};

	private readonly handleCollapsedByDefaultChange = (): void => {
		this.startsCollapsed = this.collapsedByDefaultInput?.checked ?? false;
	};

	constructor(plugin: CalloutTrackerPlugin, editor: Editor) {
		super(plugin.app);
		this.plugin = plugin;
		this.editor = editor;
		this.calloutTypes = getConfiguredCalloutTypes(plugin.settings.customCallouts);
	}

	onOpen(): void {
		this.setTitle('Insert callout');
		this.contentEl.empty();
		this.contentEl.addClass('callout-tracker-insert-callout-modal');

		const templateSetting = new Setting(this.contentEl)
			.setName('Template')
			.setClass('callout-tracker-insert-template-setting');
		templateSetting.addDropdown((dropdown) => {
			this.templateDropdown = dropdown;
			dropdown.addOption('', '');
			for (const template of this.plugin.settings.calloutInsertTemplates) {
				dropdown.addOption(template.name, template.name);
			}
			dropdown.setValue('');
			dropdown.selectEl.setAttribute('aria-label', 'Template');
			dropdown.onChange((name) => {
				if (!this.isRefreshingTemplateDropdown) {
					this.selectTemplate(name);
				}
			});
		});
		templateSetting.controlEl.prepend(
			templateSetting.controlEl.createSpan({
				text: 'Template',
				cls: 'callout-tracker-insert-template-label',
			}),
		);
		templateSetting.addButton((button) => {
			this.deleteTemplateButton = button;
			button
				.setIcon('trash')
				.setTooltip('Delete selected template')
				.setDisabled(true)
				.onClick(() => void this.deleteSelectedTemplate());
			button.buttonEl.setAttribute('aria-label', 'Delete selected template');
		});

		const typeSetting = new Setting(this.contentEl)
			.setName('Callout type')
			.setClass('callout-tracker-insert-type-setting');

		typeSetting.addDropdown((dropdown) => {
			this.typeDropdown = dropdown;
			dropdown.addOption('', '');
			for (const type of this.calloutTypes) {
				dropdown.addOption(type, type);
			}
			dropdown.setValue('');
			dropdown.onChange((value) => {
				this.typeInputComponent?.setValue(value);
			});
		});

		typeSetting.addText((text) => {
			this.typeInputComponent = text;
			this.typeInput = text.inputEl;
			text.setPlaceholder('Type or select a callout type');
			text.onChange((value) => {
				const match = this.calloutTypes.find(
					(type) => type.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
				);
				this.typeDropdown?.setValue(match ?? '');
			});
			text.inputEl.addEventListener('keydown', this.handleInputKeydown);
		});

		const lastUsedType = this.plugin.settings.lastUsedCalloutType.trim() || 'todo';
		const matchingType = this.calloutTypes.find(
			(type) => type.toLocaleLowerCase() === lastUsedType.toLocaleLowerCase(),
		);
		this.typeInputComponent?.setValue(lastUsedType);
		this.typeDropdown?.setValue(matchingType ?? '');

		new Setting(this.contentEl)
			.setName('Title')
			.setClass('callout-tracker-insert-title-setting')
			.addText((text) => {
				this.titleInput = text;
				text.setPlaceholder('Callout title');
				text.inputEl.addEventListener('keydown', this.handleInputKeydown);
			});

		const contentSetting = new Setting(this.contentEl)
			.setName('Content')
			.setClass('callout-tracker-insert-content-setting');
		contentSetting.addTextArea((text) => {
			this.contentInput = text;
			text.setPlaceholder('Callout content');
			text.inputEl.rows = 5;
			text.inputEl.addEventListener('keydown', this.handleContentKeydown);
		});

		const checkboxSetting = new Setting(this.contentEl)
			.setName('Checkbox')
			.setClass('callout-tracker-insert-checkbox-setting');
		const checkboxOptions = checkboxSetting.controlEl.createDiv({
			cls: 'callout-tracker-insert-checkbox-options',
		});
		const addCheckboxLabel = checkboxOptions.createEl('label', {
			cls: 'callout-tracker-insert-checkbox-option',
		});
		const addCheckboxInput = addCheckboxLabel.createEl('input', { type: 'checkbox' });
		addCheckboxInput.setAttribute('aria-label', 'Add checkbox');
		addCheckboxLabel.createSpan({ text: 'Add checkbox' });
		this.addCheckboxInput = addCheckboxInput;
		addCheckboxInput.addEventListener('change', this.handleAddCheckboxChange);

		const checkedByDefaultLabel = checkboxOptions.createEl('label', {
			cls: 'callout-tracker-insert-checkbox-option is-disabled',
		});
		const checkedByDefaultInput = checkedByDefaultLabel.createEl('input', {
			type: 'checkbox',
			attr: { disabled: 'true' },
		});
		checkedByDefaultInput.setAttribute('aria-label', 'Checked by default');
		checkedByDefaultLabel.createSpan({ text: 'Checked by default' });
		this.checkedByDefaultInput = checkedByDefaultInput;
		this.checkedByDefaultLabel = checkedByDefaultLabel;
		checkedByDefaultInput.addEventListener('change', this.handleCheckedByDefaultChange);
		addCheckboxInput.checked = this.plugin.settings.lastUsedAddCheckbox;
		checkedByDefaultInput.checked = this.plugin.settings.lastUsedCheckboxChecked;
		this.handleAddCheckboxChange();
		this.handleCheckedByDefaultChange();

		const collapsibleSetting = new Setting(this.contentEl)
			.setName('Collapsible')
			.setClass('callout-tracker-insert-collapsible-setting');
		const collapsibleOptions = collapsibleSetting.controlEl.createDiv({
			cls: 'callout-tracker-insert-checkbox-options',
		});
		const collapsibleLabel = collapsibleOptions.createEl('label', {
			cls: 'callout-tracker-insert-checkbox-option',
		});
		const collapsibleInput = collapsibleLabel.createEl('input', { type: 'checkbox' });
		collapsibleInput.setAttribute('aria-label', 'Can be collapsed');
		collapsibleLabel.createSpan({ text: 'Can be collapsed' });
		this.collapsibleInput = collapsibleInput;
		collapsibleInput.addEventListener('change', this.handleCollapsibleChange);

		const collapsedByDefaultLabel = collapsibleOptions.createEl('label', {
			cls: 'callout-tracker-insert-checkbox-option is-disabled',
		});
		const collapsedByDefaultInput = collapsedByDefaultLabel.createEl('input', {
			type: 'checkbox',
			attr: { disabled: 'true' },
		});
		collapsedByDefaultInput.setAttribute('aria-label', 'Collapsed by default');
		collapsedByDefaultLabel.createSpan({ text: 'Collapsed by default' });
		this.collapsedByDefaultInput = collapsedByDefaultInput;
		this.collapsedByDefaultLabel = collapsedByDefaultLabel;
		collapsedByDefaultInput.addEventListener('change', this.handleCollapsedByDefaultChange);
		collapsibleInput.checked = this.plugin.settings.lastUsedCalloutIsCollapsible;
		collapsedByDefaultInput.checked = this.plugin.settings.lastUsedCalloutStartsCollapsed;
		this.handleCollapsibleChange();
		this.handleCollapsedByDefaultChange();

		const propertiesSetting = new Setting(this.contentEl)
			.setName('Properties')
			.setClass('callout-tracker-insert-properties-setting');
		propertiesSetting.addButton((button) => {
			button
				.setIcon('plus')
				.setTooltip('Add property')
				.onClick(() => this.addPropertyRow());
			button.buttonEl.setAttribute('aria-label', 'Add property');
		});
		this.propertiesContainer = this.contentEl.createDiv({
			cls: 'callout-tracker-insert-properties',
		});
		for (const property of this.plugin.settings.lastUsedProperties) {
			this.addPropertyRow(property, false);
		}

		const footer = this.contentEl.createDiv({ cls: 'callout-tracker-insert-footer' });
		const templateActions = footer.createDiv({ cls: 'callout-tracker-insert-template-actions' });
		this.overrideTemplateButton = templateActions.createEl('button', {
			text: 'Override template',
			cls: 'mod-warning',
			attr: { type: 'button' },
		});
		this.overrideTemplateButton.hidden = true;
		this.overrideTemplateButton.addEventListener('click', () => void this.updateSelectedTemplate());
		templateActions.createEl('button', {
			text: 'Save as template',
			attr: { type: 'button' },
		}).addEventListener('click', () => this.openSaveTemplateModal());
		const footerActions = footer.createDiv({ cls: 'callout-tracker-insert-footer-actions' });
		this.insertButton = footerActions.createEl('button', {
			text: 'Insert',
			cls: 'mod-cta',
			attr: { type: 'button' },
		});
		this.insertButton.addEventListener('click', () => void this.insertCallout());
		footerActions.createEl('button', {
			text: 'Cancel',
			attr: { type: 'button' },
		}).addEventListener('click', () => this.close());

		this.insertButton?.focus();
	}

	onClose(): void {
		this.typeInput?.removeEventListener('keydown', this.handleInputKeydown);
		this.titleInput?.inputEl.removeEventListener('keydown', this.handleInputKeydown);
		this.contentInput?.inputEl.removeEventListener('keydown', this.handleContentKeydown);
		this.addCheckboxInput?.removeEventListener('change', this.handleAddCheckboxChange);
		this.checkedByDefaultInput?.removeEventListener('change', this.handleCheckedByDefaultChange);
		this.collapsibleInput?.removeEventListener('change', this.handleCollapsibleChange);
		this.collapsedByDefaultInput?.removeEventListener('change', this.handleCollapsedByDefaultChange);
		for (const row of this.propertyRows) {
			row.suggest.close();
		}
		this.propertyRows = [];
		this.propertiesContainer = null;
		this.typeInput = null;
		this.typeInputComponent = null;
		this.typeDropdown = null;
		this.templateDropdown = null;
		this.deleteTemplateButton = null;
		this.titleInput = null;
		this.contentInput = null;
		this.insertButton = null;
		this.overrideTemplateButton = null;
		this.addCheckboxInput = null;
		this.checkedByDefaultInput = null;
		this.checkedByDefaultLabel = null;
		this.collapsibleInput = null;
		this.collapsedByDefaultInput = null;
		this.collapsedByDefaultLabel = null;
		this.hasCheckbox = false;
		this.checkboxStartsChecked = false;
		this.isCollapsible = false;
		this.startsCollapsed = false;
		this.selectedTemplateName = '';
		this.contentEl.empty();
	}

	private selectTemplate(name: string): void {
		this.selectedTemplateName = name;
		this.updateTemplateActions();
		this.deleteTemplateButton?.setDisabled(!name);
		if (!name) {
			this.resetToCustomDefaults();
			return;
		}

		const template = this.plugin.settings.calloutInsertTemplates.find(
			(candidate) => candidate.name === name,
		);
		if (template) {
			this.applyTemplate(template);
		}
	}

	private applyTemplate(template: CalloutInsertTemplate): void {
		this.typeInputComponent?.setValue(template.calloutType);
		const matchingType = this.calloutTypes.find(
			(type) => type.toLocaleLowerCase() === template.calloutType.toLocaleLowerCase(),
		);
		this.typeDropdown?.setValue(matchingType ?? '');
		this.titleInput?.setValue(template.title);
		this.contentInput?.setValue(template.content);

		if (this.addCheckboxInput) {
			this.addCheckboxInput.checked = template.hasCheckbox;
		}
		if (this.checkedByDefaultInput) {
			this.checkedByDefaultInput.checked = template.checkboxStartsChecked;
		}
		this.handleAddCheckboxChange();
		this.handleCheckedByDefaultChange();

		if (this.collapsibleInput) {
			this.collapsibleInput.checked = template.isCollapsible ?? false;
		}
		if (this.collapsedByDefaultInput) {
			this.collapsedByDefaultInput.checked = template.startsCollapsed ?? false;
		}
		this.handleCollapsibleChange();
		this.handleCollapsedByDefaultChange();
		this.replacePropertyRows(template.properties);
	}

	private resetToCustomDefaults(): void {
		const lastUsedType = this.plugin.settings.lastUsedCalloutType.trim() || 'todo';
		const matchingType = this.calloutTypes.find(
			(type) => type.toLocaleLowerCase() === lastUsedType.toLocaleLowerCase(),
		);
		this.typeInputComponent?.setValue(lastUsedType);
		this.typeDropdown?.setValue(matchingType ?? '');
		this.titleInput?.setValue('');
		this.contentInput?.setValue('');

		if (this.addCheckboxInput) {
			this.addCheckboxInput.checked = this.plugin.settings.lastUsedAddCheckbox;
		}
		if (this.checkedByDefaultInput) {
			this.checkedByDefaultInput.checked = this.plugin.settings.lastUsedCheckboxChecked;
		}
		this.handleAddCheckboxChange();
		this.handleCheckedByDefaultChange();

		if (this.collapsibleInput) {
			this.collapsibleInput.checked = this.plugin.settings.lastUsedCalloutIsCollapsible;
		}
		if (this.collapsedByDefaultInput) {
			this.collapsedByDefaultInput.checked = this.plugin.settings.lastUsedCalloutStartsCollapsed;
		}
		this.handleCollapsibleChange();
		this.handleCollapsedByDefaultChange();
		this.replacePropertyRows(this.plugin.settings.lastUsedProperties);
	}

	private replacePropertyRows(properties: CalloutProperty[]): void {
		for (const row of this.propertyRows) {
			row.suggest.close();
			row.element.remove();
		}
		this.propertyRows = [];
		for (const property of properties) {
			this.addPropertyRow(property, false);
		}
	}

	private openSaveTemplateModal(): void {
		new SaveCalloutTemplateModal(
			this.app,
			() => this.plugin.settings.calloutInsertTemplates.map((template) => template.name),
			async (name) => {
				const template = this.captureCurrentTemplate(name);
				this.plugin.settings.calloutInsertTemplates.push(template);
				try {
					await this.plugin.saveSettings();
				} catch (error) {
					this.plugin.settings.calloutInsertTemplates = this.plugin.settings.calloutInsertTemplates
						.filter((savedTemplate) => savedTemplate !== template);
					throw error;
				}
				this.refreshTemplateDropdown(name);
			},
		).open();
	}

	private async updateSelectedTemplate(): Promise<void> {
		if (this.isSavingTemplate || !this.selectedTemplateName) {
			return;
		}

		const templateIndex = this.plugin.settings.calloutInsertTemplates.findIndex(
			(template) => template.name === this.selectedTemplateName,
		);
		const currentTemplate = this.plugin.settings.calloutInsertTemplates[templateIndex];
		if (!currentTemplate) {
			return;
		}

		const updatedTemplate = this.captureCurrentTemplate(currentTemplate.name);
		this.plugin.settings.calloutInsertTemplates[templateIndex] = updatedTemplate;
		this.isSavingTemplate = true;
		if (this.overrideTemplateButton) {
			this.overrideTemplateButton.disabled = true;
		}
		try {
			await this.plugin.saveSettings();
			new Notice(`Template "${currentTemplate.name}" updated.`);
		} catch {
			this.plugin.settings.calloutInsertTemplates[templateIndex] = currentTemplate;
			new Notice('Could not update the template.');
		} finally {
			this.isSavingTemplate = false;
			if (this.overrideTemplateButton) {
				this.overrideTemplateButton.disabled = false;
			}
		}
	}

	private captureCurrentTemplate(name: string): CalloutInsertTemplate {
		return {
			name,
			calloutType: this.typeInputComponent?.getValue() ?? '',
			title: this.titleInput?.getValue() ?? '',
			content: this.contentInput?.getValue() ?? '',
			hasCheckbox: this.hasCheckbox,
			checkboxStartsChecked: this.checkboxStartsChecked,
			isCollapsible: this.isCollapsible,
			startsCollapsed: this.startsCollapsed,
			properties: this.propertyRows.map((row) => ({
				key: row.nameInput.value,
				value: row.valueInput.value,
			})),
		};
	}

	private async deleteSelectedTemplate(): Promise<void> {
		const templateIndex = this.plugin.settings.calloutInsertTemplates.findIndex(
			(template) => template.name === this.selectedTemplateName,
		);
		if (templateIndex === -1) {
			return;
		}

		const [deletedTemplate] = this.plugin.settings.calloutInsertTemplates.splice(templateIndex, 1);
		if (!deletedTemplate) {
			return;
		}
		this.refreshTemplateDropdown('');
		try {
			await this.plugin.saveSettings();
		} catch {
			this.plugin.settings.calloutInsertTemplates.splice(templateIndex, 0, deletedTemplate);
			this.refreshTemplateDropdown(deletedTemplate.name);
			new Notice('Could not delete the template.');
		}
	}

	private refreshTemplateDropdown(selectedName: string): void {
		const dropdown = this.templateDropdown;
		if (!dropdown) {
			return;
		}

		this.isRefreshingTemplateDropdown = true;
		try {
			dropdown.selectEl.replaceChildren();
			dropdown.addOption('', '');
			for (const template of this.plugin.settings.calloutInsertTemplates) {
				dropdown.addOption(template.name, template.name);
			}
			dropdown.setValue(selectedName);
			this.selectedTemplateName = selectedName;
			this.updateTemplateActions();
			this.deleteTemplateButton?.setDisabled(!selectedName);
		} finally {
			this.isRefreshingTemplateDropdown = false;
		}
	}

	private updateTemplateActions(): void {
		if (this.overrideTemplateButton) {
			this.overrideTemplateButton.hidden = !this.selectedTemplateName;
		}
	}

	private async insertCallout(): Promise<void> {
		if (this.isInserting) {
			return;
		}

		const calloutType = this.typeInputComponent?.getValue().trim() ?? '';
		if (!calloutType) {
			new Notice('Enter a callout type.');
			this.typeInput?.focus();
			return;
		}

		if (/[\r\n\]]/.test(calloutType)) {
			new Notice('Callout types cannot contain a closing bracket or a line break.');
			this.typeInput?.focus();
			return;
		}

		const title = this.titleInput?.getValue().trim() ?? '';
		const content = this.contentInput?.getValue().replace(/\r\n/g, '\n').replace(/\n+$/, '') ?? '';
		const properties: Array<{ key: string; value: string }> = [];
		const seenPropertyNames = new Set<string>();
		for (const row of this.propertyRows) {
			const key = row.nameInput.value.trim();
			const value = row.valueInput.value.trim();
			if (!key) {
				if (value) {
					new Notice('Enter a name for each property or remove the empty row.');
					row.nameInput.focus();
					return;
				}
				continue;
			}

			if (/[\s:]/.test(key)) {
				new Notice('Property names cannot contain spaces or colons.');
				row.nameInput.focus();
				return;
			}

			const normalizedKey = key.toLocaleLowerCase();
			if (seenPropertyNames.has(normalizedKey)) {
				new Notice(`Property "${key}" is listed more than once.`);
				row.nameInput.focus();
				return;
			}
			seenPropertyNames.add(normalizedKey);
			properties.push({ key, value });
		}
		const collapseMarker = this.isCollapsible
			? this.startsCollapsed ? '-' : '+'
			: '';
		const checkbox = this.hasCheckbox
			? ` [${this.checkboxStartsChecked ? 'x' : ' '}]`
			: '';
		const lines = [`> [!${calloutType}]${collapseMarker}${checkbox}${title ? ` ${title}` : ''}`];
		lines.push(...properties.map((property) => `> ${property.key}:: ${property.value}`));
		if (content) {
			lines.push(
				...content.split('\n').map((line) => (line ? `> ${line}` : '>')),
			);
		}

		this.isInserting = true;
		this.editor.replaceSelection(lines.join('\n'));
		this.plugin.settings.lastUsedCalloutType = calloutType;
		this.plugin.settings.lastUsedAddCheckbox = this.hasCheckbox;
		this.plugin.settings.lastUsedCheckboxChecked = this.checkboxStartsChecked;
		this.plugin.settings.lastUsedCalloutIsCollapsible = this.isCollapsible;
		this.plugin.settings.lastUsedCalloutStartsCollapsed = this.startsCollapsed;
		this.plugin.settings.lastUsedProperties = properties.map((property) => ({ ...property }));
		this.close();
		try {
			await this.plugin.saveSettings();
		} catch {
			new Notice('Callout inserted, but the selected options could not be saved.');
		}
	}

	private addPropertyRow(property?: CalloutProperty, focus = true): void {
		if (!this.propertiesContainer) {
			return;
		}

		const rowElement = this.propertiesContainer.createDiv({
			cls: 'callout-tracker-insert-property-row',
		});
		const nameInput = rowElement.createEl('input', {
			type: 'text',
			placeholder: 'Property name',
			cls: 'callout-tracker-insert-property-name',
			value: property?.key ?? '',
		});
		nameInput.setAttribute('aria-label', 'Property name');
		const valueInput = rowElement.createEl('input', {
			type: 'text',
			placeholder: 'Value',
			cls: 'callout-tracker-insert-property-value',
			value: property?.value ?? '',
		});
		valueInput.setAttribute('aria-label', 'Property value');
		const removeButton = rowElement.createEl('button', {
			text: 'Remove',
			cls: 'callout-tracker-insert-property-remove',
			attr: { type: 'button' },
		});
		let row: CalloutPropertyInputRow;
		row = {
			element: rowElement,
			nameInput,
			valueInput,
			suggest: new CalloutPropertySuggest(
				this.app,
				nameInput,
				() => this.plugin.propertyIndex.getPropertyNames(),
				() => this.propertyRows
					.filter((candidate) => candidate !== row)
					.map((candidate) => candidate.nameInput.value.trim()),
			),
		};
		this.propertyRows.push(row);
		removeButton.addEventListener('click', () => {
			row.suggest.close();
			this.propertyRows = this.propertyRows.filter((candidate) => candidate !== row);
			row.element.remove();
		});
		if (focus) {
			nameInput.focus();
		}
	}
}

function getConfiguredCalloutTypes(callouts: CustomCallout[]): string[] {
	const seenTypes = new Set<string>();
	return callouts
		.map((callout) => callout.name.trim())
		.filter((name) => {
			const normalized = name.toLocaleLowerCase();
			if (!name || seenTypes.has(normalized)) {
				return false;
			}

			seenTypes.add(normalized);
			return true;
		});
}
