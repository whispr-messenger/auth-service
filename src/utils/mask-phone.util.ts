// WHISPR-1372: masque les numéros E.164 avant tout log pour respecter le RGPD.
// On garde le préfixe (3 premiers chars, ex: "+33") et les 4 derniers chiffres
// pour rester traçable côté ops sans exposer le numéro complet.
export function maskPhone(phone: string | null | undefined): string {
	if (!phone) {
		return '<empty>';
	}
	if (phone.length <= 7) {
		return '***';
	}
	return `${phone.slice(0, 3)}***${phone.slice(-4)}`;
}
