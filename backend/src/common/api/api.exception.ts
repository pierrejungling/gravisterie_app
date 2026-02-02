import {HttpException} from '@nestjs/common';
import {ApiCodeResponse} from './api-code-response.enum';
import { ValidationError } from 'class-validator';
import { isNil } from 'lodash';

export class ApiException extends HttpException{
    constructor(code:ApiCodeResponse, status:number) {
        super({
            code: code,
            data: null,
            result: false
        }, status);
    }
}

export class ValidationException extends HttpException{
    constructor(errors:ValidationError[]) {
        super({
            code: ApiCodeResponse.PAYLOAD_IS_NOT_VALID,
            data: errors.map((e) => validationErrorToApiCodeResponse(e)).flat(),
            result: false
        }, 499);
    }
    }

export const validationErrorToApiCodeResponse = (error: ValidationError): ApiCodeResponse[] => {
    if (isNil(error.constraints)) {
        return [];
    }
    const keys: string[] = Object.keys(error.constraints as { [type: string]: string });
    return keys.map((k: string) => {
        const code = ApiCodeResponse[`${camelToSnake(error.property)}_${camelToSnake(k)}` as keyof typeof ApiCodeResponse];
        return isNil(code) ? ApiCodeResponse.PAYLOAD_PARAM_IS_MISSING : code;
    });
}

export const camelToSnake = (str: string): string => {
    return str.replace(/([A-Z])/g, " $1").split(' ').join('_').toUpperCase();
}