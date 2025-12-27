import { prisma } from '../lib/db';

async function main() {
    console.log("Creating Proxmox VE 9 Profile...");

    // Check if it already exists
    const existing = await prisma.pXEProfile.findFirst({
        where: { name: { contains: "Proxmox", mode: 'insensitive' } }
    });

    if (existing) {
        console.log("Profile already exists:", existing.name);
        return;
    }

    const profile = await prisma.pXEProfile.create({
        data: {
            name: "Proxmox VE 9 (Trixie)",
            kind: "INSTALL",
            osFamily: "DEBIAN",
            tags: ["proxmox", "trixie", "hypervisor"],
            enabled: true,
        }
    });

    console.log("Created Profile:", profile);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
