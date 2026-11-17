import { Credential } from './Credential.entity';
export declare class Token {
    token_id: string;
    token: string;
    refreshToken: string;
    credential: Credential;
}
