import { Module } from '@nestjs/common';
import { PxeController } from './pxe.controller';
import { PxeService } from './pxe.service';
import { CoreModule } from '../../core/core.module';

@Module({
    imports: [CoreModule],
    controllers: [PxeController],
    providers: [PxeService],
    exports: [PxeService],
})
export class PxeModule { }
