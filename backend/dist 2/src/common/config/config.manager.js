"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = void 0;
const enum_1 = require("./enum");
require('dotenv').config();
class ConfigManager {
    env;
    constructor(env) {
        this.env = env;
    }
    ensureValues(keys) {
        keys.forEach((k) => this.getValue(k, true));
        return this;
    }
    getTypeOrmConfig() {
        return {
            type: this.getValue(enum_1.ConfigKey.DB_TYPE),
            host: this.getValue(enum_1.ConfigKey.DB_HOST),
            port: parseInt(this.getValue(enum_1.ConfigKey.DB_PORT)),
            username: this.getValue(enum_1.ConfigKey.DB_USER),
            password: this.getValue(enum_1.ConfigKey.DB_PASSWORD),
            database: this.getValue(enum_1.ConfigKey.DB_DATABASE),
            entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
            synchronize: (this.getValue(enum_1.ConfigKey.DB_SYNC) === 'true'),
        };
    }
    getValue(key, throwOnMissing = true) {
        const value = this.env[key];
        if (!value && throwOnMissing) {
            throw new Error(`config error - missing env.${key}`);
        }
        return value || '';
    }
}
const configManager = new ConfigManager(process.env).ensureValues(enum_1.configMinimalKeys);
exports.configManager = configManager;
//# sourceMappingURL=config.manager.js.map