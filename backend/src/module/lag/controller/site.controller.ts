import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RealtimeService } from '@common/realtime';
import { SiteService } from '../service/site.service';
import { SiteImagesPayload, SiteItemPayload, SiteOrdrePayload } from '../model/payload';

@ApiBearerAuth('access-token')
@ApiTags('Site vitrine')
@Controller('site')
export class SiteController {
    constructor(
        private readonly site: SiteService,
        private readonly realtime: RealtimeService,
    ) {}

    @Get('items')
    @ApiOperation({ summary: 'Produits et projets du site (type=produit|projet pour filtrer)' })
    lister(@Query('type') type?: 'produit' | 'projet') {
        return this.site.lister(type);
    }

    @Get('resume')
    @ApiOperation({ summary: 'Nombre de produits, projets, fiches masquées et sans photo' })
    resume() {
        return this.site.resume();
    }

    @Get('categories')
    @ApiOperation({ summary: 'Catégories utilisées, avec le nombre de fiches' })
    categories() {
        return this.site.categories();
    }

    @Get('items/:id')
    obtenir(@Param('id') id: string) {
        return this.site.obtenir(id);
    }

    @Post('items')
    @ApiOperation({ summary: 'Créer un produit ou un projet' })
    async creer(@Body() payload: SiteItemPayload, @Headers('x-client-id') origin?: string) {
        const item = await this.site.creer(payload);
        this.realtime.publish({ resource: 'site', action: 'created', id: item.id, origin });
        return item;
    }

    @Put('items/ordre')
    @ApiOperation({ summary: "Enregistrer l'ordre d'affichage" })
    async ordre(@Body() payload: SiteOrdrePayload, @Headers('x-client-id') origin?: string) {
        await this.site.reordonner(payload.ids);
        this.realtime.publish({ resource: 'site', action: 'updated', origin });
        return { ok: true };
    }

    @Put('items/:id')
    @ApiOperation({ summary: 'Modifier (nom, catégories, visibilité, champs libres...). `base` = version ouverte, 409 si périmée.' })
    async modifier(@Param('id') id: string, @Body() payload: SiteItemPayload, @Headers('x-client-id') origin?: string) {
        const item = await this.site.modifier(id, payload);
        this.realtime.publish({ resource: 'site', action: 'updated', id, origin });
        return item;
    }

    @Delete('items/:id')
    async supprimer(@Param('id') id: string, @Headers('x-client-id') origin?: string) {
        await this.site.supprimer(id);
        this.realtime.publish({ resource: 'site', action: 'deleted', id, origin });
        return { ok: true };
    }

    @Post('items/:id/images')
    @ApiOperation({ summary: 'Ajouter des photos (optimisées en WebP et envoyées sur R2)' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FilesInterceptor('files', 30, { limits: { fileSize: 40 * 1024 * 1024 } }))
    async ajouterImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Headers('x-client-id') origin?: string) {
        const item = await this.site.ajouterImages(id, files ?? []);
        this.realtime.publish({ resource: 'site', action: 'updated', id, origin });
        return item;
    }

    @Put('items/:id/images')
    @ApiOperation({ summary: 'Ordre des photos ; une photo absente de la liste est supprimée' })
    async definirImages(@Param('id') id: string, @Body() payload: SiteImagesPayload, @Headers('x-client-id') origin?: string) {
        const item = await this.site.definirImages(id, payload.images);
        this.realtime.publish({ resource: 'site', action: 'updated', id, origin });
        return item;
    }

    @Post('publier')
    @ApiOperation({ summary: 'Régénérer products-data.js et projects-data.js sur R2 (automatique après chaque modification)' })
    publier() {
        return this.site.publier();
    }
}
