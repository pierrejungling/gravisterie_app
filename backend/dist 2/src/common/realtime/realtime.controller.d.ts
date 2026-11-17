import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';
export declare class RealtimeController {
    private readonly realtime;
    constructor(realtime: RealtimeService);
    stream(): Observable<MessageEvent>;
}
