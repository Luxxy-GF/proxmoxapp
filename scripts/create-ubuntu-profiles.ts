import { prisma } from '../lib/db';

async function main() {
    // Create Ubuntu 22.04 LTS Profile
    const existing2204 = await prisma.pXEProfile.findFirst({
        where: { name: 'Ubuntu 22.04 LTS' }
    });

    if (!existing2204) {
        const profile2204 = await prisma.pXEProfile.create({
            data: {
                name: 'Ubuntu 22.04 LTS',
                kind: 'INSTALL',
                osFamily: 'UBUNTU',
                enabled: true,
                tags: ['ubuntu', 'jammy', 'lts', '22.04']
            }
        });
        console.log('✅ Created Ubuntu 22.04 LTS profile:', profile2204.id);
    } else {
        console.log('ℹ️  Ubuntu 22.04 LTS profile already exists');
    }

    // Create Ubuntu 24.04 LTS Profile
    const existing2404 = await prisma.pXEProfile.findFirst({
        where: { name: 'Ubuntu 24.04 LTS' }
    });

    if (!existing2404) {
        const profile2404 = await prisma.pXEProfile.create({
            data: {
                name: 'Ubuntu 24.04 LTS',
                kind: 'INSTALL',
                osFamily: 'UBUNTU',
                enabled: true,
                tags: ['ubuntu', 'noble', 'lts', '24.04']
            }
        });
        console.log('✅ Created Ubuntu 24.04 LTS profile:', profile2404.id);
    } else {
        console.log('ℹ️  Ubuntu 24.04 LTS profile already exists');
    }
}

main()
    .catch((e) => {
        console.error('Error creating Ubuntu profiles:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
