import { Module, MiddlewareConsumer, RequestMethod, NestModule } from '@nestjs/common';
import { ConsoleController } from './console.controller';
import { ConsoleService } from './console.service';
import { ConsoleProxyMiddleware } from './console-proxy.middleware';
import { PowerModule } from '../power/power.module';

@Module({
    imports: [PowerModule],
    controllers: [ConsoleController],
    providers: [ConsoleService, ConsoleProxyMiddleware],
    exports: [ConsoleService],
})
export class ConsoleModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // Apply proxy middleware for all /console/proxy/* routes
        consumer
            .apply(ConsoleProxyMiddleware)
            .forRoutes({ path: 'console/proxy/*', method: RequestMethod.ALL });
    }
}
