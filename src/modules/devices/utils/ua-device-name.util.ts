/**
 * Extrait un nom lisible depuis un User-Agent HTTP.
 * Format : "Web (Chrome 124 / Windows 10/11)" ou "Web (Inconnu)" si non parsable.
 */
export function buildWebDeviceName(userAgent?: string): string {
	if (!userAgent) return 'Web (Inconnu)';

	const browser = extractBrowser(userAgent);
	const os = extractOs(userAgent);

	if (!browser && !os) return 'Web (Inconnu)';
	if (!os) return `Web (${browser})`;
	if (!browser) return `Web (${os})`;
	return `Web (${browser} / ${os})`;
}

// Ordre important : Edge et OPR avant Chrome car ils incluent "Chrome/" dans leur UA
const BROWSER_RULES: [RegExp, string][] = [
	[/Edg\/(\d+)/, 'Edge'],
	[/OPR\/(\d+)/, 'Opera'],
	[/Firefox\/(\d+)/, 'Firefox'],
	[/SamsungBrowser\/(\d+)/, 'Samsung Browser'],
	[/Chrome\/(\d+)/, 'Chrome'],
	[/Version\/(\d+).*Safari/, 'Safari'],
];

function extractBrowser(ua: string): string | null {
	for (const [re, name] of BROWSER_RULES) {
		const m = ua.match(re);
		if (m) return `${name} ${m[1]}`;
	}
	return null;
}

function detectIos(ua: string): string | null {
	if (!/iPhone|iPad/.test(ua)) return null;
	const m = ua.match(/OS ([\d_]+)/);
	return m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS';
}

function detectAndroid(ua: string): string | null {
	if (!/Android/.test(ua)) return null;
	const m = ua.match(/Android ([\d.]+)/);
	return m ? `Android ${m[1]}` : 'Android';
}

const WINDOWS_NT_VERSIONS: Record<string, string> = {
	'10.0': '10/11',
	'6.3': '8.1',
	'6.2': '8',
	'6.1': '7',
};

function detectWindows(ua: string): string | null {
	if (!/Windows NT/.test(ua)) return null;
	const m = ua.match(/Windows NT ([\d.]+)/);
	const label = m ? (WINDOWS_NT_VERSIONS[m[1]] ?? m[1]) : null;
	return label ? `Windows ${label}` : 'Windows';
}

function detectMacos(ua: string): string | null {
	if (!/Mac OS X/.test(ua)) return null;
	const m = ua.match(/Mac OS X ([\d_]+)/);
	return m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
}

function extractOs(ua: string): string | null {
	return (
		detectIos(ua) ??
		detectAndroid(ua) ??
		detectWindows(ua) ??
		detectMacos(ua) ??
		(/Linux/.test(ua) ? 'Linux' : null)
	);
}
