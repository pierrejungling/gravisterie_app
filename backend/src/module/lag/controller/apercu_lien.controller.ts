import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApercuLienService } from '../service/apercu_lien.service';
import { ImageApercuLienPayload } from '../model/payload/apercu_lien.payload';

@ApiBearerAuth('access-token')
@ApiTags('Aperçu de lien')
@Controller('apercu-lien')
export class ApercuLienController {
    constructor(private readonly apercuService: ApercuLienService) {}

    @Get()
    @ApiOperation({ summary: "Image et titre d'un lien (frais, support acheté)" })
    async getApercu(@Query('url') url: string, @Query('forcer') forcer?: string) {
        return await this.apercuService.getApercu(url, forcer === '1' || forcer === 'true');
    }

    @Put('image')
    @ApiOperation({ summary: "Choisir l'image d'un lien à la main (vide = image automatique)" })
    async setImage(@Body() payload: ImageApercuLienPayload) {
        return await this.apercuService.setImage(payload.url, payload.image);
    }
}
