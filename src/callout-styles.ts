import { MarkdownView } from 'obsidian';
import type { App } from 'obsidian';
import type { CustomCallout } from './types';

export class CalloutStyleManager {
	private callouts: CustomCallout[] = [];

	constructor(private readonly app: App) {}

	update(callouts: CustomCallout[]): void {
		this.callouts = callouts;
		this.rerenderOpenNotes();
	}

	applyToElement(container: HTMLElement): void {
		const elements = container.findAll('.callout[data-callout]');
		for (const element of elements) {
			const callout = findCalloutStyle(
				this.callouts,
				element.getAttr('data-callout') ?? '',
			);
			if (callout) {
				applyCalloutStyle(element, callout);
			}
		}
	}

	private rerenderOpenNotes(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				leaf.view.previewMode.rerender(true);
			}
		});
	}
}

export function findCalloutStyle(
	callouts: CustomCallout[],
	name: string,
): CustomCallout | undefined {
	const normalizedName = normalizeName(name);
	return callouts.find((candidate) => normalizeName(candidate.name) === normalizedName);
}

export function applyCalloutStyle(element: HTMLElement, callout: CustomCallout): void {
	const fontColor = normalizeHexColor(callout.fontColor, '');
	const backgroundColor = normalizeHexColor(callout.backgroundColor, '');
	const borderColor = normalizeHexColor(callout.borderColor, fontColor);
	const borderWidth = normalizeBorderWidth(callout.borderWidth);
	const borderStyle = normalizeBorderStyle(callout.borderStyle);

	if (fontColor) {
		setDynamicCssProp(element, 'color', fontColor);
		for (const child of element.findAll('.callout-title, .callout-content')) {
			setDynamicCssProp(child, 'color', fontColor);
		}
	}
	if (backgroundColor) {
		setDynamicCssProp(element, 'background-color', backgroundColor);
	}
	if (fontColor) {
		setDynamicCssProp(element, '--callout-color', hexToRgb(fontColor));
	}
	if (callout.hasBorder && borderColor) {
		setDynamicCssProp(
			element,
			'border-left',
			`${borderWidth} ${borderStyle} ${borderColor}`,
		);
	} else if (!callout.hasBorder) {
		setDynamicCssProp(element, 'border-left', 'none');
	}

	const iconElement = element.find('.callout-icon');
	if (iconElement) {
		setDynamicCssProp(iconElement, 'display', callout.hasIcon ? '' : 'none');
	}
	if (callout.hasIcon && callout.iconName.trim()) {
		setDynamicCssProp(element, '--callout-icon', normalizeIconName(callout.iconName));
	} else {
		setDynamicCssProp(element, '--callout-icon', '');
	}
}

function setDynamicCssProp(element: HTMLElement, property: string, value: string): void {
	element.setCssProps({ [property]: value });
}

function normalizeName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9_-]/g, '-');
}

export function normalizeIconName(value: string): string {
	const icon = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
	return icon.startsWith('lucide-') ? icon : `lucide-${icon}`;
}

function normalizeHexColor(value: string, fallback: string): string {
	return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

function normalizeBorderWidth(value: string | undefined): string {
	return value && /^(?:0|[1-9]\d*)(?:\.\d+)?px$/.test(value.trim())
		? value.trim()
		: '4px';
}

function normalizeBorderStyle(value: string | undefined): string {
	return value && /^(?:solid|dashed|dotted|double)$/.test(value.trim())
		? value.trim()
		: 'solid';
}

function hexToRgb(hex: string): string {
	const value = hex.slice(1);
	const red = Number.parseInt(value.slice(0, 2), 16);
	const green = Number.parseInt(value.slice(2, 4), 16);
	const blue = Number.parseInt(value.slice(4, 6), 16);
	return `${red}, ${green}, ${blue}`;
}
