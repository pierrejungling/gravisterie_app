import { Repository } from 'typeorm';
import { Credential, Token, SignInPayload, RefreshTokenPayload } from '../model';
import { TokenService } from '../jwt';
export declare class SecurityService {
    private readonly repository;
    private readonly tokenService;
    constructor(repository: Repository<Credential>, tokenService: TokenService);
    detail(id: string): Promise<Credential>;
    signIn(payload: SignInPayload, isAdmin: boolean): Promise<Token | null>;
    private ensureLocalDevCredential;
    refresh(payload: RefreshTokenPayload): Promise<Token>;
}
