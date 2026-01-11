import { Controller, Post, Delete, Get, Param, Body, HttpCode, Logger, UseGuards } from '@nestjs/common';
import { ConsoleService } from './console.service';
import { ConsoleSessionRequest, ConsoleHeartbeat } from './console.types';

@Controller('console')
export class ConsoleController {
    private readonly logger = new Logger(ConsoleController.name);

    constructor(private readonly consoleService: ConsoleService) { }

    /**
     * Start a new console session
     * Called by Panel when user requests console access
     */
    @Post('session')
    async startSession(@Body() request: ConsoleSessionRequest) {
        this.logger.log(`Console session request for server: ${request.serverId}`);
        return this.consoleService.startConsoleSession(request);
    }

    /**
     * Stop a console session
     * Called by Panel when session should be terminated
     */
    @Delete('session/:sessionId')
    @HttpCode(204)
    async stopSession(@Param('sessionId') sessionId: string) {
        this.logger.log(`Stopping console session: ${sessionId}`);
        await this.consoleService.stopConsoleSession(sessionId);
    }

    /**
     * Get session status
     */
    @Get('session/:sessionId')
    getSessionStatus(@Param('sessionId') sessionId: string) {
        const status = this.consoleService.getSessionStatus(sessionId);
        if (!status) {
            return { found: false };
        }
        return { found: true, ...status };
    }

    /**
     * List all active sessions
     */
    @Get('sessions')
    listSessions() {
        return this.consoleService.listActiveSessions();
    }

    /**
     * Heartbeat to keep session alive
     */
    @Post('session/:sessionId/heartbeat')
    heartbeat(@Param('sessionId') sessionId: string) {
        const success = this.consoleService.updateHeartbeat(sessionId);
        return { success };
    }
}
