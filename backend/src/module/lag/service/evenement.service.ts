import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ulid } from 'ulid';
import { Client, Commande, Evenement } from '../model/entity';
import { CommandeService } from './commande.service';
import { COUPURES_CAISSE, CaisseEvenement } from '../model/entity/evenement.entity';
import { StatutCommande } from '../model/entity/enum';
import { EvenementPayload } from '../model/payload/evenement.payload';

/** Commande rattachée à un événement, en résumé. */
export interface CommandeEvenement {
    id_commande: string;
    produit: string | null;
    date_commande: Date | null;
    deadline: Date | null;
    statut_commande: StatutCommande;
    prix_final: number | null;
    payé: boolean;
    quantité: number | null;
    client: string | null;
}

export interface StatsEvenement {
    nb_commandes: number;
    /** CA des commandes liées, hors vente de prestation. */
    ca_commandes: number;
    /** Montant de la prestation : la vente de prestation si elle existe, sinon le calcul (forfait + gravures). */
    prestation: number;
    /** Montant calculé à partir de la formule (forfait + gravures), pour comparaison. */
    prestation_calculee: number;
    /** true quand la prestation est portée par une vente liée (plus de doublon). */
    prestation_via_vente: boolean;
    /** Paiement de la prestation : celui de la vente si elle existe, sinon la case de l'événement. */
    prestation_payee: boolean;
    total: number;
}

export interface ClientEvenement {
    id_client: string;
    nom: string | null;
    prénom: string | null;
    société: string | null;
}

export type EvenementAvecStats = Evenement & { stats: StatsEvenement; client: ClientEvenement | null };

@Injectable()
export class EvenementService {
    constructor(
        @InjectRepository(Evenement) private readonly repo: Repository<Evenement>,
        @InjectRepository(Commande) private readonly commandeRepo: Repository<Commande>,
        @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
        private readonly commandeService: CommandeService,
    ) {}

    async liste(): Promise<EvenementAvecStats[]> {
        const [evenements, commandes] = await Promise.all([
            this.repo.find(),
            this.commandeRepo
                .createQueryBuilder('c')
                .select(['c.id_commande', 'c.id_evenement', 'c.prix_final', 'c.statut_commande', 'c.payé'])
                .where('c.id_evenement IS NOT NULL')
                .getMany(),
        ]);
        const clients = await this.clients(evenements.map((e) => e.id_client));
        return evenements
            .map((e) => {
                const liees = commandes.filter((c) => c.id_evenement === e.id_evenement);
                return { ...e, client: clients.get(e.id_client || '') ?? null, stats: this.stats(e, liees) };
            })
            .sort((a, b) => this.date(b.date_debut) - this.date(a.date_debut));
    }

    async detail(id: string): Promise<EvenementAvecStats & { commandes: CommandeEvenement[] }> {
        const e = await this.trouver(id);
        const commandes = await this.commandeRepo.find({
            where: { id_evenement: id },
            relations: ['client'],
            order: { date_commande: 'DESC' },
        });
        const clients = await this.clients([e.id_client]);
        return {
            ...e,
            client: clients.get(e.id_client || '') ?? null,
            stats: this.stats(e, commandes),
            commandes: commandes.map((c) => ({
                id_commande: c.id_commande,
                produit: c.produit,
                date_commande: c.date_commande,
                deadline: c.deadline,
                statut_commande: c.statut_commande,
                prix_final: c.prix_final !== null ? Number(c.prix_final) : null,
                payé: c.payé,
                quantité: c.quantité,
                client: c.client ? this.nomClient(c.client) : null,
            })),
        };
    }

    async creer(payload: EvenementPayload): Promise<Evenement> {
        const e = this.repo.create({ id_evenement: ulid(), materiel: [], type: 'gravure_direct', statut: 'propose', formule: 'a_definir' });
        this.appliquer(e, payload);
        if (!e.nom?.trim()) throw new BadRequestException("Donne un nom à l'événement");
        return this.repo.save(e);
    }

    async modifier(id: string, payload: EvenementPayload): Promise<Evenement> {
        const e = await this.trouver(id);
        this.appliquer(e, payload);
        if (!e.nom?.trim()) throw new BadRequestException("Donne un nom à l'événement");
        return this.repo.save(e);
    }

    /** Supprime l'événement ; les commandes liées restent, simplement détachées. */
    async supprimer(id: string): Promise<void> {
        const e = await this.trouver(id);
        await this.commandeRepo.update({ id_evenement: id }, { id_evenement: null });
        await this.repo.remove(e);
    }

    async lierCommande(id: string, idCommande: string): Promise<void> {
        await this.trouver(id);
        const res = await this.commandeRepo.update({ id_commande: idCommande }, { id_evenement: id });
        if (!res.affected) throw new NotFoundException('Commande introuvable');
    }

    async delierCommande(id: string, idCommande: string): Promise<void> {
        await this.commandeRepo.update({ id_commande: idCommande, id_evenement: id }, { id_evenement: null });
        await this.repo.update({ id_evenement: id, id_commande_prestation: idCommande }, { id_commande_prestation: null });
    }

    /**
     * Crée la vente qui porte la prestation (montant calculé, client organisateur), la rattache
     * à l'événement et la marque comme vente de prestation.
     */
    async creerVentePrestation(id: string): Promise<Commande> {
        const e = await this.trouver(id);
        if (e.id_commande_prestation) {
            const existe = await this.commandeRepo.findOne({ where: { id_commande: e.id_commande_prestation } });
            if (existe) throw new BadRequestException('La vente de la prestation existe déjà');
        }
        const montant = this.prestationCalculee(e);
        if (montant <= 0) throw new BadRequestException("Indique d'abord le prix de la prestation (formule et forfait)");
        const contact = !e.id_client
            ? {
                  nom: (e.contact_nom || e.lieu || e.nom || '').trim() || undefined,
                  mail: e.contact_mail?.trim() || undefined,
                  telephone: e.contact_telephone?.trim() || undefined,
              }
            : undefined;
        const vente = await this.commandeService.ajouterCommande({
            nom_commande: `Vente | Prestation ${e.nom}`.slice(0, 250),
            id_client: e.id_client || undefined,
            coordonnees_contact: contact,
            date_commande: (e.date_debut ?? new Date()).toISOString(),
            quantité: 1,
            prix_final: montant,
            prix_unitaire_final: montant,
            payé: e.paye,
            statut_initial: StatutCommande.TERMINE,
            attente_reponse: true,
            description_projet: `Prestation de l'événement « ${e.nom} »`,
        } as any);
        await this.commandeRepo.update({ id_commande: vente.id_commande }, { id_evenement: id });
        await this.repo.update({ id_evenement: id }, { id_commande_prestation: vente.id_commande });
        return vente;
    }

    /** Nom de l'événement d'une commande (affiché dans le détail commande). */
    async resume(id: string): Promise<{ id_evenement: string; nom: string; date_debut: Date | null; statut: string }> {
        const e = await this.trouver(id);
        return { id_evenement: e.id_evenement, nom: e.nom, date_debut: e.date_debut, statut: e.statut };
    }

    // ---------- interne ----------

    private async trouver(id: string): Promise<Evenement> {
        const e = await this.repo.findOne({ where: { id_evenement: id } });
        if (!e) throw new NotFoundException('Événement introuvable');
        return e;
    }

    private appliquer(e: Evenement, p: EvenementPayload): void {
        const texte = (v: string | null | undefined) => (v === undefined ? undefined : (v ?? '').trim() || null);
        const champsTexte = ['heure_arrivee', 'lieu', 'adresse', 'contact_nom', 'contact_telephone', 'contact_mail', 'id_client', 'notes'] as const;
        if (p.nom !== undefined) e.nom = (p.nom || '').trim();
        if (p.type !== undefined) e.type = p.type;
        if (p.statut !== undefined) e.statut = p.statut;
        if (p.formule !== undefined) e.formule = p.formule;
        if (p.paye !== undefined) e.paye = p.paye;
        champsTexte.forEach((champ) => {
            const v = texte(p[champ]);
            if (v !== undefined) (e as any)[champ] = v;
        });
        (['date_debut', 'date_fin'] as const).forEach((champ) => {
            if (p[champ] === undefined) return;
            const v = p[champ] ? new Date(p[champ] as string) : null;
            if (v && isNaN(v.getTime())) throw new BadRequestException('Date invalide');
            e[champ] = v;
        });
        (['prix_forfait', 'prix_gravure', 'nb_gravures', 'heures_sur_place', 'heures_trajet', 'forfait_carburant'] as const).forEach((champ) => {
            if (p[champ] === undefined) return;
            (e as any)[champ] = p[champ] === null || !isFinite(Number(p[champ])) ? null : Number(p[champ]);
        });
        if (p.materiel !== undefined) {
            e.materiel = (p.materiel || [])
                .filter((m) => m && typeof m.texte === 'string' && m.texte.trim())
                .slice(0, 100)
                .map((m) => ({ texte: m.texte.trim().slice(0, 200), fait: !!m.fait }));
        }
        if (p.caisse !== undefined) e.caisse = this.caisse(p.caisse);
        if (p.id_commande_prestation !== undefined) e.id_commande_prestation = (p.id_commande_prestation || '').trim() || null;
    }

    /** Nettoie le compte caisse reçu : montants numériques, nombres de coupures entiers et positifs. */
    private caisse(c: CaisseEvenement | null): CaisseEvenement | null {
        if (!c || typeof c !== 'object') return null;
        const montant = (v: unknown) => (v === null || v === undefined || (v as any) === '' || !isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
        const coupures: CaisseEvenement['coupures'] = {};
        COUPURES_CAISSE.forEach((k) => {
            const n = Math.floor(Number(c.coupures?.[k]));
            if (isFinite(n) && n > 0) coupures[k] = Math.min(n, 100000);
        });
        return {
            cash_avant: montant(c.cash_avant),
            coupures,
            ca_facture: montant(c.ca_facture),
            ca_sumup: montant(c.ca_sumup),
            ca_qr: montant(c.ca_qr),
            depot_banque: montant(c.depot_banque),
            frais: montant(c.frais),
        };
    }

    private prestationCalculee(e: Evenement): number {
        let prestation = Number(e.prix_forfait) || 0;
        if (e.formule === 'a_la_gravure') prestation += (Number(e.prix_gravure) || 0) * (e.nb_gravures || 0);
        if (e.statut === 'annule' || e.statut === 'refuse') prestation = 0;
        return Math.round(prestation * 100) / 100;
    }

    private stats(e: Evenement, commandes: Pick<Commande, 'id_commande' | 'prix_final' | 'statut_commande' | 'payé'>[]): StatsEvenement {
        const valides = commandes.filter((c) => c.statut_commande !== StatutCommande.ANNULEE);
        const vente = e.id_commande_prestation ? valides.find((c) => c.id_commande === e.id_commande_prestation) : undefined;
        const autres = vente ? valides.filter((c) => c !== vente) : valides;
        const ca = autres.reduce((s, c) => s + (Number(c.prix_final) || 0), 0);
        const calculee = this.prestationCalculee(e);
        const prestation = vente ? Number(vente.prix_final) || 0 : calculee;
        const arrondi = (n: number) => Math.round(n * 100) / 100;
        return {
            nb_commandes: commandes.length,
            ca_commandes: arrondi(ca),
            prestation: arrondi(prestation),
            prestation_calculee: calculee,
            prestation_via_vente: !!vente,
            prestation_payee: vente ? !!vente.payé : e.paye,
            total: arrondi(ca + prestation),
        };
    }

    private async clients(ids: (string | null)[]): Promise<Map<string, ClientEvenement>> {
        const uniques = [...new Set(ids.filter((v): v is string => !!v))];
        if (uniques.length === 0) return new Map();
        const list = await this.clientRepo.find({ where: { id_client: In(uniques) } });
        return new Map(list.map((c) => [c.id_client, { id_client: c.id_client, nom: c.nom, prénom: c.prénom, société: c.société }]));
    }

    private nomClient(c: Client): string | null {
        return [c.prénom, c.nom].filter((v) => v && String(v).trim()).join(' ') || c.société || null;
    }

    private date(d: Date | null): number {
        return d ? new Date(d).getTime() : 0;
    }
}
