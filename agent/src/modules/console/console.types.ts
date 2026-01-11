// Console Types for IPMI remote console sessions

export interface ConsoleCredentials {
    host: string;
    username: string;
    password: string;
    port?: number;
}

export interface ConsoleSessionRequest {
    serverId: string;
    consoleType: 'web' | 'java';
    token: string;
    expiresAt: string;
    credentials: ConsoleCredentials;
}

export interface ConsoleSessionResponse {
    sessionId: string;
    containerId: string;
    containerPort: number;
    status: 'starting' | 'active' | 'error';
    message?: string;
}

export interface ContainerInfo {
    containerId: string;
    sessionId: string;
    serverId: string;
    port: number;
    status: string;
    createdAt: Date;
    expiresAt: Date;
    tempUserId?: number;
    tempUsername?: string;
    originalCredentials?: ConsoleCredentials;
}

export interface ConsoleHeartbeat {
    sessionId: string;
    token: string;
}
