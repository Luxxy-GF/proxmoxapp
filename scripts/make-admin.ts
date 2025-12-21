
import { prisma } from "@/lib/db"

async function main() {
    const users = await prisma.user.findMany()
    console.log("Current Users:", users)

    if (users.length > 0) {
        const user = users[0]
        console.log(`Promoting ${user.email} to ADMIN...`)
        await prisma.user.update({
            where: { id: user.id },
            data: { role: "ADMIN" }
        })
        console.log("Done.")
    } else {
        console.log("No users found to promote.")
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
