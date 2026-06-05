export interface FraisCommission {
  id_frais_commission: string;
  libelle: string;
  pourcentage: number;
}

export const FRAIS_COMMISSION_LIBRE = '__libre__';
export const FRAIS_COMMISSION_NOUVEAU = '__nouveau__';
