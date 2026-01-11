import { Test, TestingModule } from '@nestjs/testing';
import { PanelClientService } from './panel-client.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';

describe('PanelClientService', () => {
    let service: PanelClientService;
    let httpService: HttpService;

    const mockHttpService = {
        get: jest.fn(),
        post: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn((key: string) => {
            if (key === 'PANEL_URL') return 'http://panel.local';
            if (key === 'AGENT_TOKEN') return 'secret-token';
            return null;
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PanelClientService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<PanelClientService>(PanelClientService);
        httpService = module.get<HttpService>(HttpService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should sync state successfully', async () => {
        const mockResponse = {
            data: { config: { dhcp: {}, pxe: {} }, jobs: [] },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
        };
        mockHttpService.get.mockReturnValue(of(mockResponse));

        const result = await service.syncState();
        expect(result).toEqual(mockResponse.data);
        expect(httpService.get).toHaveBeenCalledWith(
            'http://panel.local/api/v1/agent/sync',
            expect.objectContaining({
                headers: { 'X-Agent-Token': 'secret-token', 'User-Agent': 'Luxxy-Agent/1.0' },
            }),
        );
    });

    it('should handle sync error securely', async () => {
        mockHttpService.get.mockReturnValue(throwError(() => new Error('Connection refused')));
        const result = await service.syncState();
        expect(result).toBeNull();
    });
});
