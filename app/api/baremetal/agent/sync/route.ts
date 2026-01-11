import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateAgent } from '@/lib/agent-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const node = await authenticateAgent(req);

    if (!node) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Fetch data specifically for this node's location
    // 1. IP Pools (Subnets) attached to this dedicated node
    const ipPools = await prisma.iPPool.findMany({
        where: {
            dedicatedNodeId: node.id,
            enabled: true
        }
    });

    // 2. Dedicated Servers assigned to this node WITH active installs and profiles
    const dedicatedServers = await prisma.dedicatedServer.findMany({
        where: {
            dedicatedNodeId: node.id
        },
        include: {
            allocations: true,
            installs: {
                where: {
                    state: { in: ['QUEUED', 'RUNNING', 'INVENTORY_SCAN'] }
                },
                orderBy: { startedAt: 'desc' },
                take: 1,
                include: {
                    profile: true,
                    diskLayout: true
                }
            }
        }
    });

    // Get Panel base URL for callback references
    const panelBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://10.15.0.2:3000';

    // Transform to Agent Config Format
    const config = {
        dhcp: {
            subnets: ipPools.map(pool => ({
                subnet: pool.name, // Just a label
                netmask: pool.netmask,
                gateway: pool.gateway,
                rangeStart: pool.startIP,
                rangeEnd: pool.endIP,
                dns: pool.dns || '8.8.8.8'
            })),
            hosts: dedicatedServers.map(server => ({
                mac: server.macAddress,
                ip: server.primaryIpv4 || (server.allocations[0]?.ipAddress) || '0.0.0.0',
                hostname: server.hostname
            }))
        },
        pxe: {
            panelBaseUrl,
            panelCallbackUrl: `${panelBaseUrl}/api/pxe/callback`,
            servers: dedicatedServers.map(server => {
                const activeInstall = server.installs[0];
                return {
                    id: server.id,
                    mac: server.macAddress,
                    hostname: server.hostname,
                    status: server.status,
                    primaryIpv4: server.primaryIpv4,
                    gateway: server.gateway,
                    netmask: server.netmask,
                    nameservers: server.nameservers,
                    activeInstall: activeInstall ? {
                        id: activeInstall.id,
                        token: activeInstall.token,
                        state: activeInstall.state,
                        userDataJson: activeInstall.userDataJson,
                        profile: {
                            id: activeInstall.profile.id,
                            name: activeInstall.profile.name,
                            osFamily: activeInstall.profile.osFamily,
                            templateType: activeInstall.profile.templateType,
                            bootScriptTemplate: activeInstall.profile.bootScriptTemplate,
                            installTemplate: activeInstall.profile.installTemplate,
                            diskLayoutTemplate: activeInstall.profile.diskLayoutTemplate,
                            customScripts: activeInstall.profile.customScripts,
                            lateCommandsTemplate: activeInstall.profile.lateCommandsTemplate,
                            firstBootScript: activeInstall.profile.firstBootScript,
                            defaultPackages: activeInstall.profile.defaultPackages,
                            language: activeInstall.profile.language,
                            timezone: activeInstall.profile.timezone,
                            mirrorUrl: activeInstall.profile.mirrorUrl
                        },
                        diskLayout: activeInstall.diskLayout ? {
                            id: activeInstall.diskLayout.id,
                            name: activeInstall.diskLayout.name,
                            syntax: activeInstall.diskLayout.syntax,
                            content: activeInstall.diskLayout.content
                        } : null
                    } : null
                };
            })
        }
    };

    return NextResponse.json({
        config,
        jobs: [] // TODO: Fetch pending jobs for this node
    });
}
