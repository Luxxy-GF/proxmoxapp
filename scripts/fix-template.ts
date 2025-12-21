
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("Updating all templates to type 'qemu'...")
    try {
        // Need to explicitly cast as any or ignore TS because generated client might be old in memory? 
        // types should be fine if generate ran.
        const result = await prisma.template.updateMany({
            data: {
                type: 'qemu'
            }
        })
        console.log(`Updated ${result.count} templates to qemu.`)
    } catch (e) {
        console.error("Failed to update templates:", e)
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
