import { Payload } from '@shared';

export interface SignInPayload extends Payload {
  username: string;
  password: string;
  googleHash: string;
  facebookHash: string;
  socialLogin: boolean;
}
