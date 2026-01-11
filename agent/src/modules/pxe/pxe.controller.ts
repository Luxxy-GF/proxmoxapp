import { Controller, Get, Query, Param, Res, Logger, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PxeService } from './pxe.service';

@Controller('pxe')
export class PxeController {
    private readonly logger = new Logger(PxeController.name);

    constructor(private readonly pxeService: PxeService) { }

    /**
     * GET /pxe/boot?mac=<mac>
     * Entry point for iPXE boot chain.
     * Replaces: /app/api/pxe/ipxe/route.ts
     */
    @Get('boot')
    async getBootScript(@Query('mac') mac: string, @Res() res: Response) {
        this.logger.log(`PXE Boot Request for MAC: ${mac || '(none)'}`);

        const result = this.pxeService.getBootScript(mac);

        res.setHeader('Content-Type', result.contentType);
        return res.send(result.script);
    }

    /**
     * GET /pxe/config?mac=<mac>&token=<token>
     * Returns preseed/kickstart configuration.
     * Replaces: /app/api/pxe/config/route.ts
     */
    @Get('config')
    async getConfig(
        @Query('mac') mac: string,
        @Query('token') token: string,
        @Res() res: Response
    ) {
        this.logger.log(`PXE Config Request for MAC: ${mac}, Token: ${token?.substring(0, 8)}...`);

        if (!mac || !token) {
            return res.status(HttpStatus.BAD_REQUEST).send('Missing MAC or Token');
        }

        const result = this.pxeService.getPreseedConfig(mac, token);

        if (!result) {
            return res.status(HttpStatus.FORBIDDEN).send('Invalid Token or MAC');
        }

        res.setHeader('Content-Type', result.contentType);
        return res.send(result.content);
    }

    /**
     * GET /pxe/cloudinit/:token/user-data
     * Returns cloud-init user-data for inventory scans.
     * Replaces: /app/api/pxe/cloudinit/[token]/user-data/route.ts
     */
    @Get('cloudinit/:token/user-data')
    async getCloudInitUserData(@Param('token') token: string, @Res() res: Response) {
        this.logger.log(`Cloud-Init user-data Request for Token: ${token?.substring(0, 8)}...`);

        const result = this.pxeService.getCloudInitUserData(token);

        if (!result) {
            return res.status(HttpStatus.FORBIDDEN).send('Invalid Token');
        }

        res.setHeader('Content-Type', result.contentType);
        return res.send(result.content);
    }

    /**
     * GET /pxe/cloudinit/:token/meta-data
     * Returns cloud-init meta-data.
     * Replaces: /app/api/pxe/cloudinit/[token]/meta-data/route.ts
     */
    @Get('cloudinit/:token/meta-data')
    async getCloudInitMetaData(@Param('token') token: string, @Res() res: Response) {
        this.logger.log(`Cloud-Init meta-data Request for Token: ${token?.substring(0, 8)}...`);

        const result = this.pxeService.getCloudInitMetaData(token);

        if (!result) {
            return res.status(HttpStatus.FORBIDDEN).send('Invalid Token');
        }

        res.setHeader('Content-Type', result.contentType);
        return res.send(result.content);
    }

    /**
     * GET /pxe/cloudinit/:token/
     * Redirect to user-data (some clients expect trailing slash endpoint)
     */
    @Get('cloudinit/:token')
    async getCloudInitRoot(@Param('token') token: string, @Res() res: Response) {
        return res.redirect(`/pxe/cloudinit/${token}/user-data`);
    }
}
