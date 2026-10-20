export interface CalloutProperty {
	key: string;
	value: string;
}

export interface CalloutInsertTemplate {
	name: string;
	calloutType: string;
	title: string;
	content: string;
	hasCheckbox: boolean;
	checkboxStartsChecked: boolean;
	isCollapsible: boolean;
	startsCollapsed: boolean;
	properties: CalloutProperty[];
}

export interface CalloutEntry {
	fileName: string;
	filePath: string;
	startLine?: number;
	checked?: boolean;
	collapseState?: 'expanded' | 'collapsed';
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
	groupBy: string;
	orderBy: string;
	display: CalloutTrackerDisplayMode;
	collapse: CalloutTrackerCollapseMode;
	collapseSpecified: boolean;
}

export type CalloutTrackerDisplayMode = 'all' | 'onlySummary' | 'onlyCallouts';
export type CalloutTrackerCollapseMode = 'default' | 'collapsed' | 'expanded';

export interface CustomCallout {
	name: string;
	fontColorDark: string;
	fontColorLight: string;
	backgroundColorDark: string;
	backgroundColorLight: string;
	hasBorder: boolean;
	borderColor: string;
	borderWidth?: string;
	borderStyle?: string;
	hasIcon: boolean;
	iconName: string;
}
