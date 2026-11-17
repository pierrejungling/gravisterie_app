import { RealtimeService } from "../../../common/realtime";
import { EvenementService } from '../service/evenement.service';
import { EvenementPayload, LierCommandeEvenementPayload } from '../model/payload/evenement.payload';
export declare class EvenementController {
    private readonly evenementService;
    private readonly realtime;
    constructor(evenementService: EvenementService, realtime: RealtimeService);
    liste(): Promise<import("../service/evenement.service").EvenementAvecStats[]>;
    creer(payload: EvenementPayload, origin?: string): Promise<import("../model/entity").Evenement>;
    resume(id: string): Promise<{
        id_evenement: string;
        nom: string;
        date_debut: Date | null;
        statut: string;
    }>;
    detail(id: string): Promise<import("../model/entity").Evenement & {
        stats: import("../service/evenement.service").StatsEvenement;
        client: import("../service/evenement.service").ClientEvenement | null;
    } & {
        commandes: import("../service/evenement.service").CommandeEvenement[];
    }>;
    modifier(id: string, payload: EvenementPayload, origin?: string): Promise<import("../model/entity").Evenement>;
    supprimer(id: string, origin?: string): Promise<boolean>;
    lier(id: string, payload: LierCommandeEvenementPayload, origin?: string): Promise<boolean>;
    delier(id: string, idCommande: string, origin?: string): Promise<boolean>;
}
