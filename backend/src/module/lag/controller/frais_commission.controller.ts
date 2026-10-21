import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RealtimeService } from '@common/realtime';
import { FraisCommissionService } from '../service/frais_commission.service';
import { AjouterFraisCommissionPayload } from '../model/payload/frais_commission_payload';

@ApiBearerAuth('access-token')
@ApiTags('FraisCommission')
@Controller('frais-commission')
export class FraisCommissionController {
    constructor(
        private readonly fraisCommissionService: FraisCommissionService,
        private readonly realtime: RealtimeService,
    ) {}

    @Get('liste')
    @ApiOperation({ summary: 'Récupérer tous les frais / commissions enregistrés' })
    async getAllFraisCommissions() {
        return await this.fraisCommissionService.getAllFraisCommissions();
    }

    @Post('ajouter')
    @ApiOperation({ summary: 'Ajouter un nouveau frais / commission à la liste' })
    async ajouterFraisCommission(
        @Body() payload: AjouterFraisCommissionPayload,
        @Headers('x-client-id') origin?: string,
    ) {
        const frais = await this.fraisCommissionService.ajouterFraisCommission(payload);
        this.realtime.publish({
            resource: 'frais',
            action: 'updated',
            id: frais.id_frais_commission,
            origin,
        });
        return frais;
    }
}
