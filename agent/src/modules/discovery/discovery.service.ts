import { Injectable, Logger } from '@nestjs/common';
import { ShellService } from '../../core/shell/shell.service';
import { PanelClientService } from '../../core/client/panel-client.service';
import { Cron, CronExpression } from '@nestjs/schedule'; // Need @nestjs/schedule installed

@Injectable()
export class DiscoveryService {
    private readonly logger = new Logger(DiscoveryService.name);

    constructor(
        private readonly shellService: ShellService,
        private readonly panelClient: PanelClientService
    ) { }

    // @Cron(CronExpression.EVERY_HOUR) 
    // Commented out until @nestjs/schedule is installed for sure
    async runInventory() {
        this.logger.log('Starting hardware inventory scan...');
        try {
            // lshw -json
            const { stdout } = await this.shellService.exec('lshw -json');
            const data = JSON.parse(stdout);

            // Post to panel
            // Endpoint needs to be defined in panel
            // await this.panelClient.reportInventory(data);
            this.logger.log('Inventory scan complete (Simulated upload)');
        } catch (e) {
            this.logger.error('Inventory scan failed', e);
        }
    }
}
