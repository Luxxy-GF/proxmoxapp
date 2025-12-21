import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Server as ServerIcon } from "lucide-react"
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
    }
  })

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your Servers</h2>
          <Link href="/dashboard/deploy">
            <Button>Deploy New Server</Button>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers.length === 0 && (
            <div className="col-span-3 text-center p-8 text-muted-foreground">
              You don't have any servers yet. <Link href="/dashboard/deploy" className="underline">Deploy one now</Link>.
            </div>
          )}
          {servers.map((server) => (
            <Card key={server.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {server.name}
                </CardTitle>
                <ServerIcon className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{server.status}</div>
                <p className="text-muted-foreground text-xs">{server.node.name} (VMID: {server.vmid})</p>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Cores: {server.resources?.cpuCores || '-'} | RAM: {server.resources?.memoryMB ? server.resources.memoryMB / 1024 + 'GB' : '-'}
                  </span>
                  <Link href={`/dashboard/server/${server.id}`}>
                    <Button size="sm" variant="secondary">Manage</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
