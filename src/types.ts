export interface CalloutEntry {
	fileName: string;
	filePath: string;
	startLine: number;
	title: string;
	body: string;
	type: string;
}

export interface CalloutTrackerBlockConfig {
	calloutTypes: string[];
	rootFolder: string;
}

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
