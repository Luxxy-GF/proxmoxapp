import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PanelClientService } from './client/panel-client.service';
import { StateService } from './state/state.service';
import { ShellService } from './shell/shell.service';

@Global()
@Module({
    imports: [
        HttpModule,
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.local', '.env']
        })
    ],
    providers: [PanelClientService, StateService, ShellService],
    exports: [PanelClientService, StateService, ShellService],
})
export class CoreModule { }
