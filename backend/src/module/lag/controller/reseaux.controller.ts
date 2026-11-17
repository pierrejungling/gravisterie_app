import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
}
