import { Module } from '@nestjs/common';
import { LagModule } from '../lag/lag.module';
import { McpController } from './mcp.controller';
import { McpTools } from './mcp.tools';

/**
 * Connecteur MCP pour Claude (lecture seule).
 * Réutilise les services du module LAG sans les modifier.
 */
@Module({
    imports: [LagModule],
    controllers: [McpController],
    providers: [McpTools],
})
export class McpModule {}
