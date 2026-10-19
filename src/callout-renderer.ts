import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	MarkdownRenderer,
	MarkdownView,
	Notice,
	setIcon,
} from 'obsidian';
import { applyCalloutCheckboxColor, updateSourceCheckbox } from './callout-checkbox';
import { renderCalloutProperties } from './callout-properties';
import { applyCalloutStyle, findCalloutStyle, normalizeIconName } from './callout-styles';
import { findCallouts } from './callout-scanner';
import { groupCallouts, GroupByError, parseGroupBy } from './group-by';
import { compareCalloutsByOrder, OrderByError, parseOrderBy } from './order-by';
import { createPropertyFilter, createPropertyFilterMap, PropertyFilterError } from './property-filter';
import { evaluateSummary, SummaryExpressionError } from './summary-evaluator';
import type CalloutTrackerPlugin from './main';
import type {
	CalloutEntry,
	CalloutTrackerCollapseMode,
	CalloutTrackerBlockConfig,
	CalloutTrackerDisplayMode,
	CustomCallout,
} from './types';

const DEFAULT_CALLOUT_TYPES = ['idea', 'note', 'todo'];

export function registerCalloutTrackerProcessor(plugin: CalloutTrackerPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		'callout-tracker',
		async (source, container, context) => {
			await renderCalloutTracker(
				plugin.app,
				parseBlockConfig(source, plugin.settings.rootFolder),
				plugin.settings.ignoredPrefixes,
				plugin.settings.customCallouts,
				plugin.settings.keepPropertiesVisibleWhenCollapsed,
				container,
				context,
			);
		},
	);
}

function parseBlockConfig(
	source: string,
	defaultRootFolder: string,
): CalloutTrackerBlockConfig {
	const config: CalloutTrackerBlockConfig = {
		calloutTypes: [...DEFAULT_CALLOUT_TYPES],
		rootFolder: defaultRootFolder,
		search: '',
		filter: '',
		namedFilters: {},
		summaries: [],
		groupBy: '',
		orderBy: '',
		display: 'all',
		collapse: 'default',
	};

	for (const rawLine of source.split('\n')) {
		const separator = rawLine.indexOf(':');
		if (separator < 0) {
			continue;
		}

		const rawKey = rawLine.slice(0, separator).trim();
		const key = rawKey.toLowerCase().replaceAll(' ', '');
		const value = rawLine.slice(separator + 1).trim();
		const namedFilter = rawKey.match(/^filter\s+([A-Za-z][A-Za-z0-9_-]*)$/i);
		if (key === 'callouts') {
			config.calloutTypes = value
				.split(/[\s,]+/)
				.map((type) => type.trim().toLowerCase())
				.filter(Boolean);
		} else if (key === 'rootfolder') {
			config.rootFolder = value;
		} else if (key === 'search') {
			config.search = value;
		} else if (key === 'filter') {
			config.filter = value;
		} else if (namedFilter?.[1]) {
			config.namedFilters[namedFilter[1].toLowerCase()] = value;
		} else if (key === 'summary') {
			if (value) {
				config.summaries.push(value);
			}
		} else if (key === 'groupby') {
			config.groupBy = value;
		} else if (key === 'orderby') {
			config.orderBy = value;
		} else if (key === 'display') {
			config.display = parseDisplayMode(value);
		} else if (key === 'collapse') {
			config.collapse = parseCollapseMode(value);
		}
	}

	return config;
}

async function renderCalloutTracker(
	app: App,
	config: CalloutTrackerBlockConfig,
	ignoredPrefixes: string[],
	customCallouts: CustomCallout[],
	keepPropertiesVisibleWhenCollapsed: boolean,
	container: HTMLElement,
	context: MarkdownPostProcessorContext,
): Promise<void> {
	container.empty();
	container.addClass('callout-tracker');

	try {
		const groupBy = parseGroupBy(config.groupBy);
		const orderBy = parseOrderBy(config.orderBy);
		const entries = await findCallouts(
			app,
			config.rootFolder,
			config.calloutTypes,
			ignoredPrefixes,
		);
		const filterPredicate = createPropertyFilter(config.filter);
		const matchingEntries = filterEntries(entries, config.search, filterPredicate);
		const namedFilters = createPropertyFilterMap(config.namedFilters);
		if (config.display !== 'onlyCallouts') {
			for (const summary of config.summaries) {
				container.createDiv({
					cls: 'callout-tracker__summary',
					text: evaluateSummary(summary, matchingEntries, namedFilters),
				});
			}
		}
		if (config.display === 'onlySummary') {
			if (config.summaries.length === 0) {
				container.createEl('p', {
					text: 'No summaries configured.',
					cls: 'callout-tracker__empty',
				});
			}
			return;
		}
		if (matchingEntries.length === 0) {
			container.createEl('p', {
				text: 'No matching callouts found.',
				cls: 'callout-tracker__empty',
			});
			return;
		}

		if (groupBy) {
			for (const group of groupCallouts(matchingEntries, groupBy)) {
				const groupContainer = container.createEl('details', {
					cls: 'callout-tracker__group',
				});
				groupContainer.open = true;
				groupContainer.createEl('summary', {
					cls: 'callout-tracker__group-title',
					text: group.label,
				});
				const groupContent = groupContainer.createDiv({ cls: 'callout-tracker__group-content' });
				for (const entry of sortGroupEntries(group.entries, config.calloutTypes, orderBy)) {
					renderEntry(
						app,
						entry,
						config.collapse,
						customCallouts,
						keepPropertiesVisibleWhenCollapsed,
						groupContent,
						context,
					);
				}
			}
		} else {
			for (const calloutType of config.calloutTypes) {
				const typeEntries = matchingEntries
					.filter((entry) => entry.type === calloutType)
					.sort((first, second) => orderBy
						? compareCalloutsByOrder(first, second, orderBy)
						: getCheckboxOrder(first.checked) - getCheckboxOrder(second.checked));
				for (const entry of typeEntries) {
					renderEntry(
						app,
						entry,
						config.collapse,
						customCallouts,
						keepPropertiesVisibleWhenCollapsed,
						container,
						context,
					);
				}
			}
		}
	} catch (error) {
		const message = error instanceof GroupByError
			? `Invalid groupBy: ${error.message}`
			: error instanceof OrderByError
			? `Invalid orderBy: ${error.message}`
			: error instanceof PropertyFilterError
			? `Invalid filter: ${error.message}`
			: error instanceof SummaryExpressionError
				? `Invalid summary: ${error.message}`
				: 'Callout tracker could not scan the vault.';
		console.error('Callout Tracker failed to scan the vault.', error);
		container.createEl('p', {
			text: message,
			cls: 'callout-tracker__error',
		});
		new Notice(message);
	}
}

function sortGroupEntries(
	entries: CalloutEntry[],
	calloutTypes: string[],
	orderBy: ReturnType<typeof parseOrderBy>,
): CalloutEntry[] {
	const typeOrder = new Map(calloutTypes.map((type, index) => [type, index]));
	return [...entries].sort((first, second) => {
		if (orderBy) {
			const orderResult = compareCalloutsByOrder(first, second, orderBy);
			if (orderResult !== 0) {
				return orderResult;
			}
		}

		const typeResult = (typeOrder.get(first.type) ?? Number.MAX_SAFE_INTEGER) -
			(typeOrder.get(second.type) ?? Number.MAX_SAFE_INTEGER);
		return typeResult || getCheckboxOrder(first.checked) - getCheckboxOrder(second.checked);
	});
}

function parseDisplayMode(value: string): CalloutTrackerDisplayMode {
	const normalized = value.toLowerCase().replace(/[\s_-]/g, '');
	if (normalized === 'onlysummary' || normalized === 'onlysummery') {
		return 'onlySummary';
	}
	if (normalized === 'onlycallouts') {
		return 'onlyCallouts';
	}
	return 'all';
}

function parseCollapseMode(value: string): CalloutTrackerCollapseMode {
	const normalized = value.trim().toLowerCase();
	if (normalized === 'collapsed' || normalized === 'expanded') {
		return normalized;
	}
	return 'default';
}

function getCheckboxOrder(checked: boolean | undefined): number {
	if (checked === undefined) {
		return 0;
	}
	return checked ? 2 : 1;
}

function filterEntries(
	entries: CalloutEntry[],
	search: string,
	filterPredicate: ReturnType<typeof createPropertyFilter>,
): CalloutEntry[] {
	const query = search.trim().toLowerCase();
	return entries.filter((entry) =>
		(!query || getSearchableText(entry).includes(query)) &&
		(!filterPredicate || filterPredicate(entry.properties, entry.checked)),
	);
}

function getSearchableText(entry: CalloutEntry): string {
	const properties = entry.properties
		.map((property) => `${property.key}: ${property.value}`)
		.join('\n');
	return `${entry.title}\n${properties}\n${entry.body}`.toLowerCase();
}

function renderEntry(
	app: App,
	entry: CalloutEntry,
	collapseMode: CalloutTrackerCollapseMode,
	customCallouts: CustomCallout[],
	keepPropertiesVisibleWhenCollapsed: boolean,
	container: HTMLElement,
	context: MarkdownPostProcessorContext,
): void {
	const item = container.createDiv({ cls: 'callout callout-tracker__entry' });
	item.setAttr('data-callout', entry.type);
	const collapseState = collapseMode === 'default' ? entry.collapseState : collapseMode;
	const isCollapsible = collapseState !== undefined;
	if (isCollapsible) {
		item.addClass('callout-tracker__entry--collapsible');
	} else {
		item.setAttr('role', 'button');
		item.setAttr('tabindex', '0');
	}

	const open = (): void => {
		void openCallout(app, entry, context.sourcePath);
	};

	const titleEl = item.createDiv({ cls: 'callout-title' });
	if (isCollapsible) {
		titleEl.setAttr('role', 'button');
		titleEl.setAttr('tabindex', '0');
		titleEl.setAttr('aria-expanded', String(collapseState === 'expanded'));
		titleEl.addClass('callout-tracker__collapsible-title');
		const collapseIconEl = titleEl.createDiv({ cls: 'callout-tracker__collapse-icon' });
		setIcon(collapseIconEl, 'chevron-right');
		item.classList.toggle('callout-tracker__entry--expanded', collapseState === 'expanded');
	}
	const iconEl = titleEl.createDiv({ cls: 'callout-icon' });
	titleEl.classList.toggle('callout-tracker__title--checked', entry.checked === true);
	let checkbox: HTMLInputElement | null = null;
	if (entry.checked !== undefined && entry.startLine !== undefined) {
		const calloutCheckbox = titleEl.createEl('input', {
			cls: 'callout-tracker__checkbox',
			type: 'checkbox',
			attr: {
				'aria-label': entry.checked ? 'Mark callout as incomplete' : 'Mark callout as complete',
			},
		});
		checkbox = calloutCheckbox;
		calloutCheckbox.checked = entry.checked;
		calloutCheckbox.addEventListener('click', (event) => {
			event.stopPropagation();
			titleEl.classList.toggle('callout-tracker__title--checked', calloutCheckbox.checked);
			void updateSourceCheckbox(
				app,
				entry.filePath,
				entry.startLine,
				calloutCheckbox,
				calloutCheckbox.checked,
				entry.title,
			).then((updated) => {
				if (!updated) {
					titleEl.classList.toggle('callout-tracker__title--checked', !calloutCheckbox.checked);
				}
			});
		});
		calloutCheckbox.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.stopPropagation();
			}
		});
	}
	const titleInnerEl = titleEl.createDiv({ cls: 'callout-title-inner' });
	titleInnerEl.createSpan({
		text: entry.title || capitalize(entry.type),
	});

	const sourceLink = titleEl.createEl('a', {
		text:
			entry.startLine === undefined
				? entry.fileName
				: `${entry.fileName} · line ${entry.startLine + 1}`,
		cls: 'callout-tracker__source',
	});
	sourceLink.href = '#';
	sourceLink.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		open();
	});
	item.addEventListener('click', open);
	if (keepPropertiesVisibleWhenCollapsed && entry.properties.length > 0) {
		renderCalloutProperties(item, entry.properties);
	}
	const contentEl = item.createDiv({ cls: 'callout-content' });
	contentEl.hidden = collapseState === 'collapsed';
	if (isCollapsible) {
		const toggleCollapse = (): void => {
			const isExpanded = titleEl.getAttribute('aria-expanded') === 'true';
			const nextExpanded = !isExpanded;
			titleEl.setAttr('aria-expanded', String(nextExpanded));
			contentEl.hidden = !nextExpanded;
			item.classList.toggle('callout-tracker__entry--expanded', nextExpanded);
		};
		titleEl.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			toggleCollapse();
		});
		titleEl.addEventListener('keydown', (event) => {
			if (
				event.target instanceof HTMLElement &&
				event.target !== titleEl &&
				event.target.closest('a, input, button')
			) {
				return;
			}
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				event.stopPropagation();
				toggleCollapse();
			}
		});
	} else {
		item.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				open();
			}
		});
	}
	if (!keepPropertiesVisibleWhenCollapsed && entry.properties.length > 0) {
		renderCalloutProperties(contentEl, entry.properties);
	}

	if (entry.body) {
		const bodyEl = contentEl.createDiv({ cls: 'callout-tracker__body' });
		const child = new MarkdownRenderChild(bodyEl);
		context.addChild(child);
		void MarkdownRenderer.render(app, entry.body, bodyEl, entry.filePath, child);
	}

	const callout = findCalloutStyle(customCallouts, entry.type);
	if (callout) {
		applyCalloutStyle(item, callout);
		if (callout.hasIcon && callout.iconName.trim()) {
			setIcon(iconEl, normalizeIconName(callout.iconName));
		}
	}
	if (checkbox) {
		applyCalloutCheckboxColor(checkbox, item);
	}
}

function capitalize(value: string): string {
	return value.slice(0, 1).toUpperCase() + value.slice(1);
}

async function openCallout(
	app: App,
	entry: CalloutEntry,
	sourcePath: string,
): Promise<void> {
	await app.workspace.openLinkText(entry.filePath, sourcePath, false);
	if (entry.startLine === undefined) {
		return;
	}

	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view || view.file?.path !== entry.filePath) {
		return;
	}

	view.editor.setCursor({ line: entry.startLine, ch: 0 });
	view.editor.scrollIntoView(
		{
			from: { line: entry.startLine, ch: 0 },
			to: { line: entry.startLine, ch: 0 },
		},
		true,
	);
}
