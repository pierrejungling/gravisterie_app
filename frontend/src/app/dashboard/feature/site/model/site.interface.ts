export type SiteType = 'produit' | 'projet';

export interface SiteItem {
  id: string;
  type: SiteType;
  slug: string;
  nom: string;
  categories: string[];
  visible: boolean;
  ordre: number;
  images: string[];
  imagesUrl: string[];
  parent_id?: string | null;
  /** Nombre de modèles (fiches enfants) quand la fiche est une collection. */
  nbEnfants?: number;
  /** Détail seulement : modèles de la collection et collection parente. */
  enfants?: SiteItem[];
  parent?: { id: string; nom: string; slug: string } | null;
  donnees: Record<string, any>;
  date_maj: string;
}

export interface SiteItemPayload {
  type?: SiteType;
  parent_id?: string;
  slug?: string;
  nom?: string;
  categories?: string[];
  visible?: boolean;
  ordre?: number;
  donnees?: Record<string, any>;
  /** Version (date_maj) ouverte par l'utilisateur ; le serveur refuse si elle est périmée. */
  base?: string;
}

export interface SitePublication {
  produits: number;
  projets: number;
  urlProduits: string;
  urlProjets: string;
}

/** Catégories connues du site (libellés affichés sur la boutique et les projets). */
export const CATEGORIES_SITE: Record<SiteType, { valeur: string; label: string }[]> = {
  produit: [
    { valeur: 'deco-murale', label: 'Murale' },
    { valeur: 'animaux', label: 'Animaux' },
    { valeur: 'vegetaux', label: 'Végétaux' },
    { valeur: 'accessoires', label: 'Accessoires' },
    { valeur: 'bijoux', label: 'Bijoux' },
    { valeur: 'events', label: 'Fêtes & Cadeaux' },
    { valeur: 'decoration', label: 'Décorations' },
    { valeur: 'light', label: 'Lampes' },
    { valeur: 'perso', label: 'Personnalisé' },
  ],
  projet: [
    { valeur: 'perso', label: 'Personnalisé' },
    { valeur: 'entreprises', label: 'Entreprises' },
    { valeur: 'evenements', label: 'Événements' },
    { valeur: 'animaux', label: 'Animaux' },
    { valeur: 'deco-murale', label: 'Murale' },
    { valeur: 'accessoires', label: 'Accessoires' },
    { valeur: 'autres', label: 'Autres' },
  ],
};
