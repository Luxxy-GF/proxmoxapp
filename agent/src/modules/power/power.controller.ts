import { Controller, Post, Body, HttpException, HttpStatus, UseGuards, Headers } from '@nestjs/common';
import { IpmiService, IpmiCredentials } from './ipmi.service';
// import { AuthGuard } from '../../core/auth/auth.guard'; // Assuming we have one, or we check token manually

@Controller('power')
export class PowerController {
    constructor(private readonly ipmiService: IpmiService) { }

    @Post('status')
    async getStatus(@Body() body: IpmiCredentials) {
        try {
            const status = await this.ipmiService.getPowerStatus(body);
            return { status };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('control')
    async setPower(@Body() body: IpmiCredentials & { action: 'on' | 'off' | 'reset' | 'cycle' }) {
        try {
            await this.ipmiService.setPowerState(body, body.action);
            return { success: true, action: body.action };
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
