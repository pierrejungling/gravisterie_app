export type RealtimeResource = 'commande' | 'bon' | 'frais' | 'client' | 'evenement' | 'site';
export type RealtimeAction = 'created' | 'updated' | 'deleted';

export interface RealtimeEvent {
  resource: RealtimeResource;
  action: RealtimeAction;
  id?: string;
  origin?: string | null;
  at: string;
}
