export const INITIAL_ACCOUNT_EMAIL = 'owner@finanzar.invalid';
// Escape the literal hyphen for HTML's UnicodeSets (v) pattern syntax too.
export const USERNAME_PATTERN = '[A-Za-z0-9._\\-]{3,32}';
const usernameRegex = new RegExp(`^${USERNAME_PATTERN}$`);

export function isValidUsername(value: string) {
	return usernameRegex.test(value);
}

export function getSetupToken() {
	return process.env.AUTH_SETUP_TOKEN ?? (process.env.NODE_ENV === 'production' ? undefined : process.env.APP_PASSWORD);
}

export async function secretsMatch(input: string, expected: string) {
	const encoder = new TextEncoder();
	const hashes = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(input)),
		crypto.subtle.digest('SHA-256', encoder.encode(expected)),
	]);
	const left = new Uint8Array(hashes[0]);
	const right = new Uint8Array(hashes[1]);
	let difference = 0;
	for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
	return difference === 0;
}
