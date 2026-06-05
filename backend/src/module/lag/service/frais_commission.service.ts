import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ulid } from 'ulid';
import { FraisCommission } from '../model/entity/frais_commission.entity';
import { AjouterFraisCommissionPayload } from '../model/payload/frais_commission_payload';

@Injectable()
export class FraisCommissionService {
    constructor(
        @InjectRepository(FraisCommission)
        private readonly fraisCommissionRepository: Repository<FraisCommission>,
    ) {}

    async getAllFraisCommissions(): Promise<FraisCommission[]> {
        return await this.fraisCommissionRepository.find({
            order: { libelle: 'ASC' },
        });
    }

    async ajouterFraisCommission(payload: AjouterFraisCommissionPayload): Promise<FraisCommission> {
        const existing = await this.fraisCommissionRepository.findOne({
            where: {
                libelle: payload.libelle.trim(),
            },
        });

        if (existing) {
            existing.pourcentage = Number(payload.pourcentage);
            return await this.fraisCommissionRepository.save(existing);
        }

        const fraisCommission = new FraisCommission();
        fraisCommission.id_frais_commission = ulid();
        fraisCommission.libelle = payload.libelle.trim();
        fraisCommission.pourcentage = Number(payload.pourcentage);

        return await this.fraisCommissionRepository.save(fraisCommission);
    }
}
