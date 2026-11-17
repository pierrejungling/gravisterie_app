import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RealtimeAction, RealtimeResource } from './realtime.event';
export declare class RealtimeService {
    private readonly events;
    publish(event: {
        resource: RealtimeResource;
        action: RealtimeAction;
        id?: string;
        origin?: string | null;
    }): void;
    stream(): Observable<MessageEvent>;
}
