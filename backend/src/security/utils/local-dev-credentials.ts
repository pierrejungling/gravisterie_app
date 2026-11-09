/**
 * Compte de développement local uniquement.
 * Autorisé uniquement si APP_MODE=development, et jamais sur Render
 * (Render définit RENDER=true), même si APP_MODE y vaut development.
 */
export const LOCAL_DEV_CREDENTIALS = {
  username: 'test',
  password: 'test',
  mail: 'test@localhost.dev',
} as const;

export function isLocalDevMode(): boolean {
  if (process.env.RENDER) {
    return false;
  }
  return (process.env.APP_MODE || '').toLowerCase() === 'development';
}

export function isLocalDevCredential(username: string): boolean {
  return username === LOCAL_DEV_CREDENTIALS.username;
}
