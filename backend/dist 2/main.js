"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/home/app.module");
const config_1 = require("./src/common/config");
const documentation_1 = require("./src/common/documentation");
const common_1 = require("@nestjs/common");
const api_1 = require("./src/common/api");
const bootstrap = async () => {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: [
            'https://admin.gravisterie.be',
            'http://localhost:4200',
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id'],
    });
    app.setGlobalPrefix(config_1.configManager.getValue(config_1.ConfigKey.APP_BASE_URL));
    documentation_1.swaggerConfiguration.config(app);
    app.useGlobalFilters(new config_1.HttpExceptionFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({
        exceptionFactory: (validationErrors = []) => new api_1.ValidationException(validationErrors)
    }));
    app.useGlobalInterceptors(new api_1.ApiInterceptor());
    await app.listen(parseInt(config_1.configManager.getValue(config_1.ConfigKey.APP_PORT), 10));
};
bootstrap().then(() => {
    const logger = new common_1.Logger('Main Logger');
    logger.log('Server is started !!');
});
//# sourceMappingURL=main.js.map