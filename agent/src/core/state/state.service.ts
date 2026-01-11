import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PanelClientService, AgentSyncResponse } from '../client/panel-client.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import { BehaviorSubject, Observable } from 'rxjs';

const CACHE_FILE = 'agent-cache.json';

@Injectable()
export class StateService implements OnModuleInit {
    private readonly logger = new Logger(StateService.name);
    private readonly cachePath = path.join(process.cwd(), CACHE_FILE);

    // Observable state for other modules to subscribe to
    private state$ = new BehaviorSubject<AgentSyncResponse['config'] | null>(null);

    constructor(private readonly panelClient: PanelClientService) { }

    async onModuleInit() {
        await this.loadCache();
        this.startPolling();
    }

    getConfig(): Observable<AgentSyncResponse['config'] | null> {
        return this.state$.asObservable();
    }

    getCurrentConfig(): AgentSyncResponse['config'] | null {
        return this.state$.getValue();
    }

    private async loadCache() {
        try {
            if (await fs.pathExists(this.cachePath)) {
                const cached = await fs.readJson(this.cachePath);
                this.logger.log(`Loaded state from cache: ${this.cachePath}`);
                this.state$.next(cached);
            } else {
                this.logger.log('No local cache found, starting empty.');
            }
        } catch (e) {
            this.logger.error('Failed to load local cache', e);
        }
    }

    private async saveCache(config: AgentSyncResponse['config']) {
        try {
            await fs.writeJson(this.cachePath, config);
            this.logger.debug('Saved state to cache');
        } catch (e) {
            this.logger.error('Failed to save local cache', e);
        }
    }

    private startPolling() {
        // Initial sync
        this.sync();
        // Poll every 30 seconds
        setInterval(() => this.sync(), 30000);
    }

    private async sync() {
        const data = await this.panelClient.syncState();
        if (data) {
            const currentHash = JSON.stringify(this.state$.getValue());
            const newHash = JSON.stringify(data.config);

            if (currentHash !== newHash) {
                this.logger.log('Configuration changed, updating state.');
                this.state$.next(data.config);
                await this.saveCache(data.config);
            }

            // TODO: Handle jobs (data.jobs)
        }
    }
}
