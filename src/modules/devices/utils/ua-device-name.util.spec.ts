import { buildWebDeviceName } from './ua-device-name.util';

describe('buildWebDeviceName', () => {
	describe('fallback sans User-Agent', () => {
		it('retourne "Web (Inconnu)" si userAgent est undefined', () => {
			expect(buildWebDeviceName(undefined)).toBe('Web (Inconnu)');
		});

		it('retourne "Web (Inconnu)" si userAgent est une chaine vide', () => {
			expect(buildWebDeviceName('')).toBe('Web (Inconnu)');
		});

		it('retourne "Web (Inconnu)" si le UA ne correspond à aucune règle', () => {
			expect(buildWebDeviceName('UnknownBot/1.0')).toBe('Web (Inconnu)');
		});
	});

	describe('navigateurs desktop', () => {
		it('parse Chrome sur Windows', () => {
			const ua =
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
			expect(buildWebDeviceName(ua)).toBe('Web (Chrome 124 / Windows 10/11)');
		});

		it('parse Chrome sur macOS', () => {
			const ua =
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
			expect(buildWebDeviceName(ua)).toBe('Web (Chrome 124 / macOS 10.15.7)');
		});

		it('parse Firefox sur Linux', () => {
			const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';
			expect(buildWebDeviceName(ua)).toBe('Web (Firefox 125 / Linux)');
		});

		it('parse Safari sur macOS', () => {
			const ua =
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
			expect(buildWebDeviceName(ua)).toBe('Web (Safari 17 / macOS 14.4)');
		});

		it('parse Edge avant Chrome (tous deux present dans le UA)', () => {
			const ua =
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
			expect(buildWebDeviceName(ua)).toBe('Web (Edge 124 / Windows 10/11)');
		});

		it('parse Opera avant Chrome', () => {
			const ua =
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0';
			expect(buildWebDeviceName(ua)).toBe('Web (Opera 110 / Windows 10/11)');
		});
	});

	describe('navigateurs mobiles', () => {
		it('parse Safari sur iOS', () => {
			const ua =
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
			expect(buildWebDeviceName(ua)).toBe('Web (Safari 17 / iOS 17.4.1)');
		});

		it('parse Chrome sur Android', () => {
			const ua =
				'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36';
			expect(buildWebDeviceName(ua)).toBe('Web (Chrome 124 / Android 14)');
		});

		it('parse Samsung Browser sur Android', () => {
			const ua =
				'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
			expect(buildWebDeviceName(ua)).toBe('Web (Samsung Browser 25 / Android 14)');
		});
	});
});
