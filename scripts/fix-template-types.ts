
import { prisma } from "../lib/db"

async function main() {
    console.log("Updating all templates to type 'qemu'...")
    try {
        const result = await prisma.template.updateMany({
            data: {
                type: 'qemu'
            }
        })
        console.log(`Updated ${result.count} templates to qemu.`)
    } catch (e) {
        console.error(e)
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
