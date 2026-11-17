import { Readable } from 'stream';
export declare class R2Service {
    private client;
    private bucket;
    private getClient;
    private getBucket;
    upload(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<string>;
    getStream(key: string): Promise<{
        stream: Readable;
        contentType?: string;
    }>;
    delete(key: string): Promise<void>;
}
