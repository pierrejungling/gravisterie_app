import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bon } from '../model/entity/bon.entity';
import { AjouterBonPayload, ModifierBonPayload } from '../model/payload/bon_payload';
import { ulid } from 'ulid';

@Injectable()
export class BonService {
    constructor(
        @InjectRepository(Bon) private readonly bonRepository: Repository<Bon>,
    ) {}

    async ajouterBon(payload: AjouterBonPayload): Promise<Bon> {
        const bon = new Bon();
        bon.id_bon = ulid();
        bon.numero = payload.numero.trim();
        bon.intitule = payload.intitule.trim();
        bon.date_creation = new Date(payload.date_creation);
        bon.nom = payload.nom?.trim() || null;
        bon.prenom = payload.prenom?.trim() || null;
        bon.duree_validite = payload.duree_validite?.trim() || null;
        bon.date_echeance = payload.date_echeance ? new Date(payload.date_echeance) : null;
        bon.utilise = false;
        bon.valeur = payload.valeur != null ? Number(payload.valeur) : null;

        return await this.bonRepository.save(bon);
    }

    async getAllBons(): Promise<Bon[]> {
        return await this.bonRepository.find({
            order: { date_creation: 'DESC', numero: 'ASC' },
        });
    }

    async getBonById(idBon: string): Promise<Bon> {
        const bon = await this.bonRepository.findOne({ where: { id_bon: idBon } });
        if (!bon) {
            throw new Error('Bon non trouvé');
        }
        return bon;
    }

    async getNextNumero(): Promise<string> {
        const bons = await this.bonRepository.find({ select: ['numero'] });
        if (!bons.length) {
            return 'BG001';
        }
        const prefix = 'BG';
        const maxNumeric = bons.reduce((max, b) => {
            const match = b.numero.replace(new RegExp(`^${prefix}`, 'i'), '').trim();
            const n = parseInt(match, 10);
            return Number.isNaN(n) ? max : Math.max(max, n);
        }, 0);
        return `${prefix}${(maxNumeric + 1).toString().padStart(3, '0')}`;
    }

    async updateBon(idBon: string, payload: ModifierBonPayload): Promise<Bon> {
        const bon = await this.bonRepository.findOne({ where: { id_bon: idBon } });
        if (!bon) {
            throw new Error('Bon non trouvé');
        }

        if (payload.numero !== undefined) bon.numero = payload.numero.trim();
        if (payload.intitule !== undefined) bon.intitule = payload.intitule.trim();
        if (payload.date_creation !== undefined) bon.date_creation = new Date(payload.date_creation);
        if (payload.nom !== undefined) bon.nom = payload.nom?.trim() || null;
        if (payload.prenom !== undefined) bon.prenom = payload.prenom?.trim() || null;
        if (payload.duree_validite !== undefined) bon.duree_validite = payload.duree_validite?.trim() || null;
        if (payload.date_echeance !== undefined) bon.date_echeance = payload.date_echeance ? new Date(payload.date_echeance) : null;
        if (payload.utilise !== undefined) {
            bon.utilise = payload.utilise;
            if (payload.utilise) {
                bon.date_utilisation = payload.date_utilisation ? new Date(payload.date_utilisation) : new Date();
            } else {
                bon.date_utilisation = null;
            }
        }
        if (payload.date_utilisation !== undefined && payload.utilise === undefined) {
            bon.date_utilisation = payload.date_utilisation ? new Date(payload.date_utilisation) : null;
        }
        if (payload.valeur !== undefined) bon.valeur = payload.valeur != null ? Number(payload.valeur) : null;

        return await this.bonRepository.save(bon);
    }

    async marquerUtilise(idBon: string): Promise<Bon> {
        const dateUtilisation = new Date().toISOString().split('T')[0];
        return this.updateBon(idBon, { utilise: true, date_utilisation: dateUtilisation });
    }

    async deleteBon(idBon: string): Promise<void> {
        const bon = await this.bonRepository.findOne({ where: { id_bon: idBon } });
        if (!bon) {
            throw new Error('Bon non trouvé');
        }
        await this.bonRepository.remove(bon);
    }
}
