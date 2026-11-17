import { RealtimeService } from "../../../common/realtime";
import { FraisCommissionService } from '../service/frais_commission.service';
import { AjouterFraisCommissionPayload } from '../model/payload/frais_commission_payload';
export declare class FraisCommissionController {
    private readonly fraisCommissionService;
    private readonly realtime;
    constructor(fraisCommissionService: FraisCommissionService, realtime: RealtimeService);
    getAllFraisCommissions(): Promise<import("../model/entity").FraisCommission[]>;
    ajouterFraisCommission(payload: AjouterFraisCommissionPayload, origin?: string): Promise<import("../model/entity").FraisCommission>;
}
