import { Controller, Header, MessageEvent, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';

@ApiBearerAuth('access-token')
@ApiTags('Events')
@Controller('events')
export class RealtimeController {
    constructor(private readonly realtime: RealtimeService) {}

    @Sse()
    @Header('Cache-Control', 'no-cache, no-transform')
    @Header('X-Accel-Buffering', 'no')
    @Header('Connection', 'keep-alive')
    @ApiOperation({ summary: 'Flux des modifications (commandes, bons, frais)' })
    stream(): Observable<MessageEvent> {
        return this.realtime.stream();
    }
}
