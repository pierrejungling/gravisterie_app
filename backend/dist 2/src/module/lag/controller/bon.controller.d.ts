import { RealtimeService } from "../../../common/realtime";
import { BonService } from '../service/bon.service';
import { AjouterBonPayload, ModifierBonPayload } from '../model/payload/bon_payload';
export declare class BonController {
    private readonly bonService;
    private readonly realtime;
    constructor(bonService: BonService, realtime: RealtimeService);
    ajouterBon(payload: AjouterBonPayload, origin?: string): Promise<import("../model/entity").Bon>;
    getAllBons(): Promise<import("../model/entity").Bon[]>;
    getNextNumero(): Promise<{
        numero: string;
    }>;
    getBonById(id: string): Promise<import("../model/entity").Bon>;
    updateBon(id: string, payload: ModifierBonPayload, origin?: string): Promise<import("../model/entity").Bon>;
    marquerUtilise(id: string, origin?: string): Promise<import("../model/entity").Bon>;
    deleteBon(id: string, origin?: string): Promise<{
        success: boolean;
    }>;
}
