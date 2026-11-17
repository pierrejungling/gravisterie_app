export declare const encryptPassword: (plaintextPassword: string) => Promise<string>;
export declare const comparePassword: (plaintextPassword: string, hash: string) => Promise<boolean>;
