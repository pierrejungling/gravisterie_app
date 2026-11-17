import { Repository } from 'typeorm';
import { Client, Commande, Evenement } from '../model/entity';
import { StatutCommande } from '../model/entity/enum';
import { EvenementPayload } from '../model/payload/evenement.payload';
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
    prestation: number;
    total: number;
}
export interface ClientEvenement {
    id_client: string;
    nom: string | null;
    prénom: string | null;
    société: string | null;
}
export type EvenementAvecStats = Evenement & {
    stats: StatsEvenement;
    client: ClientEvenement | null;
};
export declare class EvenementService {
    private readonly repo;
    private readonly commandeRepo;
    private readonly clientRepo;
    constructor(repo: Repository<Evenement>, commandeRepo: Repository<Commande>, clientRepo: Repository<Client>);
    liste(): Promise<EvenementAvecStats[]>;
    detail(id: string): Promise<EvenementAvecStats & {
        commandes: CommandeEvenement[];
    }>;
    creer(payload: EvenementPayload): Promise<Evenement>;
    modifier(id: string, payload: EvenementPayload): Promise<Evenement>;
    supprimer(id: string): Promise<void>;
    lierCommande(id: string, idCommande: string): Promise<void>;
    delierCommande(id: string, idCommande: string): Promise<void>;
    resume(id: string): Promise<{
        id_evenement: string;
        nom: string;
        date_debut: Date | null;
        statut: string;
    }>;
    private trouver;
    private appliquer;
    private stats;
    private clients;
    private nomClient;
    private date;
}
