import { RefreshTokenPayload, SignInPayload, Credential } from './model';
import { SecurityService } from './service';
export declare class SecurityController {
    private readonly service;
    constructor(service: SecurityService);
    signIn(payload: SignInPayload): Promise<import("./model").Token | null>;
    refresh(payload: RefreshTokenPayload): Promise<import("./model").Token>;
    me(user: Credential): Credential;
}
