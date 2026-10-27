import { Injectable } from '@nestjs/common';
import { CommandeService } from '../lag/service/commande.service';
import { CommandeFichierService } from '../lag/service/commande-fichier.service';
import { BonService } from '../lag/service/bon.service';
import { FraisCommissionService } from '../lag/service/frais_commission.service';
import { StatutCommande } from '../lag/model/entity/enum';

/**
 * Outils MCP exposés à Claude.
 *
 * IMPORTANT : tous les outils sont en LECTURE SEULE. Ils n'appellent que des
 * méthodes de consultation des services existants (aucune écriture en base,
 * aucun upload/suppression R2, aucun événement temps réel publié).
 */

export interface McpToolDefinition {
    name: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations: Record<string, unknown>;
}

export interface McpToolResult {
    content: { type: 'text'; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
}

const LECTURE_SEULE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const LIBELLES_STATUT: Record<StatutCommande, string> = {
    [StatutCommande.EN_ATTENTE_INFORMATION]: "En attente d'informations",
    [StatutCommande.A_MODELLISER_PREPARER]: 'À modéliser / préparer',
    [StatutCommande.A_GRAVER]: 'À graver',
    [StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE]: 'À finir / laver / assembler / peindre',
    [StatutCommande.A_PRENDRE_EN_PHOTO]: 'À prendre en photo',
    [StatutCommande.A_LIVRER]: 'À livrer',
    [StatutCommande.A_METTRE_EN_LIGNE]: 'À mettre en ligne',
    [StatutCommande.A_FACTURER]: 'À facturer',
    [StatutCommande.DEMANDE_AVIS]: "Demande d'avis",
    [StatutCommande.TERMINE]: 'Terminé',
    [StatutCommande.ANNULEE]: 'Annulée',
};

const STATUTS_CLOS: StatutCommande[] = [StatutCommande.TERMINE, StatutCommande.ANNULEE];
const TOUS_STATUTS = Object.values(StatutCommande);

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const toIsoDate = (value: unknown): string | null => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
};

const nomClient = (client: any): string | null => {
    if (!client) return null;
    const parts = [client.prénom, client.nom].filter((p) => p && String(p).trim());
    const nom = parts.join(' ').trim();
    return nom || client.société || client.mail || null;
};

/** Version compacte d'une commande pour les listes (évite d'inonder le contexte). */
const resumeCommande = (c: any) => ({
    id: c.id_commande,
    produit: c.produit,
    client: nomClient(c.client),
    statut: c.statut_commande,
    statut_libelle: LIBELLES_STATUT[c.statut_commande as StatutCommande] ?? c.statut_commande,
    colonnes_finales_restantes: Array.isArray(c.statuts_actifs) && c.statuts_actifs.length ? c.statuts_actifs : undefined,
    date_commande: toIsoDate(c.date_commande),
    deadline: toIsoDate(c.deadline),
    quantite: c.quantité ?? null,
    prix_final: toNumber(c.prix_final),
    paye: Boolean(c.payé),
    // false = le client attend une réponse de Pierre ; true = Pierre attend le client
    en_attente_de: c.attente_reponse ? 'client' : 'moi',
    source_web: Boolean(c.source_web),
});

const ok = (data: Record<string, unknown>): McpToolResult => ({
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
});

const erreur = (message: string): McpToolResult => ({
    content: [{ type: 'text', text: message }],
    isError: true,
});

@Injectable()
export class McpTools {
    constructor(
        private readonly commandeService: CommandeService,
        private readonly commandeFichierService: CommandeFichierService,
        private readonly bonService: BonService,
        private readonly fraisCommissionService: FraisCommissionService,
    ) {}

    readonly definitions: McpToolDefinition[] = [
        {
            name: 'resume_activite',
            title: "Résumé de l'activité",
            description:
                "Vue d'ensemble de l'atelier La Gravisterie : nombre de commandes par colonne du Kanban, commandes en retard, deadlines des 14 prochains jours, commandes non payées et messages auxquels Pierre doit répondre. À utiliser en premier pour une question générale (\"où j'en suis ?\").",
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: LECTURE_SEULE,
        },
        {
            name: 'lister_commandes',
            title: 'Lister les commandes',
            description:
                "Liste les commandes (version résumée), triées de la plus récente à la plus ancienne. Filtrable par statut Kanban, paiement ou attente de réponse. Par défaut, les commandes terminées et annulées sont exclues.",
            inputSchema: {
                type: 'object',
                properties: {
                    statut: { type: 'string', enum: TOUS_STATUTS, description: 'Ne garder que cette colonne du Kanban.' },
                    inclure_closes: { type: 'boolean', default: false, description: 'Inclure les commandes terminées et annulées.' },
                    non_payees: { type: 'boolean', description: 'Ne garder que les commandes non payées.' },
                    en_attente_de: { type: 'string', enum: ['moi', 'client'], description: '"moi" = le client attend une réponse de Pierre ; "client" = Pierre attend le client.' },
                    limite: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
                },
                additionalProperties: false,
            },
            annotations: LECTURE_SEULE,
        },
        {
            name: 'rechercher_commandes',
            title: 'Rechercher des commandes',
            description:
                "Recherche tolérante (accents, casse, pluriels, fautes) dans les commandes : produit, client, description, texte de personnalisation. Utile pour retrouver une commande par nom de client ou de projet.",
            inputSchema: {
                type: 'object',
                properties: {
                    q: { type: 'string', minLength: 2, description: 'Texte recherché (2 caractères minimum).' },
                    limite: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
                },
                required: ['q'],
                additionalProperties: false,
            },
            annotations: LECTURE_SEULE,
        },
        {
            name: 'detail_commande',
            title: "Détail d'une commande",
            description:
                "Toutes les informations d'une commande : client et coordonnées, description, personnalisation, supports, lignes de prix, paiement, quantités, frais/commission.",
            inputSchema: {
                type: 'object',
                properties: { id: { type: 'string', description: "Identifiant de la commande (id renvoyé par les autres outils)." } },
                required: ['id'],
                additionalProperties: false,
            },
            annotations: LECTURE_SEULE,
        },
        {
            name: 'lister_fichiers_commande',
            title: "Fichiers d'une commande",
            description: "Liste les fichiers joints à une commande (noms, types, tailles, dates). Ne télécharge pas leur contenu.",
            inputSchema: {
                type: 'object',
                properties: { id: { type: 'string', description: 'Identifiant de la commande.' } },
                required: ['id'],
                additionalProperties: false,
            },
            annotations: LECTURE_SEULE,
        },
        {
            name: 'lister_bons',
            title: 'Lister les bons cadeaux',
            description: 'Liste les bons cadeaux (numéro, intitulé, bénéficiaire, valeur, échéance, utilisé ou non). Par défaut, seuls les bons non utilisés.',
            inputSchema: {
                type: 'object',
                properties: { inclure_utilises: { type: 'boolean', default: false } },
                additionalProperties: false,
            },
            annotations: LECTURE_SEULE,
        },
        {
            name: 'lister_frais_commissions',
            title: 'Frais et commissions',
            description: 'Liste des frais / commissions enregistrés (libellé et pourcentage), par exemple pour les dépôts-ventes.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: LECTURE_SEULE,
        },
    ];

    async call(name: string, args: Record<string, any> = {}): Promise<McpToolResult> {
        switch (name) {
            case 'resume_activite':
                return this.resumeActivite();
            case 'lister_commandes':
                return this.listerCommandes(args);
            case 'rechercher_commandes':
                return this.rechercherCommandes(args);
            case 'detail_commande':
                return this.detailCommande(args);
            case 'lister_fichiers_commande':
                return this.listerFichiers(args);
            case 'lister_bons':
                return this.listerBons(args);
            case 'lister_frais_commissions':
                return this.listerFrais();
            default:
                return erreur(`Outil inconnu : ${name}`);
        }
    }

    private async resumeActivite(): Promise<McpToolResult> {
        const commandes = await this.commandeService.getAllCommandes();
        const ouvertes = commandes.filter((c) => !STATUTS_CLOS.includes(c.statut_commande));
        const aujourdhui = new Date();
        aujourdhui.setHours(0, 0, 0, 0);
        const dans14j = new Date(aujourdhui.getTime() + 14 * 24 * 3600 * 1000);

        const parColonne: Record<string, number> = {};
        for (const c of ouvertes) {
            const colonnes = Array.isArray(c.statuts_actifs) && c.statuts_actifs.length ? c.statuts_actifs : [c.statut_commande];
            for (const s of colonnes) {
                const libelle = LIBELLES_STATUT[s] ?? s;
                parColonne[libelle] = (parColonne[libelle] ?? 0) + 1;
            }
        }

        const avecDeadline = ouvertes.filter((c) => c.deadline);
        const enRetard = avecDeadline.filter((c) => new Date(c.deadline as Date) < aujourdhui);
        const prochaines = avecDeadline
            .filter((c) => {
                const d = new Date(c.deadline as Date);
                return d >= aujourdhui && d <= dans14j;
            })
            .sort((a, b) => new Date(a.deadline as Date).getTime() - new Date(b.deadline as Date).getTime());

        return ok({
            date: toIsoDate(new Date()),
            commandes_ouvertes: ouvertes.length,
            par_colonne_kanban: parColonne,
            en_retard: enRetard.map(resumeCommande),
            deadlines_14_jours: prochaines.map(resumeCommande),
            reponses_a_donner: ouvertes.filter((c) => !c.attente_reponse).map(resumeCommande),
            non_payees: ouvertes.filter((c) => !c.payé).length,
            nouvelles_commandes_site: ouvertes.filter((c) => c.source_web && !c.site_traitee).map(resumeCommande),
        });
    }

    private async listerCommandes(args: Record<string, any>): Promise<McpToolResult> {
        const limite = clamp(args.limite, 1, 200, 50);
        let commandes = await this.commandeService.getAllCommandes();

        if (args.statut) {
            if (!TOUS_STATUTS.includes(args.statut)) return erreur(`Statut inconnu : ${args.statut}`);
            commandes = commandes.filter(
                (c) => c.statut_commande === args.statut || (Array.isArray(c.statuts_actifs) && c.statuts_actifs.includes(args.statut)),
            );
        } else if (!args.inclure_closes) {
            commandes = commandes.filter((c) => !STATUTS_CLOS.includes(c.statut_commande));
        }
        if (args.non_payees) commandes = commandes.filter((c) => !c.payé);
        if (args.en_attente_de === 'moi') commandes = commandes.filter((c) => !c.attente_reponse);
        if (args.en_attente_de === 'client') commandes = commandes.filter((c) => c.attente_reponse);

        return ok({
            total: commandes.length,
            affichees: Math.min(commandes.length, limite),
            commandes: commandes.slice(0, limite).map(resumeCommande),
        });
    }

    private async rechercherCommandes(args: Record<string, any>): Promise<McpToolResult> {
        const q = String(args.q ?? '').trim();
        if (q.length < 2) return erreur('La recherche doit contenir au moins 2 caractères.');
        const resultats = await this.commandeService.rechercherCommandes(q, clamp(args.limite, 1, 50, 10));
        return ok({ recherche: q, resultats: resultats.map(resumeCommande) });
    }

    private async detailCommande(args: Record<string, any>): Promise<McpToolResult> {
        const id = String(args.id ?? '').trim();
        if (!id) return erreur("L'identifiant de la commande est requis.");
        try {
            const c = await this.commandeService.getCommandeById(id);
            return ok({
                ...c,
                statut_libelle: LIBELLES_STATUT[c.statut_commande as StatutCommande] ?? c.statut_commande,
                prix_final: toNumber(c.prix_final),
                prix_unitaire_final: toNumber(c.prix_unitaire_final),
                frais_pourcentage: toNumber(c.frais_pourcentage),
                en_attente_de: c.attente_reponse ? 'client' : 'moi',
            });
        } catch {
            return erreur(`Commande introuvable : ${id}`);
        }
    }

    private async listerFichiers(args: Record<string, any>): Promise<McpToolResult> {
        const id = String(args.id ?? '').trim();
        if (!id) return erreur("L'identifiant de la commande est requis.");
        let fichiers;
        try {
            fichiers = await this.commandeFichierService.listByCommande(id);
        } catch {
            return erreur(`Commande introuvable : ${id}`);
        }
        return ok({
            commande: id,
            // On n'expose jamais la clé de stockage R2, uniquement les métadonnées utiles.
            fichiers: fichiers.map((f) => ({
                id: f.id_fichier,
                nom: f.nom_fichier,
                type: f.type_mime,
                taille_octets: f.taille_octets,
                date_upload: toIsoDate(f.date_upload),
            })),
        });
    }

    private async listerBons(args: Record<string, any>): Promise<McpToolResult> {
        let bons = await this.bonService.getAllBons();
        if (!args.inclure_utilises) bons = bons.filter((b) => !b.utilise);
        return ok({
            total: bons.length,
            bons: bons.map((b) => ({
                id: b.id_bon,
                numero: b.numero,
                intitule: b.intitule,
                beneficiaire: [b.prenom, b.nom].filter(Boolean).join(' ') || null,
                valeur: toNumber(b.valeur),
                date_creation: toIsoDate(b.date_creation),
                date_echeance: toIsoDate(b.date_echeance),
                utilise: b.utilise,
                date_utilisation: toIsoDate(b.date_utilisation),
            })),
        });
    }

    private async listerFrais(): Promise<McpToolResult> {
        const frais = await this.fraisCommissionService.getAllFraisCommissions();
        return ok({
            frais: frais.map((f) => ({ id: f.id_frais_commission, libelle: f.libelle, pourcentage: toNumber(f.pourcentage) })),
        });
    }
}
