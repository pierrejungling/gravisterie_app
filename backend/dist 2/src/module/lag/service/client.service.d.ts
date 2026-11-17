import { Repository } from 'typeorm';
import { Client, Commande } from '../model/entity';
import { StatutCommande } from '../model/entity/enum';
import { AjouterClientPayload, ModifierClientPayload } from '../model/payload';
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
export type ClientAvecStats = Client & {
    stats: StatsClient;
};
export interface CriteresCorrespondance {
    nom?: string;
    prenom?: string;
    mail?: string;
    telephone?: string;
    societe?: string;
}
export declare class ClientService {
    private readonly clientRepository;
    private readonly commandeRepository;
    constructor(clientRepository: Repository<Client>, commandeRepository: Repository<Commande>);
    getAllClients(): Promise<ClientAvecStats[]>;
    rechercherClients(query: string, limit?: number): Promise<ClientAvecStats[]>;
    getClientById(idClient: string): Promise<ClientAvecStats & {
        commandes: CommandeResume[];
    }>;
    ajouterClient(payload: AjouterClientPayload): Promise<Client>;
    modifierClient(idClient: string, payload: ModifierClientPayload): Promise<Client>;
    supprimerClient(idClient: string): Promise<void>;
    fusionnerClients(idCible: string, idsSources: string[]): Promise<ClientAvecStats & {
        commandes: CommandeResume[];
    }>;
    trouverCorrespondances(criteres: CriteresCorrespondance, limit?: number): Promise<(ClientAvecStats & {
        raisons: string[];
    })[]>;
    private normaliserTelephone;
    getDoublons(): Promise<ClientAvecStats[][]>;
    private clesDoublon;
    private appliquerPayload;
    private texteRecherche;
    private getCommandesResumees;
    private grouperParClient;
    private calculerStats;
    private dateValue;
}
