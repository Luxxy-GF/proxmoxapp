import jwt from "jsonwebtoken"
import { Node } from "@prisma/client"

export interface ConsoleTokenPayload {
    serverId: string
    server_uuid: string
    userId: string
    vmid: number
    node: string
    type: "qemu" | "lxc"
    console_type: "xtermjs" | "novnc"
}

/**
 * Generate a JWT token for coterm console authentication
 * @param payload - Console token payload containing server and user information
 * @param secret - JWT secret from the node configuration
 * @param expiresIn - Token expiration time (default: 1 hour)
 * @returns Signed JWT token
 */
export function generateConsoleToken(
    payload: ConsoleTokenPayload,
    secret: string,
    expiresIn: any = "1h"
): string {
    return jwt.sign(payload, secret, {
        expiresIn,
        algorithm: "HS256"
    })
}

/**
 * Verify and decode a coterm console token
 * @param token - JWT token to verify
 * @param secret - JWT secret from the node configuration
 * @returns Decoded token payload
 */
export function verifyConsoleToken(
    token: string,
    secret: string
): ConsoleTokenPayload {
    return jwt.verify(token, secret, {
        algorithms: ["HS256"]
    }) as ConsoleTokenPayload
}
