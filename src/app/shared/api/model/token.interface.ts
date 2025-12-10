import { IsEmpty } from '@shared';

export interface Token extends IsEmpty {
  token: string;
  refreshToken: string;
}
