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

	describe('branches de fallback (version absente)', () => {
		it('retourne "iOS" sans numero si la version OS manque dans le UA iPhone', () => {
			// UA synthétique sans "OS X_Y" -> extractOs retourne "iOS" sans version
			expect(buildWebDeviceName('Mozilla/5.0 (iPhone; CPU like Mac OS X) Safari/604.1')).toBe(
				'Web (iOS)'
			);
		});

		it('retourne "Android" sans numero si la version Android manque', () => {
			// UA synthétique sans "Android X.Y" -> extractOs retourne "Android" sans version
			expect(buildWebDeviceName('Mozilla/5.0 (Linux; Android) Mobile Safari/537.36')).toBe(
				'Web (Android)'
			);
		});

		it('retourne "Windows X" pour une version NT non mappee', () => {
			// NT 5.1 = XP, non dans la map -> utilise le numero brut
			const ua = 'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 Chrome/49.0.0.0 Safari/537.36';
			expect(buildWebDeviceName(ua)).toBe('Web (Chrome 49 / Windows 5.1)');
		});

		it('retourne "Windows" seul si la version NT est absente', () => {
			// Force label=null: "Windows NT" sans numero de version
			const ua = 'Mozilla/5.0 (Windows NT) Chrome/120.0.0.0 Safari/537.36';
			expect(buildWebDeviceName(ua)).toBe('Web (Chrome 120 / Windows)');
		});

		it('retourne "macOS" sans version si le UA Mac ne contient pas de version parsable', () => {
			// UA synthétique sans "Mac OS X X_Y_Z"
			const ua =
				'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/100.0.0.0 Safari/537.36';
			expect(buildWebDeviceName(ua)).toBe('Web (Chrome 100 / macOS)');
		});

		it('retourne navigateur seul si OS non identifie (navigateur connu sans OS reconnu)', () => {
			// UA avec Firefox mais aucun OS reconnu
			const ua = 'Mozilla/5.0 Firefox/125.0';
			expect(buildWebDeviceName(ua)).toBe('Web (Firefox 125)');
		});
	});
});
