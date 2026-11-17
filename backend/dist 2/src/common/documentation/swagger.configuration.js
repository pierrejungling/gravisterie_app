"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerConfiguration = void 0;
const swagger_1 = require("@nestjs/swagger");
class SwaggerConfiguration {
    constructor() {
    }
    config(app) {
        const config = new swagger_1.DocumentBuilder()
            .setTitle('NestJS API')
            .setDescription('NestJS swagger document')
            .setVersion('1.0')
            .addBearerAuth({
            description: `Please enter token`,
            name: 'Authorization',
            bearerFormat: 'Bearer',
            scheme: 'Bearer',
            type: 'http',
            in: 'Header'
        }, 'access-token')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('docs', app, document);
    }
}
const swaggerConfiguration = new SwaggerConfiguration();
exports.swaggerConfiguration = swaggerConfiguration;
//# sourceMappingURL=swagger.configuration.js.map