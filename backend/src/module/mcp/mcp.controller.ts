import { All, Body, Controller, Headers, Logger, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { Public } from '@common/config/metadata/public.metadata';
import { McpTools } from './mcp.tools';

/**
 * Serveur MCP (Model Context Protocol) minimal, transport "Streamable HTTP"
 * en mode sans état : chaque requête POST JSON-RPC reçoit une réponse JSON.
 *
 * - Route : POST {APP_BASE_URL}/mcp  (ex. https://api.gravisterie.be/api/mcp)
 * - Auth  : en-tête "Authorization: Bearer <MCP_TOKEN>" (variable d'environnement).
 *           Si MCP_TOKEN n'est pas défini, le endpoint est désactivé (503).
 * - La route est marquée @Public() pour contourner le JwtGuard de l'app admin :
 *   elle a sa propre authentification par token, indépendante des comptes.
 * - On répond via @Res() pour ne pas passer dans l'ApiInterceptor (qui
 *   envelopperait la réponse dans { code, data, result } et casserait JSON-RPC).
 */

const VERSIONS_SUPPORTEES = ['2025-06-18', '2025-03-26', '2024-11-05'];

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: JsonRpcId;
    method: string;
    params?: any;
}

@ApiExcludeController()
@Controller('mcp')
export class McpController {
    private readonly logger = new Logger(McpController.name);

    constructor(private readonly tools: McpTools) {}

    @Public()
    @Post()
    async handle(
        @Body() body: any,
        @Headers('authorization') authorization: string | undefined,
        @Res() res: Response,
    ): Promise<void> {
        const auth = this.verifierToken(authorization);
        if (auth !== 'ok') {
            res.status(auth === 'desactive' ? 503 : 401).json({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32001, message: auth === 'desactive' ? 'MCP désactivé (MCP_TOKEN absent)' : 'Non autorisé' },
            });
            return;
        }

        const messages: JsonRpcRequest[] = Array.isArray(body) ? body : [body];
        if (!messages.length || messages.some((m) => !m || m.jsonrpc !== '2.0' || typeof m.method !== 'string')) {
            res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Requête JSON-RPC invalide' } });
            return;
        }

        const reponses = (await Promise.all(messages.map((m) => this.traiter(m)))).filter((r) => r !== null);

        // Uniquement des notifications : pas de corps de réponse.
        if (!reponses.length) {
            res.status(202).end();
            return;
        }
        res.status(200).json(Array.isArray(body) ? reponses : reponses[0]);
    }

    /** Le mode sans état n'ouvre pas de flux SSE ni de session (GET/DELETE). */
    @Public()
    @All()
    nonSupporte(@Res() res: Response): void {
        res.status(405).setHeader('Allow', 'POST').json({
            jsonrpc: '2.0',
            id: null,
            error: { code: -32000, message: 'Méthode non autorisée' },
        });
    }

    private async traiter(message: JsonRpcRequest): Promise<object | null> {
        const estNotification = message.id === undefined;
        const id = message.id ?? null;

        try {
            switch (message.method) {
                case 'initialize': {
                    const demandee = message.params?.protocolVersion;
                    return this.resultat(id, {
                        protocolVersion: VERSIONS_SUPPORTEES.includes(demandee) ? demandee : VERSIONS_SUPPORTEES[0],
                        capabilities: { tools: { listChanged: false } },
                        serverInfo: { name: 'gravisterie', title: 'La Gravisterie', version: '1.0.0' },
                        instructions:
                            "Accès en lecture seule à l'application admin de La Gravisterie (atelier de gravure et découpe laser de Pierre Jungling) : commandes et Kanban, clients, bons cadeaux, frais/commissions. Commence par resume_activite pour une vue d'ensemble.",
                    });
                }
                case 'ping':
                    return estNotification ? null : this.resultat(id, {});
                case 'tools/list':
                    return this.resultat(id, { tools: this.tools.definitions });
                case 'tools/call': {
                    const nom = message.params?.name;
                    if (typeof nom !== 'string') return this.erreur(id, -32602, 'Paramètre "name" manquant');
                    this.logger.log(`Outil MCP appelé : ${nom}`);
                    return this.resultat(id, await this.tools.call(nom, message.params?.arguments ?? {}));
                }
                default:
                    if (estNotification) return null; // ex. notifications/initialized
                    return this.erreur(id, -32601, `Méthode inconnue : ${message.method}`);
            }
        } catch (e: any) {
            this.logger.error(`Erreur MCP (${message.method}) : ${e?.message}`);
            if (message.method === 'tools/call') {
                return this.resultat(id, { content: [{ type: 'text', text: `Erreur : ${e?.message ?? 'inconnue'}` }], isError: true });
            }
            return estNotification ? null : this.erreur(id, -32603, 'Erreur interne');
        }
    }

    private resultat(id: JsonRpcId, result: unknown) {
        return { jsonrpc: '2.0', id, result };
    }

    private erreur(id: JsonRpcId, code: number, message: string) {
        return { jsonrpc: '2.0', id, error: { code, message } };
    }

    private verifierToken(authorization: string | undefined): 'ok' | 'refuse' | 'desactive' {
        const attendu = process.env.MCP_TOKEN?.trim();
        if (!attendu) return 'desactive';
        const recu = (authorization ?? '').replace(/^Bearer\s+/i, '').trim();
        const a = Buffer.from(recu);
        const b = Buffer.from(attendu);
        return a.length === b.length && timingSafeEqual(a, b) ? 'ok' : 'refuse';
    }
}
