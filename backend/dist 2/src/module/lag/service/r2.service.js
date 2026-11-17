"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2Service = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
const r2_config_1 = require("../config/r2.config");
let R2Service = class R2Service {
    client = null;
    bucket = '';
    getClient() {
        if (!this.client) {
            const config = (0, r2_config_1.getR2ConfigOrThrow)();
            this.bucket = config.bucket;
            this.client = new client_s3_1.S3Client({
                region: 'auto',
                endpoint: config.endpoint,
                credentials: {
                    accessKeyId: config.accessKeyId,
                    secretAccessKey: config.secretAccessKey,
                },
            });
        }
        return this.client;
    }
    getBucket() {
        if (!this.bucket)
            this.getClient();
        return this.bucket;
    }
    async upload(key, body, contentType) {
        const client = this.getClient();
        const bucket = this.getBucket();
        await client.send(new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType || 'application/octet-stream',
        }));
        return key;
    }
    async getStream(key) {
        const client = this.getClient();
        const bucket = this.getBucket();
        const response = await client.send(new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!response.Body) {
            throw new Error('Fichier introuvable dans R2');
        }
        return {
            stream: response.Body,
            contentType: response.ContentType ?? undefined,
        };
    }
    async delete(key) {
        const client = this.getClient();
        const bucket = this.getBucket();
        await client.send(new client_s3_1.DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
};
exports.R2Service = R2Service;
exports.R2Service = R2Service = __decorate([
    (0, common_1.Injectable)()
], R2Service);
//# sourceMappingURL=r2.service.js.map