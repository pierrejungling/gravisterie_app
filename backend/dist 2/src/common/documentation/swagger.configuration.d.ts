import { INestApplication } from '@nestjs/common';
declare class SwaggerConfiguration {
    constructor();
    config(app: INestApplication<any>): void;
}
declare const swaggerConfiguration: SwaggerConfiguration;
export { swaggerConfiguration };
