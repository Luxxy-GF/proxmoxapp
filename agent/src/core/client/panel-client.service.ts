import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface AgentSyncResponse {
    config: {
        dhcp: any;
        pxe: any;
    };
    jobs: any[];
}

@Injectable()
export class PanelClientService {
    private readonly logger = new Logger(PanelClientService.name);
    private readonly panelUrl: string;
    private readonly agentToken: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.panelUrl = this.configService.get<string>('PANEL_URL');
        this.agentToken = this.configService.get<string>('AGENT_TOKEN');

        if (!this.panelUrl || !this.agentToken) {
            this.logger.error('Missing PANEL_URL or AGENT_TOKEN configuration');
        }
    }

    async syncState(): Promise<AgentSyncResponse | null> {
        try {
            const response = await firstValueFrom(
                this.httpService.get<AgentSyncResponse>(`${this.panelUrl}/api/baremetal/agent/sync`, {
                    headers: {
                        'X-Agent-Token': this.agentToken,
                        'User-Agent': 'Luxxy-Agent/1.0',
                    },
                    timeout: 5000,
                }),
            );
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                this.logger.warn(`Failed to sync with panel: ${error.message}`);
            } else {
                this.logger.error(`Unknown error syncing with panel`, error);
            }
            return null;
        }
    }

    async reportJobStatus(jobId: string, status: string, log?: string): Promise<void> {
        try {
            await firstValueFrom(
                this.httpService.post(`${this.panelUrl}/api/baremetal/agent/jobs/${jobId}`, { status, log }, {
                    headers: {
                        'X-Agent-Token': this.agentToken
                    }
                })
            );
        } catch (e) {
            this.logger.error(`Failed to report job status for ${jobId}`, e);
        }
    }

    async reportPxeInstallState(token: string, state: 'RUNNING' | 'DONE' | 'FAILED', log?: string): Promise<boolean> {
        try {
            await firstValueFrom(
                this.httpService.post(`${this.panelUrl}/api/baremetal/agent/jobs/pxe`, {
                    type: 'pxe_install_state',
                    token,
                    state,
                    log
                }, {
                    headers: {
                        'X-Agent-Token': this.agentToken
                    }
                })
            );
            this.logger.log(`Reported PXE state ${state} for token ${token.substring(0, 8)}...`);
            return true;
        } catch (e) {
            this.logger.error(`Failed to report PXE install state for token ${token}`, e);
            return false;
        }
    }
}
