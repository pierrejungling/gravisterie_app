import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ulid } from 'ulid';
import { Client, Commande, Evenement } from '../model/entity';
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
    ca_commandes: number;
    /** Montant de la prestation HTVA (forfait + gravures si formule à la gravure). */
    prestation: number;
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
    ) {}

    async liste(): Promise<EvenementAvecStats[]> {
        const [evenements, commandes] = await Promise.all([
            this.repo.find(),
            this.commandeRepo
                .createQueryBuilder('c')
                .select(['c.id_commande', 'c.id_evenement', 'c.prix_final', 'c.statut_commande'])
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
    }

    private stats(e: Evenement, commandes: Pick<Commande, 'prix_final' | 'statut_commande'>[]): StatsEvenement {
        const valides = commandes.filter((c) => c.statut_commande !== StatutCommande.ANNULEE);
        const ca = valides.reduce((s, c) => s + (Number(c.prix_final) || 0), 0);
        let prestation = Number(e.prix_forfait) || 0;
        if (e.formule === 'a_la_gravure') prestation += (Number(e.prix_gravure) || 0) * (e.nb_gravures || 0);
        if (e.statut === 'annule' || e.statut === 'refuse') prestation = 0;
        const arrondi = (n: number) => Math.round(n * 100) / 100;
        return { nb_commandes: commandes.length, ca_commandes: arrondi(ca), prestation: arrondi(prestation), total: arrondi(ca + prestation) };
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
