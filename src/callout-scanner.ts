import type { App, TFile } from 'obsidian';
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
	const normalizedRoot = normalizeRootFolder(rootFolder);
	const files = app.vault
		.getMarkdownFiles()
		.filter(
			(file) =>
				isInRootFolder(file, normalizedRoot) &&
				!startsWithPrefix(file.basename, ignoredPrefixes) &&
				!hasIgnoredFolder(file, ignoredPrefixes),
		);

	const entries: CalloutEntry[] = [];
	for (const file of files) {
		const content = await app.vault.cachedRead(file);
		const lines = content.replace(/\r\n?/g, '\n').split('\n');

		for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
			const header = parseCalloutHeader(lines[lineNumber] ?? '');
			if (!header) {
				continue;
			}

			const type = header.type;
			if (!type || !wantedTypes.has(type)) {
				continue;
			}

			const bodyLines: string[] = [];
			let nextLine = lineNumber + 1;
			while (nextLine < lines.length && isQuoteLine(lines[nextLine] ?? '')) {
				bodyLines.push(stripQuoteMarker(lines[nextLine] ?? ''));
				nextLine++;
			}

			entries.push({
				fileName: file.basename,
				filePath: file.path,
				startLine: lineNumber,
				title: header.title,
				body: bodyLines.join('\n').trim(),
				type,
			});

			lineNumber = nextLine - 1;
		}
	}

	return entries;
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
