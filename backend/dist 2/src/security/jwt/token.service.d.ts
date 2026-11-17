import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Credential, Token, RefreshTokenPayload } from '../model';
export declare class TokenService {
    private readonly repository;
    private readonly credentialRepository;
    private jwtService;
    private readonly logger;
    constructor(repository: Repository<Token>, credentialRepository: Repository<Credential>, jwtService: JwtService);
    getTokens(credential: Credential): Promise<Token>;
    refresh(payload: RefreshTokenPayload): Promise<Token>;
}
