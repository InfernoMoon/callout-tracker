export interface CalloutProperty {
	key: string;
	value: string;
}

export interface CalloutEntry {
	fileName: string;
	filePath: string;
	startLine?: number;
	title: string;
	body: string;
	properties: CalloutProperty[];
	type: string;
}

export interface CalloutTrackerBlockConfig {
	calloutTypes: string[];
	rootFolder: string;
	search: string;
	filter: string;
	namedFilters: Record<string, string>;
	summaries: string[];
	display: CalloutTrackerDisplayMode;
}

export type CalloutTrackerDisplayMode = 'all' | 'onlySummary' | 'onlyCallouts';

export interface CustomCallout {
	name: string;
	fontColor: string;
	backgroundColor: string;
	hasBorder: boolean;
	borderColor: string;
	borderWidth?: string;
	borderStyle?: string;
	hasIcon: boolean;
	iconName: string;
}
