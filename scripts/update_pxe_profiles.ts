import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function updateProfiles() {
    // Ubuntu 24.04 LTS
    await prisma.pXEProfile.updateMany({
        where: { name: { contains: '24.04' } },
        data: {
            templateType: 'PRESEED',
            osFamily: 'UBUNTU',
            releaseVersion: '24.04',
            timezone: 'UTC',
            language: 'en_US',
            mirrorUrl: 'http://archive.ubuntu.com/ubuntu',
            completionEvent: 'AFTER_PXE',
            allowSetHostname: true,
            allowSshKeyInjection: true,
            allowSetRootPassword: true,
            updateInventoryAfter: true,
        }
    });

    // Ubuntu 22.04 LTS
    await prisma.pXEProfile.updateMany({
        where: { name: { contains: '22.04' } },
        data: {
            templateType: 'PRESEED',
            osFamily: 'UBUNTU',
            releaseVersion: '22.04',
            timezone: 'UTC',
            language: 'en_US',
            mirrorUrl: 'http://archive.ubuntu.com/ubuntu',
            completionEvent: 'AFTER_PXE',
            allowSetHostname: true,
            allowSshKeyInjection: true,
            allowSetRootPassword: true,
            updateInventoryAfter: true,
        }
    });

    // Debian 13 (Trixie)
    await prisma.pXEProfile.updateMany({
        where: { name: { contains: 'Debian' } },
        data: {
            templateType: 'PRESEED',
            osFamily: 'DEBIAN',
            releaseVersion: '13',
            timezone: 'UTC',
            language: 'en_US',
            mirrorUrl: 'http://deb.debian.org/debian',
            completionEvent: 'AFTER_PXE',
            allowSetHostname: true,
            allowSshKeyInjection: true,
            allowSetRootPassword: true,
            updateInventoryAfter: true,
        }
    });

    // Proxmox VE
    await prisma.pXEProfile.updateMany({
        where: { name: { contains: 'Proxmox' } },
        data: {
            templateType: 'PRESEED',
            osFamily: 'DEBIAN',
            releaseVersion: '9',
            timezone: 'UTC',
            language: 'en_US',
            completionEvent: 'AFTER_PXE',
            allowSetHostname: true,
            allowSshKeyInjection: true,
            allowSetRootPassword: true,
            updateInventoryAfter: true,
        }
    });

    console.log('Profiles updated!');
    process.exit(0);
}

updateProfiles();
