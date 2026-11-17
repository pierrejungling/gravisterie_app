declare function getR2Config(): {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint: string;
};
export declare function isR2Configured(): boolean;
export declare function getR2ConfigOrThrow(): ReturnType<typeof getR2Config>;
export {};
