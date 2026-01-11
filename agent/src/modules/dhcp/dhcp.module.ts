import { Module } from '@nestjs/common';
import { DhcpService } from './dhcp.service';

@Module({
    providers: [DhcpService],
    exports: [DhcpService],
})
export class DhcpModule { }
