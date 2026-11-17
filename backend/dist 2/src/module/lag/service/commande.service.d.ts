import { Repository } from 'typeorm';
import { Commande, Client, Gravure, Personnalisation, Support, CommandeSupport, CommandeLignePrix } from '../model/entity';
import { AjouterCommandePayload, CreateOrderFromWebhookDto } from '../model/payload';
import { StatutCommande } from '../model/entity/enum';
import { CommandeFichierService } from './commande-fichier.service';
export declare class CommandeService {
    private readonly commandeRepository;
    private readonly clientRepository;
    private readonly gravureRepository;
    private readonly personnalisationRepository;
    private readonly supportRepository;
    private readonly commandeSupportRepository;
    private readonly commandeLignePrixRepository;
    private readonly commandeFichierService;
    private readonly logger;
    constructor(commandeRepository: Repository<Commande>, clientRepository: Repository<Client>, gravureRepository: Repository<Gravure>, personnalisationRepository: Repository<Personnalisation>, supportRepository: Repository<Support>, commandeSupportRepository: Repository<CommandeSupport>, commandeLignePrixRepository: Repository<CommandeLignePrix>, commandeFichierService: CommandeFichierService);
    private copierFicheClient;
    parseQuantiteProduitCompteursJson(raw: string | null): Array<{
        id: string;
        libelle: string;
        quantite_cible: number;
        quantite_realisee: number;
    }> | null;
    normalizeQuantiteProduitCompteursForStorage(input: unknown): string | null;
    creerCommandeDepuisWebhook(dto: CreateOrderFromWebhookDto, files?: Express.Multer.File[]): Promise<Commande>;
    ajouterCommande(payload: AjouterCommandePayload): Promise<Commande>;
    getAllCommandes(): Promise<Commande[]>;
    rechercherCommandes(query: string, limit?: number): Promise<Commande[]>;
    private buildCommandeSearchHaystack;
    getCommandeById(idCommande: string): Promise<any>;
    dupliquerCommande(idCommande: string): Promise<any>;
    updateCommande(idCommande: string, payload: any): Promise<any>;
    updateStatutCommande(idCommande: string, nouveauStatut: StatutCommande): Promise<Commande>;
    deleteCommande(idCommande: string): Promise<void>;
    private toLignesPrixDto;
    private replaceLignesPrix;
    private resolveLignePrixId;
    private normalizeLignePrixId;
}
