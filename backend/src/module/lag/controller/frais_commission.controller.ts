import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FraisCommissionService } from '../service/frais_commission.service';
import { AjouterFraisCommissionPayload } from '../model/payload/frais_commission_payload';

@ApiBearerAuth('access-token')
@ApiTags('FraisCommission')
@Controller('frais-commission')
export class FraisCommissionController {
    constructor(private readonly fraisCommissionService: FraisCommissionService) {}

    @Get('liste')
    @ApiOperation({ summary: 'Récupérer tous les frais / commissions enregistrés' })
    async getAllFraisCommissions() {
        return await this.fraisCommissionService.getAllFraisCommissions();
    }

    @Post('ajouter')
    @ApiOperation({ summary: 'Ajouter un nouveau frais / commission à la liste' })
    async ajouterFraisCommission(@Body() payload: AjouterFraisCommissionPayload) {
        return await this.fraisCommissionService.ajouterFraisCommission(payload);
    }
}
