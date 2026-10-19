import { Modal, Notice, Setting } from 'obsidian';
import type { App, ButtonComponent, TextComponent } from 'obsidian';

export class SaveCalloutTemplateModal extends Modal {
	private nameInput: TextComponent | null = null;
	private saveButton: ButtonComponent | null = null;
	private isSaving = false;

	constructor(
		app: App,
		private readonly getExistingNames: () => string[],
		private readonly onSave: (name: string) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Save as template');
		this.contentEl.empty();
		const nameSetting = new Setting(this.contentEl).setName('Template name');
		nameSetting.addText((text) => {
			this.nameInput = text;
			text.setPlaceholder('Enter a name');
			text.inputEl.addEventListener('keydown', this.handleInputKeydown);
		});

		new Setting(this.contentEl)
			.addButton((button) => {
				this.saveButton = button;
				button.setButtonText('Save').setCta().onClick(() => void this.saveTemplate());
			})
			.addButton((button) => {
				button.setButtonText('Cancel').onClick(() => this.close());
			});

		this.nameInput?.inputEl.focus();
	}

	onClose(): void {
		this.nameInput?.inputEl.removeEventListener('keydown', this.handleInputKeydown);
		this.nameInput = null;
		this.saveButton = null;
		this.contentEl.empty();
	}

	private readonly handleInputKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter') {
			event.preventDefault();
			void this.saveTemplate();
		}
	};

	private async saveTemplate(): Promise<void> {
		if (this.isSaving) {
			return;
		}

		const name = this.nameInput?.getValue().trim() ?? '';
		if (!name) {
			new Notice('Enter a template name.');
			this.nameInput?.inputEl.focus();
			return;
		}

		if (this.getExistingNames().some((existingName) => existingName.toLocaleLowerCase() === name.toLocaleLowerCase())) {
			new Notice('A template with that name already exists.');
			this.nameInput?.inputEl.focus();
			return;
		}

		this.isSaving = true;
		this.saveButton?.setDisabled(true);
		try {
			await this.onSave(name);
			this.close();
		} catch {
			new Notice('Could not save the template.');
			this.isSaving = false;
			this.saveButton?.setDisabled(false);
		}
	}
}
