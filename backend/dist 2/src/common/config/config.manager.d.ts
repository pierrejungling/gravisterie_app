import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigKey } from "./enum";
declare class ConfigManager {
    private env;
    constructor(env: {
        [k: string]: string | undefined;
    });
    ensureValues(keys: ConfigKey[]): ConfigManager;
    getTypeOrmConfig(): TypeOrmModuleOptions;
    getValue(key: ConfigKey, throwOnMissing?: boolean): string;
}
declare const configManager: ConfigManager;
export { configManager };
