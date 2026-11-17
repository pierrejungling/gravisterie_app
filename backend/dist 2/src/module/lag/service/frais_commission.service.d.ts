import { Repository } from 'typeorm';
import { FraisCommission } from '../model/entity/frais_commission.entity';
import { AjouterFraisCommissionPayload } from '../model/payload/frais_commission_payload';
export declare class FraisCommissionService {
    private readonly fraisCommissionRepository;
    constructor(fraisCommissionRepository: Repository<FraisCommission>);
    getAllFraisCommissions(): Promise<FraisCommission[]>;
    ajouterFraisCommission(payload: AjouterFraisCommissionPayload): Promise<FraisCommission>;
}
