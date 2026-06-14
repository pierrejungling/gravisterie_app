import { Controller, Post, Body, Get, Put, Delete, Param, Query, UseInterceptors, UploadedFile, BadRequestException, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommandeService } from '../service/commande.service';
import { CommandeFichierService } from '../service/commande-fichier.service';
import { AjouterCommandePayload, UpdateStatutPayload } from '../model/payload';

@ApiBearerAuth('access-token')
@ApiTags('Commande')
@Controller('commande')
export class CommandeController {
    constructor(
        private readonly commandeService: CommandeService,
        private readonly commandeFichierService: CommandeFichierService,
    ) {}

    @Post('ajouter')
    @ApiOperation({ summary: 'Ajouter une nouvelle commande' })
    async ajouterCommande(@Body() payload: AjouterCommandePayload) {
        return await this.commandeService.ajouterCommande(payload);
    }

    @Get('liste')
    @ApiOperation({ summary: 'Récupérer toutes les commandes' })
    async getAllCommandes() {
        return await this.commandeService.getAllCommandes();
    }

    @Get('recherche')
    @ApiOperation({ summary: 'Rechercher des commandes (accents, casse, pluriels, fautes)' })
    async rechercherCommandes(
        @Query('q') query?: string,
        @Query('limit') limit?: string,
    ) {
        const parsedLimit = Math.min(Math.max(parseInt(limit || '8', 10) || 8, 1), 50);
        return await this.commandeService.rechercherCommandes(query || '', parsedLimit);
    }

    @Put('statut')
    @ApiOperation({ summary: 'Mettre à jour le statut d\'une commande' })
    async updateStatut(@Body() payload: UpdateStatutPayload) {
        return await this.commandeService.updateStatutCommande(payload.id_commande, payload.statut);
    }

    @Get(':id/fichiers')
    @ApiOperation({ summary: 'Liste des fichiers d\'une commande' })
    async listFichiers(@Param('id') idCommande: string) {
        return await this.commandeFichierService.listByCommande(idCommande);
    }

    @Post(':id/fichiers')
    @ApiOperation({ summary: 'Upload un fichier pour une commande' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFichier(
        @Param('id') idCommande: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('Aucun fichier fourni');
        }
        return await this.commandeFichierService.upload(idCommande, file);
    }

    @Get(':id/fichiers/:idFichier/download')
    @ApiOperation({ summary: 'Télécharger un fichier' })
    async downloadFichier(
        @Param('id') idCommande: string,
        @Param('idFichier') idFichier: string,
    ) {
        const { stream, contentType, nomFichier } = await this.commandeFichierService.getStream(idCommande, idFichier);
        const filename = encodeURIComponent(nomFichier);
        return new StreamableFile(stream, {
            type: contentType || 'application/octet-stream',
            disposition: `attachment; filename*=UTF-8''${filename}`,
        });
    }

    @Delete(':id/fichiers/:idFichier')
    @ApiOperation({ summary: 'Supprimer un fichier d\'une commande' })
    async deleteFichier(
        @Param('id') idCommande: string,
        @Param('idFichier') idFichier: string,
    ) {
        await this.commandeFichierService.delete(idCommande, idFichier);
        return { success: true };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Récupérer une commande par son ID' })
    async getCommandeById(@Param('id') id: string) {
        return await this.commandeService.getCommandeById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Mettre à jour une commande' })
    async updateCommande(@Param('id') id: string, @Body() payload: any) {
        return await this.commandeService.updateCommande(id, payload);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Supprimer une commande' })
    async deleteCommande(@Param('id') id: string) {
        return await this.commandeService.deleteCommande(id);
    }

    @Post(':id/dupliquer')
    @ApiOperation({ summary: 'Dupliquer une commande' })
    async dupliquerCommande(@Param('id') id: string) {
        return await this.commandeService.dupliquerCommande(id);
    }
}
