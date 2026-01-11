import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { DhcpModule } from './modules/dhcp/dhcp.module';
import { PowerModule } from './modules/power/power.module';
import { PxeModule } from './modules/pxe/pxe.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ConsoleModule } from './modules/console/console.module';

@Module({
  imports: [
    CoreModule,
    DhcpModule,
    PowerModule,
    PxeModule,
    DiscoveryModule,
    ConsoleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
