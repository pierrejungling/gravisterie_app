import { ApiCodeResponse } from './api-code-response.enum';

export interface ApiResponse {
  result: boolean;
  code: ApiCodeResponse;
  data: any;
  paramError: boolean;
}

