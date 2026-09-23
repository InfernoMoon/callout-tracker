import { App, MarkdownPostProcessorContext, TFile } from 'obsidian';
import type CalloutTrackerPlugin from './main';

const TITLE_CHECKBOX_PATTERN = /^\s*\[([ xX])\](?:\s*(.*))?$/;
const SOURCE_HEADER_PATTERN = /^(\s*>\s*\[![^\]\s]+\]\s*)\[([ xX])\]/;

export function applyCalloutCheckboxColor(checkbox: HTMLInputElement, callout: HTMLElement): void {
	const calloutColor = getComputedStyle(callout).getPropertyValue('--callout-color').trim();
	const color = calloutColor
		? /^\d+(?:\s*,\s*\d+){2}(?:\s*,\s*[\d.]+)?$/.test(calloutColor)
			? `rgb(${calloutColor})`
			: calloutColor
		: getAccentColor();
	checkbox.style.setProperty('--callout-tracker-checkbox-color', color || '#7f6df2');
}

export function registerCalloutCheckboxPostProcessor(plugin: CalloutTrackerPlugin): void {
	plugin.registerMarkdownPostProcessor((element, context) => {
		renderSourceCalloutCheckboxes(plugin.app, element, context);
	});
}

function renderSourceCalloutCheckboxes(
	app: App,
	element: HTMLElement,
	context: MarkdownPostProcessorContext,
): void {
	for (const titleEl of element.findAll('.callout-title')) {
		if (titleEl.closest('.callout-tracker') || titleEl.querySelector('.callout-tracker__checkbox')) {
			continue;
		}

		const titleInnerEl = titleEl.querySelector<HTMLElement>('.callout-title-inner');
		if (!titleInnerEl) {
			continue;
		}

		const titleMatch = titleInnerEl.textContent?.match(TITLE_CHECKBOX_PATTERN);
		if (!titleMatch) {
			continue;
		}

		const sectionInfo = context.getSectionInfo(titleInnerEl) ?? context.getSectionInfo(titleEl);

		const checked = titleMatch[1]?.toLowerCase() === 'x';
		const title = titleMatch[2] ?? '';
		titleEl.classList.toggle('callout-tracker__title--checked', checked);
		const checkbox = titleEl.createEl('input', {
			cls: 'callout-tracker__checkbox',
			type: 'checkbox',
			attr: {
				'aria-label': checked ? 'Mark callout as incomplete' : 'Mark callout as complete',
			},
		});
		checkbox.checked = checked;
		applyCalloutCheckboxColor(checkbox, titleEl.closest<HTMLElement>('.callout') ?? titleEl);
		titleEl.insertBefore(checkbox, titleInnerEl);
		titleInnerEl.textContent = title;

		checkbox.addEventListener('click', (event) => {
			event.stopPropagation();
			titleEl.classList.toggle('callout-tracker__title--checked', checkbox.checked);
			void updateSourceCheckbox(
				app,
				context.sourcePath,
				sectionInfo?.lineStart,
				checkbox,
				checkbox.checked,
				title,
			).then((updated) => {
				if (!updated) {
					titleEl.classList.toggle('callout-tracker__title--checked', !checkbox.checked);
				}
			});
		});
		checkbox.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.stopPropagation();
			}
		});
	}
}

function getAccentColor(): string {
	return (
		getComputedStyle(document.body).getPropertyValue('--interactive-accent').trim() ||
		getComputedStyle(document.documentElement).getPropertyValue('--interactive-accent').trim() ||
		'#7f6df2'
	);
}

export async function updateSourceCheckbox(
	app: App,
	filePath: string,
	lineNumber: number | undefined,
	checkbox: HTMLInputElement,
	checked: boolean,
	title: string,
	): Promise<boolean> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) {
		checkbox.checked = !checked;
		return false;
	}

	try {
		let updated = false;
		await app.vault.process(file, (content) => {
			const newline = content.includes('\r\n') ? '\r\n' : '\n';
			const lines = content.split(/\r\n|\n|\r/);
			const candidateLine = lineNumber === undefined ? undefined : lines[lineNumber];
			const targetLine = candidateLine && getSourceTitle(candidateLine) === title
				? lineNumber
				: lines.findIndex((value) => getSourceTitle(value) === title);
			const resolvedLine = targetLine ?? -1;
			const line = resolvedLine < 0 ? undefined : lines[resolvedLine];
			if (line === undefined) {
				return content;
			}

			const header = line.match(SOURCE_HEADER_PATTERN);
			if (!header) {
				return content;
			}

			updated = true;
			lines[resolvedLine] = `${header[1]}[${checked ? 'x' : ' '}]${line.slice(header[0].length)}`;
			return lines.join(newline);
		});
		if (!updated) {
			checkbox.checked = !checked;
		}
		return updated;
	} catch (error) {
		checkbox.checked = !checked;
		console.error('Callout Tracker could not update the callout checkbox.', error);
		return false;
	}
}

function getSourceTitle(line: string): string | null {
	const header = line.match(SOURCE_HEADER_PATTERN);
	return header ? line.slice(header[0].length).trim() : null;
}
