import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Credential, Token, SignInPayload, RefreshTokenPayload } from '../model';
import { TokenService } from '../jwt';
import { UserNotFoundException } from '../security.exception';
import { encryptPassword, comparePassword } from '../utils';
import {
    LOCAL_DEV_CREDENTIALS,
    isLocalDevCredential,
    isLocalDevMode,
} from '../utils/local-dev-credentials';

@Injectable()
export class SecurityService {
    
    constructor(@InjectRepository(Credential) private readonly repository: Repository<Credential>,
        private readonly tokenService: TokenService) {
    }
    
    async detail(id: string): Promise<Credential> {
        const result = await this.repository.findOneBy({credential_id: id});
        if (result !== null && result !== undefined) {
            return result;
        }
        throw new UserNotFoundException();
    }
    
    async signIn(payload: SignInPayload, isAdmin: boolean): Promise<Token | null> {
        let result: Credential | null = null;
        
        if (payload.socialLogin) {
            if (payload.facebookHash !== null && payload.facebookHash !== undefined && payload.facebookHash.length > 0) {
                result = await this.repository.findOneBy({facebookHash: payload.facebookHash});
            } else if (payload.googleHash !== null && payload.googleHash !== undefined && payload.googleHash.length > 0) {
                result = await this.repository.findOneBy({googleHash: payload.googleHash});
            }
        } else {
            // Compte test/test : uniquement en APP_MODE=development (local)
            if (isLocalDevCredential(payload.username)) {
                if (!isLocalDevMode() || payload.password !== LOCAL_DEV_CREDENTIALS.password) {
                    throw new UserNotFoundException();
                }
                result = await this.ensureLocalDevCredential();
                return this.tokenService.getTokens(result);
            }

            // Recherche par username uniquement (pas de filtre isAdmin pour simplifier)
            result = await this.repository.findOneBy({username: payload.username});
        }
        
        if (result !== null && result !== undefined) {
            // Bloquer le compte local hors mode développement
            if (isLocalDevCredential(result.username) && !isLocalDevMode()) {
                throw new UserNotFoundException();
            }

            if (payload.socialLogin) {
                return this.tokenService.getTokens(result);
            } else {
                // Vérifier que le mot de passe existe
                if (!result.password || result.password.length === 0) {
                    throw new UserNotFoundException();
                }
                const passwordMatch = await comparePassword(payload.password, result.password);
                if (passwordMatch) {
                    return this.tokenService.getTokens(result);
                }
            }
        }
        
        throw new UserNotFoundException();
    }

    /** Crée ou récupère le compte local hardcodé (test/test). */
    private async ensureLocalDevCredential(): Promise<Credential> {
        let credential = await this.repository.findOneBy({
            username: LOCAL_DEV_CREDENTIALS.username,
        });

        if (credential) {
            return credential;
        }

        credential = new Credential();
        credential.username = LOCAL_DEV_CREDENTIALS.username;
        credential.password = await encryptPassword(LOCAL_DEV_CREDENTIALS.password);
        credential.mail = LOCAL_DEV_CREDENTIALS.mail;
        credential.facebookHash = '';
        credential.googleHash = '';
        credential.isAdmin = true;
        credential.active = true;
        return this.repository.save(credential);
    }
    
    async refresh(payload: RefreshTokenPayload): Promise<Token> {
        return this.tokenService.refresh(payload);
    }
}
