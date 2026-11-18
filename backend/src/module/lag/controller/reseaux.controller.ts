import { Controller, Get, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/config/metadata/public.metadata';
import { ReseauxService } from '../service/reseaux.service';

@ApiBearerAuth('access-token')
@ApiTags('Reseaux')
@Controller('reseaux')
export class ReseauxController {
    constructor(private readonly reseauxService: ReseauxService) {}

    @Get('abonnes')
    @ApiOperation({ summary: 'Nombre d\'abonnés Facebook et Instagram (cache 10 min)' })
    async getAbonnes() {
        return await this.reseauxService.getAbonnes();
    }

    /**
     * Version publique pour le fond d'écran (Plash / Übersicht) : uniquement les deux nombres de La Gravisterie,
     * déjà publics sur les réseaux. Cache 60 s, lecture seule, ouverte à toutes les origines (pas de cookies).
     */
    @Public()
    @Header('Access-Control-Allow-Origin', '*')
    @Header('Cache-Control', 'no-store')
    @Get('abonnes-public')
    @ApiOperation({ summary: 'Abonnés FB/IG de La Gravisterie, sans authentification (cache 60 s)' })
    async getAbonnesPublic() {
        const r = await this.reseauxService.getAbonnes(60 * 1000);
        const c = r.comptes[0];
        return {
            facebook: c?.facebook ?? null,
            instagram: c?.instagram?.abonnes ?? null,
            mis_a_jour: r.mis_a_jour,
        };
    }
}
