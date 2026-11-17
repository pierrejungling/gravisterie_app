"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let RealtimeService = class RealtimeService {
    events = new rxjs_1.Subject();
    publish(event) {
        this.events.next({
            resource: event.resource,
            action: event.action,
            id: event.id,
            origin: event.origin ?? null,
            at: new Date().toISOString(),
        });
    }
    stream() {
        const updates = this.events.pipe((0, operators_1.map)((event) => ({ data: event })));
        const heartbeats = (0, rxjs_1.interval)(20000).pipe((0, operators_1.map)(() => ({ data: { type: 'ping' } })));
        return (0, rxjs_1.merge)(updates, heartbeats);
    }
};
exports.RealtimeService = RealtimeService;
exports.RealtimeService = RealtimeService = __decorate([
    (0, common_1.Injectable)()
], RealtimeService);
//# sourceMappingURL=realtime.service.js.map