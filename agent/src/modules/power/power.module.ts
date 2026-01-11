import { Module } from '@nestjs/common';
import { IpmiService } from './ipmi.service';
import { PowerController } from './power.controller';

@Module({
    controllers: [PowerController],
    providers: [IpmiService],
    exports: [IpmiService],
})
export class PowerModule { }
