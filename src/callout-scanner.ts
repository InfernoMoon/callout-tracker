import type { App, TFile } from 'obsidian';
import { parseCalloutProperties } from './callout-properties';
import type { CalloutEntry } from './types';

interface ParsedCalloutHeader {
	type: string;
	title: string;
}

export async function findCallouts(
	app: App,
	rootFolder: string,
	calloutTypes: string[],
	ignoredPrefixes: string[],
): Promise<CalloutEntry[]> {
	const wantedTypes = new Set(calloutTypes.map((type) => type.toLowerCase()));
	return findCalloutsInVault(app, rootFolder, ignoredPrefixes, wantedTypes);
}

export async function findAllCallouts(
	app: App,
	ignoredPrefixes: string[],
): Promise<CalloutEntry[]> {
	return findCalloutsInVault(app, '', ignoredPrefixes, null);
}

async function findCalloutsInVault(
	app: App,
	rootFolder: string,
	ignoredPrefixes: string[],
	wantedTypes: Set<string> | null,
): Promise<CalloutEntry[]> {
	const normalizedRoot = normalizeRootFolder(rootFolder);
	const files = app.vault
		.getFiles()
		.filter(
			(file) =>
				isSupportedFile(file) &&
				isInRootFolder(file, normalizedRoot) &&
				!startsWithPrefix(file.basename, ignoredPrefixes) &&
				!hasIgnoredFolder(file, ignoredPrefixes),
		);

	const entries: CalloutEntry[] = [];
	for (const file of files) {
		const content = await app.vault.cachedRead(file);
		if (file.extension.toLowerCase() === 'canvas') {
			entries.push(...scanCanvasCallouts(file, content, wantedTypes));
		} else {
			entries.push(...scanTextCallouts(file, content, wantedTypes, true));
		}
	}

	return entries;
}

function isSupportedFile(file: TFile): boolean {
	const extension = file.extension.toLowerCase();
	return extension === 'md' || extension === 'canvas';
}

function scanTextCallouts(
	file: TFile,
	content: string,
	wantedTypes: Set<string> | null,
	includeLineNumbers: boolean,
): CalloutEntry[] {
	const lines = content.replace(/\r\n?/g, '\n').split('\n');
	const entries: CalloutEntry[] = [];

	for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
		const header = parseCalloutHeader(lines[lineNumber] ?? '');
		if (!header || (wantedTypes !== null && !wantedTypes.has(header.type))) {
			continue;
		}

		const bodyLines: string[] = [];
		let nextLine = lineNumber + 1;
		while (nextLine < lines.length && isQuoteLine(lines[nextLine] ?? '')) {
			bodyLines.push(stripQuoteMarker(lines[nextLine] ?? ''));
			nextLine++;
		}

		const rawBody = bodyLines.join('\n').trim();
		const propertyBlock = parseCalloutProperties(rawBody);
		entries.push({
			fileName: file.basename,
			filePath: file.path,
			...(includeLineNumbers ? { startLine: lineNumber } : {}),
			title: header.title,
			body: propertyBlock
				? propertyBlock.remainingLines.join('\n').trim()
				: rawBody,
			properties: propertyBlock?.properties ?? [],
			type: header.type,
		});

		lineNumber = nextLine - 1;
	}

	return entries;
}

function scanCanvasCallouts(
	file: TFile,
	content: string,
	wantedTypes: Set<string> | null,
): CalloutEntry[] {
	let canvas: unknown;
	try {
		canvas = JSON.parse(content);
	} catch (error) {
		console.warn(`Callout Tracker could not parse canvas file: ${file.path}`, error);
		return [];
	}

	if (!isRecord(canvas) || !Array.isArray(canvas.nodes)) {
		return [];
	}

	const entries: CalloutEntry[] = [];
	for (const node of canvas.nodes) {
		if (!isRecord(node) || node.type !== 'text' || typeof node.text !== 'string') {
			continue;
		}

		entries.push(...scanTextCallouts(file, node.text, wantedTypes, false));
	}

	return entries;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isInRootFolder(file: TFile, rootFolder: string): boolean {
	return (
		rootFolder.length === 0 ||
		file.path === rootFolder ||
		file.path.startsWith(`${rootFolder}/`)
	);
}

function startsWithPrefix(value: string, prefixes: string[]): boolean {
	return prefixes.some((prefix) => prefix.length > 0 && value.startsWith(prefix));
}

function hasIgnoredFolder(file: TFile, prefixes: string[]): boolean {
	const folderNames = file.path.split('/').slice(0, -1);
	return folderNames.some((folderName) => startsWithPrefix(folderName, prefixes));
}

function normalizeRootFolder(rootFolder: string): string {
	return rootFolder.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
}

function parseCalloutHeader(line: string): ParsedCalloutHeader | null {
	const afterMarker = line.trimStart();
	if (!afterMarker.startsWith('>')) {
		return null;
	}

	const calloutText = afterMarker.slice(1).trimStart();
	if (!calloutText.startsWith('[!')) {
		return null;
	}

	const closingBracket = calloutText.indexOf(']');
	if (closingBracket < 3) {
		return null;
	}

	const type = calloutText.slice(2, closingBracket).trim().toLowerCase();
	if (!type || /\s/.test(type)) {
		return null;
	}

	const afterType = calloutText.slice(closingBracket + 1);
	if (afterType.length > 0 && !/^\s/.test(afterType)) {
		return null;
	}

	return {
		type,
		title: afterType.trim(),
	};
}

function isQuoteLine(line: string): boolean {
	return line.trimStart().startsWith('>');
}

function stripQuoteMarker(line: string): string {
	return line.replace(/^\s*>\s*/, '');
}
