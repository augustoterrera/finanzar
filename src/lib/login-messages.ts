export type LoginError = 'credenciales' | 'limite' | 'conexion';

export const LOGIN_ERRORS: Record<LoginError, string> = {
	credenciales: 'Usuario o contraseña incorrectos. Revisá los datos e intentá de nuevo.',
	limite: 'Hubo varios intentos. Esperá 15 minutos y probá de nuevo.',
	conexion: 'No se pudo iniciar sesión. Volvé a intentar en unos minutos.',
};
