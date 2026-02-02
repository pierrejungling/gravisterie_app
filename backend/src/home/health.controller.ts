import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Public } from '@common/config/metadata/public.metadata';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource
    ) {}

    @Public()
    @Get()
    @ApiOperation({
        summary: 'Health check',
        description: 'Vérifie le statut de santé de l\'API et de la base de données'
    })
    @ApiResponse({
        status: 200,
        description: 'L\'API et la base de données sont opérationnelles'
    })
    async getHealth() {
        const dbStatus = await this.checkDatabase();
        
        return {
            status: dbStatus ? 'ok' : 'error',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbStatus ? 'connected' : 'disconnected',
            environment: process.env.NODE_ENV || 'development'
        };
    }

    private async checkDatabase(): Promise<boolean> {
        try {
            await this.dataSource.query('SELECT 1');
            return true;
        } catch (error) {
            return false;
        }
    }
}
