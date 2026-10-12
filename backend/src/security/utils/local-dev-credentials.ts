/**
 * Compte de développement local uniquement.
 * Autorisé uniquement si APP_MODE=development.
 * Ne jamais utiliser en production.
 */
export const LOCAL_DEV_CREDENTIALS = {
  username: 'test',
  password: 'test',
  mail: 'test@localhost.dev',
} as const;

export function isLocalDevMode(): boolean {
  return (process.env.APP_MODE || '').toLowerCase() === 'development';
}

export function isLocalDevCredential(username: string): boolean {
  return username === LOCAL_DEV_CREDENTIALS.username;
}
