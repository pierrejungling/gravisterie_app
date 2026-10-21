import { Injectable, MessageEvent } from '@nestjs/common';
import { interval, merge, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { RealtimeAction, RealtimeEvent, RealtimeResource } from './realtime.event';

@Injectable()
export class RealtimeService {
    private readonly events = new Subject<RealtimeEvent>();

    publish(event: {
        resource: RealtimeResource;
        action: RealtimeAction;
        id?: string;
        origin?: string | null;
    }): void {
        this.events.next({
            resource: event.resource,
            action: event.action,
            id: event.id,
            origin: event.origin ?? null,
            at: new Date().toISOString(),
        });
    }

    stream(): Observable<MessageEvent> {
        const updates = this.events.pipe(
            map((event) => ({ data: event }) as MessageEvent),
        );
        const heartbeats = interval(20000).pipe(
            map(() => ({ data: { type: 'ping' } }) as MessageEvent),
        );
        return merge(updates, heartbeats);
    }
}
