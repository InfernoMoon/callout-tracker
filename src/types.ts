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
