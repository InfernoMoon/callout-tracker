export interface CalloutProperty {
	key: string;
	value: string;
}

export interface ParsedCalloutProperties {
	properties: CalloutProperty[];
	remainingLines: string[];
}

export function parseCalloutProperties(text: string): ParsedCalloutProperties | null {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	const properties: CalloutProperty[] = [];
	let propertyLineCount = 0;

	for (const line of lines) {
		const property = parsePropertyLine(line);
		if (!property) {
			break;
		}

		properties.push(property);
		propertyLineCount++;
	}

	return propertyLineCount === 0
		? null
		: {
			properties,
			remainingLines: lines.slice(propertyLineCount),
		};
}

export function renderCalloutProperties(
	container: HTMLElement,
	properties: CalloutProperty[],
): HTMLElement {
	const propertyContainer = container.createDiv({ cls: 'callout-properties' });
	for (const property of properties) {
		const propertyElement = propertyContainer.createDiv({ cls: 'callout-property' });
		propertyElement.createSpan({
			cls: 'callout-property-key',
			text: property.key,
		});
		propertyElement.createSpan({
			cls: 'callout-property-value',
			text: property.value,
		});
	}

	return propertyContainer;
}

function parsePropertyLine(line: string): CalloutProperty | null {
	const match = line.trim().match(/^([^\s:]+)\s*::\s*(.*)$/);
	if (!match || match[1] === undefined || match[2] === undefined) {
		return null;
	}

	return {
		key: match[1],
		value: match[2],
	};
}
