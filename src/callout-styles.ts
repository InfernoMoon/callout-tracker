import { MarkdownView } from 'obsidian';
import type { App } from 'obsidian';
import { parseCalloutProperties, renderCalloutProperties } from './callout-properties';
import type { CustomCallout } from './types';

export class CalloutStyleManager {
	private callouts: CustomCallout[] = [];
	private keepPropertiesVisibleWhenCollapsed = false;

	constructor(private readonly app: App) {}

	update(callouts: CustomCallout[], keepPropertiesVisibleWhenCollapsed = false): void {
		this.callouts = callouts;
		this.keepPropertiesVisibleWhenCollapsed = keepPropertiesVisibleWhenCollapsed;
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
			if (!element.closest('.callout-tracker')) {
				applyCalloutProperties(element, this.keepPropertiesVisibleWhenCollapsed);
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
	const fontColorDark = normalizeHexColor(callout.fontColorDark, '');
	const fontColorLight = normalizeHexColor(callout.fontColorLight, fontColorDark);
	const backgroundColorDark = normalizeHexColor(callout.backgroundColorDark, '');
	const backgroundColorLight = normalizeHexColor(callout.backgroundColorLight, backgroundColorDark);
	const borderColor = normalizeHexColor(callout.borderColor, fontColorDark);
	const borderWidth = normalizeBorderWidth(callout.borderWidth);
	const borderStyle = normalizeBorderStyle(callout.borderStyle);
	element.addClass('callout-tracker--custom-styled');

	if (fontColorDark) {
		setColorVariants(element, 'font', fontColorDark, fontColorLight);
		setDynamicCssProp(element, 'color', 'var(--callout-tracker-active-font-color)');
		for (const child of element.findAll('.callout-title, .callout-content, .callout-properties')) {
			setDynamicCssProp(child, 'color', 'var(--callout-tracker-active-font-color)');
		}
	}
	if (backgroundColorDark) {
		setColorVariants(element, 'background', backgroundColorDark, backgroundColorLight);
		setDynamicCssProp(element, 'background-color', 'var(--callout-tracker-active-background-color)');
	}
	if (fontColorDark) {
		setDynamicCssProp(element, '--callout-color', 'var(--callout-tracker-active-callout-color)');
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

function setColorVariants(element: HTMLElement, name: string, darkColor: string, lightColor: string): void {
	setDynamicCssProp(element, `--callout-tracker-${name}-color-dark`, darkColor);
	setDynamicCssProp(element, `--callout-tracker-${name}-color-light`, lightColor);
	if (name === 'font') {
		setDynamicCssProp(element, '--callout-tracker-callout-color-dark', hexToRgb(darkColor));
		setDynamicCssProp(element, '--callout-tracker-callout-color-light', hexToRgb(lightColor));
	}
}

function hexToChannels(hex: string): [number, number, number] {
	const value = hex.slice(1);
	return [
		Number.parseInt(value.slice(0, 2), 16),
		Number.parseInt(value.slice(2, 4), 16),
		Number.parseInt(value.slice(4, 6), 16),
	];
}

function applyCalloutProperties(
	element: HTMLElement,
	keepPropertiesVisibleWhenCollapsed: boolean,
): void {
	const content = element.querySelector<HTMLElement>(':scope > .callout-content');
	const firstChild = content?.firstElementChild;
	if (
		!content ||
		!firstChild ||
		element.querySelector(':scope > .callout-properties') ||
		firstChild.classList.contains('callout-properties')
	) {
		return;
	}

	const propertyBlock = parseCalloutProperties(
		(firstChild as HTMLElement).innerText ?? firstChild.textContent ?? '',
	);
	if (!propertyBlock) {
		return;
	}

	const propertyParent = keepPropertiesVisibleWhenCollapsed ? element : content;
	const propertyContainer = renderCalloutProperties(propertyParent, propertyBlock.properties);
	propertyParent.insertBefore(propertyContainer, keepPropertiesVisibleWhenCollapsed ? content : firstChild);
	if (propertyBlock.remainingLines.length > 0) {
		const tagName = firstChild.tagName.toLowerCase() as keyof HTMLElementTagNameMap;
		const remainingContent = content.createEl(tagName);
		remainingContent.textContent = propertyBlock.remainingLines.join('\n');
		content.insertBefore(remainingContent, firstChild);
	}
	firstChild.remove();
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
	return hexToChannels(hex).join(', ');
}
