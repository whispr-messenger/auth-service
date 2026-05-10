/**
 * Extrait un nom lisible depuis un User-Agent HTTP.
 * Format : "Web (Chrome 124 / Windows)" ou "Web (Inconnu)" si non parsable.
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

function extractBrowser(ua: string): string | null {
	// Ordre important : Edge et OPR avant Chrome car ils incluent "Chrome/" dans leur UA
	const rules: [RegExp, string][] = [
		[/Edg\/(\d+)/, 'Edge'],
		[/OPR\/(\d+)/, 'Opera'],
		[/Firefox\/(\d+)/, 'Firefox'],
		[/SamsungBrowser\/(\d+)/, 'Samsung Browser'],
		[/Chrome\/(\d+)/, 'Chrome'],
		[/Version\/(\d+).*Safari/, 'Safari'],
	];

	for (const [re, name] of rules) {
		const m = ua.match(re);
		if (m) return `${name} ${m[1]}`;
	}
	return null;
}

function extractOs(ua: string): string | null {
	if (/iPhone|iPad/.test(ua)) {
		const m = ua.match(/OS ([\d_]+)/);
		const ver = m ? m[1].replace(/_/g, '.') : null;
		return ver ? `iOS ${ver}` : 'iOS';
	}
	if (/Android/.test(ua)) {
		const m = ua.match(/Android ([\d.]+)/);
		return m ? `Android ${m[1]}` : 'Android';
	}
	if (/Windows NT/.test(ua)) {
		const m = ua.match(/Windows NT ([\d.]+)/);
		const versions: Record<string, string> = {
			'10.0': '10/11',
			'6.3': '8.1',
			'6.2': '8',
			'6.1': '7',
		};
		const label = m ? (versions[m[1]] ?? m[1]) : null;
		return label ? `Windows ${label}` : 'Windows';
	}
	if (/Mac OS X/.test(ua)) {
		const m = ua.match(/Mac OS X ([\d_]+)/);
		const ver = m ? m[1].replace(/_/g, '.') : null;
		return ver ? `macOS ${ver}` : 'macOS';
	}
	if (/Linux/.test(ua)) return 'Linux';
	return null;
}
