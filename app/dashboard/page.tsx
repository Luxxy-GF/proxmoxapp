import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Server as ServerIcon, Plus } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { ServerCard } from "@/components/dashboard/server-card"
import { Card, CardContent } from "@/components/ui/card"

export default async function Page() {
  const session = await auth()
  if (!session?.user?.id) return <div>Please log in</div>

  const servers = await prisma.server.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { subusers: { some: { userId: session.user.id } } }
      ]
    },
    include: {
      node: true,
      resources: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-6 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold">Your Servers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <Link href="/dashboard/deploy">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Deploy New Server
          </Button>
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 bg-zinc-950/20 min-h-[calc(100vh-4rem)]">

        {servers.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center">
            <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                  <ServerIcon className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-xl">No servers deployed yet</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Get started by deploying your first high-performance cloud server in seconds.
                  </p>
                </div>
                <Link href="/dashboard/deploy">
                  <Button size="lg" className="w-full">
                    Deploy Your First Server
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {servers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
