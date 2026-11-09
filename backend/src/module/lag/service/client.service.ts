import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ulid } from 'ulid';
import { Client, Commande } from '../model/entity';
import { StatutCommande } from '../model/entity/enum';
import { AjouterClientPayload, ModifierClientPayload } from '../model/payload';
import { formatTelephoneBE } from '../util/format-telephone.util';
import { normalizeSearchText, scoreFlexibleSearch } from '../util/search.util';

/** Résumé d'une commande dans l'historique client. */
export interface CommandeResume {
    id_commande: string;
    produit: string | null;
    date_commande: Date | null;
    deadline: Date | null;
    statut_commande: StatutCommande;
    statuts_actifs: StatutCommande[] | null;
    prix_final: number | null;
    payé: boolean;
    quantité: number | null;
}

/** Chiffres d'un client, calculés sur ses commandes (les annulées sont exclues du CA). */
export interface StatsClient {
    nb_commandes: number;
    nb_en_cours: number;
    nb_terminees: number;
    nb_annulees: number;
    ca_total: number;
    panier_moyen: number;
    reste_a_payer: number;
    premiere_commande: Date | null;
    derniere_commande: Date | null;
}

export type ClientAvecStats = Client & { stats: StatsClient };

export interface CriteresCorrespondance {
    nom?: string;
    prenom?: string;
    mail?: string;
    telephone?: string;
    societe?: string;
}

@Injectable()
export class ClientService {
    constructor(
        @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
        @InjectRepository(Commande) private readonly commandeRepository: Repository<Commande>,
    ) {}

    /** Tous les clients avec leurs chiffres, triés par dernière commande. */
    async getAllClients(): Promise<ClientAvecStats[]> {
        const [clients, commandes] = await Promise.all([
            this.clientRepository.find(),
            this.getCommandesResumees(),
        ]);
        const parClient = this.grouperParClient(commandes);
        return clients
            .map((client) => ({ ...client, stats: this.calculerStats(parClient.get(client.id_client) ?? []) }))
            .sort((a, b) => this.dateValue(b.stats.derniere_commande) - this.dateValue(a.stats.derniere_commande));
    }

    /** Recherche tolérante (accents, casse, fautes) sur nom, prénom, société, mail et téléphone. */
    async rechercherClients(query: string, limit = 8): Promise<ClientAvecStats[]> {
        const trimmed = normalizeSearchText(query || '');
        if (trimmed.length < 2) {
            return [];
        }
        const tous = await this.getAllClients();
        return tous
            .map((client) => ({ client, score: scoreFlexibleSearch(this.texteRecherche(client), trimmed) }))
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score || b.client.stats.nb_commandes - a.client.stats.nb_commandes)
            .slice(0, limit)
            .map((r) => r.client);
    }

    /** Fiche client : coordonnées, chiffres et historique complet des commandes. */
    async getClientById(idClient: string): Promise<ClientAvecStats & { commandes: CommandeResume[] }> {
        const client = await this.clientRepository.findOne({ where: { id_client: idClient } });
        if (!client) {
            throw new NotFoundException('Client introuvable');
        }
        const commandes = (await this.getCommandesResumees(idClient)).map((c) => c.commande);
        commandes.sort((a, b) => this.dateValue(b.date_commande) - this.dateValue(a.date_commande));
        return { ...client, stats: this.calculerStats(commandes), commandes };
    }

    async ajouterClient(payload: AjouterClientPayload): Promise<Client> {
        const client = new Client();
        client.id_client = ulid();
        this.appliquerPayload(client, payload);
        if (!client.nom && !client.prénom && !client.société) {
            throw new BadRequestException('Indique au moins un nom, un prénom ou une société');
        }
        return this.clientRepository.save(client);
    }

    async modifierClient(idClient: string, payload: ModifierClientPayload): Promise<Client> {
        const client = await this.clientRepository.findOne({ where: { id_client: idClient } });
        if (!client) {
            throw new NotFoundException('Client introuvable');
        }
        this.appliquerPayload(client, payload);
        return this.clientRepository.save(client);
    }

    /** Supprime une fiche client uniquement si aucune commande n'y est liée. */
    async supprimerClient(idClient: string): Promise<void> {
        const client = await this.clientRepository.findOne({ where: { id_client: idClient } });
        if (!client) {
            throw new NotFoundException('Client introuvable');
        }
        const nb = await this.commandeRepository.count({ where: { client: { id_client: idClient } } });
        if (nb > 0) {
            throw new BadRequestException(`Ce client a ${nb} commande(s) : fusionne-le plutôt avec une autre fiche`);
        }
        await this.clientRepository.remove(client);
    }

    /**
     * Fusionne des fiches : les commandes des sources passent sur la cible,
     * les champs vides de la cible sont complétés, puis les sources sont supprimées.
     */
    async fusionnerClients(idCible: string, idsSources: string[]): Promise<ClientAvecStats & { commandes: CommandeResume[] }> {
        const sources = [...new Set(idsSources.filter((id) => id && id !== idCible))];
        if (sources.length === 0) {
            throw new BadRequestException('Aucune fiche à fusionner');
        }

        await this.clientRepository.manager.transaction(async (manager) => {
            const clientRepo = manager.getRepository(Client);
            const commandeRepo = manager.getRepository(Commande);
            const cible = await clientRepo.findOne({ where: { id_client: idCible } });
            if (!cible) {
                throw new NotFoundException('Fiche cible introuvable');
            }
            const fiches = await clientRepo.find({ where: { id_client: In(sources) } });
            if (fiches.length !== sources.length) {
                throw new NotFoundException('Une des fiches à fusionner est introuvable');
            }

            const champs: (keyof Client)[] = ['nom', 'prénom', 'société', 'mail', 'téléphone', 'adresse', 'tva'];
            // Une adresse réduite au pays (« Belgique, Belgique… ») compte comme vide.
            const vide = (champ: keyof Client, valeur: unknown) =>
                !valeur ||
                (champ === 'adresse' &&
                    String(valeur)
                        .split(',')
                        .map((p) => p.trim().toLowerCase())
                        .every((p) => !p || p === 'belgique'));
            for (const fiche of fiches) {
                for (const champ of champs) {
                    if (vide(champ, cible[champ]) && !vide(champ, fiche[champ])) {
                        (cible as any)[champ] = fiche[champ];
                    }
                }
                if (fiche.notes?.trim()) {
                    cible.notes = [cible.notes?.trim(), fiche.notes.trim()].filter(Boolean).join('\n');
                }
            }
            await clientRepo.save(cible);

            await commandeRepo
                .createQueryBuilder()
                .update(Commande)
                .set({ client: { id_client: idCible } as Client })
                .where('id_client IN (:...ids)', { ids: sources })
                .execute();

            await clientRepo.remove(fiches);
        });

        return this.getClientById(idCible);
    }

    /**
     * Fiches qui correspondent à des coordonnées en cours de saisie (nouvelle commande),
     * pour proposer la fiche existante au lieu de créer un doublon.
     */
    async trouverCorrespondances(criteres: CriteresCorrespondance, limit = 4): Promise<(ClientAvecStats & { raisons: string[] })[]> {
        const mail = criteres.mail?.trim().toLowerCase() || '';
        const tel = this.normaliserTelephone(criteres.telephone);
        const nom = normalizeSearchText(criteres.nom || '');
        const prenom = normalizeSearchText(criteres.prenom || '');
        const societe = normalizeSearchText(criteres.societe || '');
        if (!mail && tel.length < 6 && nom.length < 3 && prenom.length < 3 && societe.length < 3) return [];

        const commence = (valeur: string | null | undefined, debut: string) =>
            !!debut && normalizeSearchText(valeur || '').split(/\s+/).some((mot) => mot.startsWith(debut));

        const resultats: (ClientAvecStats & { raisons: string[]; score: number })[] = [];
        for (const client of await this.getAllClients()) {
            const raisons: string[] = [];
            let score = 0;
            const mailClient = client.mail?.trim().toLowerCase() || '';
            if (mail.length >= 5 && mailClient && (mailClient === mail || (mail.length >= 6 && mailClient.startsWith(mail)))) {
                raisons.push('mail');
                score += 4;
            }
            const telClient = this.normaliserTelephone(client.téléphone);
            if (tel.length >= 6 && telClient.length >= 6 && (telClient === tel || telClient.startsWith(tel))) {
                raisons.push('téléphone');
                score += 4;
            }
            // Nom et prénom, dans un sens ou dans l'autre (souvent inversés dans les anciennes fiches).
            // Un nom qui correspond suffit ; le prénom qui correspond aussi fait monter la fiche.
            const nomClientOk = (a: string) => a.length >= 3 && (commence(client.nom, a) || commence(client.prénom, a));
            const prenomOk = (a: string) => a.length >= 2 && (commence(client.prénom, a) || commence(client.nom, a));
            if (nomClientOk(nom) || (!nom && nomClientOk(prenom))) {
                raisons.push('nom');
                score += nom && prenom && prenomOk(prenom) ? 3 : 2;
            }
            if (societe.length >= 3 && normalizeSearchText(client.société || '').includes(societe)) {
                raisons.push('société');
                score += 2;
            }
            if (raisons.length) resultats.push({ ...client, raisons, score });
        }
        return resultats
            .sort((a, b) => b.score - a.score || b.stats.nb_commandes - a.stats.nb_commandes)
            .slice(0, limit)
            .map(({ score, ...reste }) => reste);
    }

    private normaliserTelephone(valeur: string | null | undefined): string {
        return (valeur || '').replace(/\D/g, '').replace(/^(0032|32)/, '0');
    }

    /**
     * Repère les fiches probablement en double : même mail, même téléphone,
     * ou même nom + prénom (ou même société quand il n'y a pas de nom).
     */
    async getDoublons(): Promise<ClientAvecStats[][]> {
        const clients = await this.getAllClients();
        const parent = new Map<string, string>();
        const find = (id: string): string => {
            const p = parent.get(id) ?? id;
            if (p === id) return id;
            const root = find(p);
            parent.set(id, root);
            return root;
        };
        const union = (a: string, b: string) => {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent.set(rb, ra);
        };

        const index = new Map<string, string>();
        for (const client of clients) {
            for (const cle of this.clesDoublon(client)) {
                const existant = index.get(cle);
                if (existant) {
                    union(existant, client.id_client);
                } else {
                    index.set(cle, client.id_client);
                }
            }
        }

        const groupes = new Map<string, ClientAvecStats[]>();
        for (const client of clients) {
            const racine = find(client.id_client);
            const groupe = groupes.get(racine) ?? [];
            groupe.push(client);
            groupes.set(racine, groupe);
        }

        return [...groupes.values()]
            .filter((g) => g.length > 1)
            .map((g) => g.sort((a, b) => b.stats.nb_commandes - a.stats.nb_commandes))
            .sort((a, b) => b.length - a.length);
    }

    private clesDoublon(client: Client): string[] {
        const cles: string[] = [];
        const mail = client.mail?.trim().toLowerCase();
        if (mail) cles.push(`mail:${mail}`);
        const tel = (client.téléphone || '').replace(/\D/g, '').replace(/^(0032|32)/, '0');
        if (tel.length >= 8) cles.push(`tel:${tel}`);
        const nom = normalizeSearchText(client.nom || '');
        const prenom = normalizeSearchText(client.prénom || '');
        if (nom && prenom) {
            cles.push(`nom:${[nom, prenom].sort().join('|')}`);
        } else if (!nom && !prenom) {
            const societe = normalizeSearchText(client.société || '');
            if (societe) cles.push(`societe:${societe}`);
        }
        return cles;
    }

    private appliquerPayload(client: Client, payload: AjouterClientPayload): void {
        const texte = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
        const champs: [keyof Client, string | null | undefined][] = [
            ['nom', texte(payload.nom)],
            ['prénom', texte(payload.prenom)],
            ['société', texte(payload.societe)],
            ['mail', texte(payload.mail)],
            ['adresse', texte(payload.adresse)],
            ['tva', texte(payload.tva)],
            ['notes', texte(payload.notes)],
        ];
        for (const [champ, valeur] of champs) {
            if (valeur !== undefined) (client as any)[champ] = valeur;
        }
        if (payload.telephone !== undefined) {
            client.téléphone = formatTelephoneBE(payload.telephone);
        }
        // Valeurs non renseignées à la création : null explicite
        for (const champ of ['nom', 'prénom', 'société', 'mail', 'téléphone', 'adresse', 'tva', 'notes'] as (keyof Client)[]) {
            if ((client as any)[champ] === undefined) (client as any)[champ] = null;
        }
    }

    private texteRecherche(client: Client): string {
        return [client.nom, client.prénom, client.société, client.mail, client.téléphone]
            .filter(Boolean)
            .join(' ');
    }

    private async getCommandesResumees(idClient?: string): Promise<{ id_client: string | null; commande: CommandeResume }[]> {
        const qb = this.commandeRepository
            .createQueryBuilder('c')
            .leftJoin('c.client', 'cl')
            .select([
                'c.id_commande',
                'c.produit',
                'c.date_commande',
                'c.deadline',
                'c.statut_commande',
                'c.statuts_actifs',
                'c.prix_final',
                'c.payé',
                'c.quantité',
                'cl.id_client',
            ]);
        if (idClient) {
            qb.where('cl.id_client = :idClient', { idClient });
        }
        const commandes = await qb.getMany();
        return commandes.map((c) => ({
            id_client: c.client?.id_client ?? null,
            commande: {
                id_commande: c.id_commande,
                produit: c.produit ?? null,
                date_commande: c.date_commande ?? null,
                deadline: c.deadline ?? null,
                statut_commande: c.statut_commande,
                statuts_actifs: c.statuts_actifs ?? null,
                prix_final: c.prix_final != null ? Number(c.prix_final) : null,
                payé: !!c.payé,
                quantité: c.quantité ?? null,
            },
        }));
    }

    private grouperParClient(lignes: { id_client: string | null; commande: CommandeResume }[]): Map<string, CommandeResume[]> {
        const map = new Map<string, CommandeResume[]>();
        for (const { id_client, commande } of lignes) {
            if (!id_client) continue;
            const liste = map.get(id_client) ?? [];
            liste.push(commande);
            map.set(id_client, liste);
        }
        return map;
    }

    private calculerStats(commandes: CommandeResume[]): StatsClient {
        const valides = commandes.filter((c) => c.statut_commande !== StatutCommande.ANNULEE);
        const avecPrix = valides.filter((c) => c.prix_final != null && c.prix_final > 0);
        const ca = avecPrix.reduce((total, c) => total + (c.prix_final ?? 0), 0);
        const resteAPayer = avecPrix.filter((c) => !c.payé).reduce((total, c) => total + (c.prix_final ?? 0), 0);
        const dates = commandes.map((c) => this.dateValue(c.date_commande)).filter((d) => d > 0);
        return {
            nb_commandes: commandes.length,
            nb_en_cours: commandes.filter((c) => c.statut_commande !== StatutCommande.TERMINE && c.statut_commande !== StatutCommande.ANNULEE).length,
            nb_terminees: commandes.filter((c) => c.statut_commande === StatutCommande.TERMINE).length,
            nb_annulees: commandes.filter((c) => c.statut_commande === StatutCommande.ANNULEE).length,
            ca_total: Math.round(ca * 100) / 100,
            panier_moyen: avecPrix.length ? Math.round((ca / avecPrix.length) * 100) / 100 : 0,
            reste_a_payer: Math.round(resteAPayer * 100) / 100,
            premiere_commande: dates.length ? new Date(Math.min(...dates)) : null,
            derniere_commande: dates.length ? new Date(Math.max(...dates)) : null,
        };
    }

    private dateValue(date: Date | string | null | undefined): number {
        if (!date) return 0;
        const value = new Date(date).getTime();
        return Number.isNaN(value) ? 0 : value;
    }
}
