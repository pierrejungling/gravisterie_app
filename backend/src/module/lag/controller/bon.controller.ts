import { Controller, Post, Body, Get, Put, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BonService } from '../service/bon.service';
import { AjouterBonPayload, ModifierBonPayload } from '../model/payload/bon_payload';

@ApiBearerAuth('access-token')
@ApiTags('Bon')
@Controller('bon')
export class BonController {
    constructor(private readonly bonService: BonService) {}

    @Post('ajouter')
    @ApiOperation({ summary: 'Ajouter un nouveau bon cadeau' })
    async ajouterBon(@Body() payload: AjouterBonPayload) {
        return await this.bonService.ajouterBon(payload);
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
    async updateBon(@Param('id') id: string, @Body() payload: ModifierBonPayload) {
        return await this.bonService.updateBon(id, payload);
    }

    @Put(':id/utilise')
    @ApiOperation({ summary: 'Marquer un bon comme utilisé' })
    async marquerUtilise(@Param('id') id: string) {
        return await this.bonService.marquerUtilise(id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Supprimer un bon' })
    async deleteBon(@Param('id') id: string) {
        await this.bonService.deleteBon(id);
        return { success: true };
    }
}
