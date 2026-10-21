import { Controller, Post, Body, Get, Put, Delete, Param, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RealtimeService } from '@common/realtime';
import { BonService } from '../service/bon.service';
import { AjouterBonPayload, ModifierBonPayload } from '../model/payload/bon_payload';

@ApiBearerAuth('access-token')
@ApiTags('Bon')
@Controller('bon')
export class BonController {
    constructor(
        private readonly bonService: BonService,
        private readonly realtime: RealtimeService,
    ) {}

    @Post('ajouter')
    @ApiOperation({ summary: 'Ajouter un nouveau bon cadeau' })
    async ajouterBon(
        @Body() payload: AjouterBonPayload,
        @Headers('x-client-id') origin?: string,
    ) {
        const bon = await this.bonService.ajouterBon(payload);
        this.realtime.publish({ resource: 'bon', action: 'created', id: bon.id_bon, origin });
        return bon;
    }

    @Get('liste')
    @ApiOperation({ summary: 'Récupérer tous les bons cadeaux' })
    async getAllBons() {
        return await this.bonService.getAllBons();
    }

    @Get('prochain-numero')
    @ApiOperation({ summary: 'Obtenir le prochain numéro de bon auto-généré' })
    async getNextNumero() {
        const numero = await this.bonService.getNextNumero();
        return { numero };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Récupérer un bon par son ID' })
    async getBonById(@Param('id') id: string) {
        return await this.bonService.getBonById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Mettre à jour un bon' })
    async updateBon(
        @Param('id') id: string,
        @Body() payload: ModifierBonPayload,
        @Headers('x-client-id') origin?: string,
    ) {
        const bon = await this.bonService.updateBon(id, payload);
        this.realtime.publish({ resource: 'bon', action: 'updated', id, origin });
        return bon;
    }

    @Put(':id/utilise')
    @ApiOperation({ summary: 'Marquer un bon comme utilisé' })
    async marquerUtilise(
        @Param('id') id: string,
        @Headers('x-client-id') origin?: string,
    ) {
        const bon = await this.bonService.marquerUtilise(id);
        this.realtime.publish({ resource: 'bon', action: 'updated', id, origin });
        return bon;
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Supprimer un bon' })
    async deleteBon(
        @Param('id') id: string,
        @Headers('x-client-id') origin?: string,
    ) {
        await this.bonService.deleteBon(id);
        this.realtime.publish({ resource: 'bon', action: 'deleted', id, origin });
        return { success: true };
    }
}
