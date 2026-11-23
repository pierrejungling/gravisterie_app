import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Bucket R2 public du site vitrine (images et fichiers de données).
 * Variables : R2_SITE_BUCKET_NAME (défaut gravisterie-site), R2_SITE_PUBLIC_URL,
 * et R2_SITE_ACCESS_KEY_ID / R2_SITE_SECRET_ACCESS_KEY (sinon celles du bucket des commandes).
 */
@Injectable()
export class SiteR2Service {
    private client: S3Client | null = null;

    get bucket(): string {
        return process.env.R2_SITE_BUCKET_NAME || 'gravisterie-site';
    }

    /** Adresse publique du bucket, sans slash final. */
    get publicUrl(): string {
        return (process.env.R2_SITE_PUBLIC_URL || '').replace(/\/+$/, '');
    }

    estConfigure(): boolean {
        return !!(process.env.R2_ACCOUNT_ID && this.accessKey() && this.secretKey() && this.publicUrl);
    }

    private accessKey() {
        return process.env.R2_SITE_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
    }
    private secretKey() {
        return process.env.R2_SITE_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
    }

    private getClient(): S3Client {
        if (!this.client) {
            if (!process.env.R2_ACCOUNT_ID || !this.accessKey() || !this.secretKey()) {
                throw new Error('R2 du site non configuré (R2_ACCOUNT_ID, R2_SITE_ACCESS_KEY_ID, R2_SITE_SECRET_ACCESS_KEY)');
            }
            this.client = new S3Client({
                region: 'auto',
                endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                credentials: { accessKeyId: this.accessKey(), secretAccessKey: this.secretKey() },
            });
        }
        return this.client;
    }

    async put(key: string, body: Buffer | string, contentType: string, cacheControl: string): Promise<void> {
        await this.getClient().send(
            new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }),
        );
    }

    async delete(key: string): Promise<void> {
        await this.getClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }

    /** Adresse publique complète d'une clé. */
    url(key: string): string {
        return `${this.publicUrl}/${key}`;
    }
}
