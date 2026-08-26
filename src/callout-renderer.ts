import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	MarkdownRenderer,
	MarkdownView,
	Notice,
	setIcon,
} from 'obsidian';
import { applyCalloutStyle, findCalloutStyle, normalizeIconName } from './callout-styles';
import { findCallouts } from './callout-scanner';
import type CalloutTrackerPlugin from './main';
import type { CalloutEntry, CalloutTrackerBlockConfig, CustomCallout } from './types';

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
	};

	for (const rawLine of source.split('\n')) {
		const separator = rawLine.indexOf(':');
		if (separator < 0) {
			continue;
		}

		const key = rawLine
			.slice(0, separator)
			.trim()
			.toLowerCase()
			.replaceAll(' ', '');
		const value = rawLine.slice(separator + 1).trim();
		if (key === 'callouts') {
			config.calloutTypes = value
				.split(/[\s,]+/)
				.map((type) => type.trim().toLowerCase())
				.filter(Boolean);
		} else if (key === 'rootfolder') {
			config.rootFolder = value;
		} else if (key === 'search') {
			config.search = value;
		}
	}

	return config;
}

async function renderCalloutTracker(
	app: App,
	config: CalloutTrackerBlockConfig,
	ignoredPrefixes: string[],
	customCallouts: CustomCallout[],
	container: HTMLElement,
	context: MarkdownPostProcessorContext,
): Promise<void> {
	container.empty();
	container.addClass('callout-tracker');

	try {
		const entries = await findCallouts(
			app,
			config.rootFolder,
			config.calloutTypes,
			ignoredPrefixes,
		);
		const matchingEntries = filterEntries(entries, config.search);
		if (matchingEntries.length === 0) {
			container.createEl('p', {
				text: 'No matching callouts found.',
				cls: 'callout-tracker__empty',
			});
			return;
		}

		for (const calloutType of config.calloutTypes) {
			const typeEntries = matchingEntries.filter((entry) => entry.type === calloutType);
			if (typeEntries.length === 0) {
				continue;
			}

			container.createEl('h2', {
				text: calloutType.slice(0, 1).toUpperCase() + calloutType.slice(1),
				cls: 'callout-tracker__heading',
			});
			for (const entry of typeEntries) {
				renderEntry(app, entry, customCallouts, container, context);
			}
		}
	} catch (error) {
			console.error('Callout Tracker failed to scan the vault.', error);
			container.createEl('p', {
				text: 'Callout tracker could not scan the vault.',
				cls: 'callout-tracker__error',
			});
			new Notice('Callout tracker could not scan the vault.');
	}
}

function filterEntries(entries: CalloutEntry[], search: string): CalloutEntry[] {
	const query = search.trim().toLowerCase();
	if (!query) {
		return entries;
	}

	return entries.filter((entry) =>
		`${entry.title}\n${entry.body}`.toLowerCase().includes(query),
	);
}

function renderEntry(
	app: App,
	entry: CalloutEntry,
	customCallouts: CustomCallout[],
	container: HTMLElement,
	context: MarkdownPostProcessorContext,
): void {
	const item = container.createDiv({ cls: 'callout callout-tracker__entry' });
	item.setAttr('data-callout', entry.type);
	item.setAttr('role', 'button');
	item.setAttr('tabindex', '0');

	const open = (): void => {
		void openCallout(app, entry, context.sourcePath);
	};

	const titleEl = item.createDiv({ cls: 'callout-title' });
	const iconEl = titleEl.createDiv({ cls: 'callout-icon' });
	const titleInnerEl = titleEl.createDiv({ cls: 'callout-title-inner' });
	titleInnerEl.createSpan({
		text: entry.title || capitalize(entry.type),
	});

	const sourceLink = titleEl.createEl('a', {
		text: `${entry.fileName} · line ${entry.startLine + 1}`,
		cls: 'callout-tracker__source',
	});
	sourceLink.href = '#';
	sourceLink.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		open();
	});
	item.addEventListener('click', open);
	item.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			open();
		}
	});

	const contentEl = item.createDiv({ cls: 'callout-content' });
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
