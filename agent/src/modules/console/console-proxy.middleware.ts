import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { ConsoleService } from './console.service';

/**
 * Middleware to proxy VNC/noVNC traffic to console containers
 * 
 * Route: /console/proxy/:sessionId/*
 * Proxies all requests to the container's noVNC port (5800)
 */
@Injectable()
export class ConsoleProxyMiddleware implements NestMiddleware {
    private readonly logger = new Logger(ConsoleProxyMiddleware.name);
    private readonly proxyCache = new Map<string, ReturnType<typeof createProxyMiddleware>>();

    constructor(private readonly consoleService: ConsoleService) { }

    use(req: Request, res: Response, next: NextFunction) {
        // Extract session ID from path: /console/proxy/:sessionId/...
        const pathMatch = req.originalUrl.match(/\/console\/proxy\/([^\/]+)/);
        if (!pathMatch) {
            return next();
        }

        const sessionId = pathMatch[1];
        const session = this.consoleService.getSessionStatus(sessionId);

        if (!session) {
            this.logger.warn(`Session not found: ${sessionId}`);
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session.status !== 'active') {
            this.logger.warn(`Session not active: ${sessionId} (status: ${session.status})`);
            return res.status(400).json({ error: 'Session not active' });
        }

        // Get or create proxy for this session
        let proxy = this.proxyCache.get(sessionId);
        if (!proxy) {
            const target = `http://127.0.0.1:${session.port}`;
            this.logger.log(`Creating proxy for session ${sessionId} -> ${target}`);

            const proxyOptions: Options = {
                target,
                changeOrigin: true,
                ws: true, // Enable WebSocket proxying for noVNC
                pathRewrite: {
                    [`^/console/proxy/${sessionId}`]: '', // Strip prefix
                },
                on: {
                    proxyReq: (proxyReq, req) => {
                        this.logger.debug(`Proxying ${req.method} ${req.url} -> ${target}`);
                    },
                    error: (err, req, res) => {
                        this.logger.error(`Proxy error: ${err.message}`);
                        if (res && 'writeHead' in res) {
                            (res as Response).status(502).json({ error: 'Proxy error' });
                        }
                    },
                },
            };

            proxy = createProxyMiddleware(proxyOptions);
            this.proxyCache.set(sessionId, proxy);
        }

        // Update heartbeat on any activity
        this.consoleService.updateHeartbeat(sessionId);

        // Execute proxy
        return proxy(req, res, next);
    }

    /**
     * Remove cached proxy when session ends
     */
    removeProxy(sessionId: string): void {
        this.proxyCache.delete(sessionId);
    }
}
