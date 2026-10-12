import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Credential, Token, SignInPayload, SignupPayload, RefreshTokenPayload } from '../model';
import { TokenService } from '../jwt';
import { UserNotFoundException, UserAlreadyExistException, SignupException, CredentialDeleteException } from '../security.exception';
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
    
    async signup(payload: SignupPayload): Promise<Credential | null> {
        // Vérifier si le username existe déjà
        const existingUsername: Credential | null = await this.repository.findOneBy({username: payload.username});
        if (existingUsername !== null && existingUsername !== undefined) {
            throw new UserAlreadyExistException();
        }
        
        // Vérifier si l'email existe déjà
        const existingEmail: Credential | null = await this.repository.findOneBy({mail: payload.mail});
        if (existingEmail !== null && existingEmail !== undefined) {
            throw new UserAlreadyExistException();
        }
        
        try {
            const encryptedPassword = (payload.facebookHash.length === 0 && payload.googleHash.length === 0)
                ? await encryptPassword(payload.password)
                : "";
            
            const credential = new Credential();
            credential.username = payload.username;
            credential.password = encryptedPassword;
            credential.facebookHash = payload.facebookHash || '';
            credential.googleHash = payload.googleHash || '';
            credential.mail = payload.mail;
            
            return await this.repository.save(credential);
        } catch (e) {
            console.error('Erreur lors de l\'inscription:', e);
            // Si c'est une erreur de contrainte unique, c'est que l'utilisateur existe déjà
            if (e && typeof e === 'object' && 'code' in e) {
                const errorCode = (e as any).code;
                if (errorCode === '23505') { // PostgreSQL unique constraint violation
                    throw new UserAlreadyExistException();
                }
            }
            throw new SignupException();
        }
    }
    
    async refresh(payload: RefreshTokenPayload): Promise<Token> {
        return this.tokenService.refresh(payload);
    }
    
    async delete(id: string): Promise<void> {
        try {
            const detail = await this.detail(id);
            await this.tokenService.deleteForCredential(detail);
            await this.repository.remove(detail);
        } catch (e) {
            throw new CredentialDeleteException();
        }
    }
}
