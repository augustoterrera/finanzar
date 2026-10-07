import { auth } from '@/lib/auth-provider';
import { submitLoginForm } from '@/lib/auth-login-form';

export async function POST(request: Request) {
	return submitLoginForm(auth, request);
}
