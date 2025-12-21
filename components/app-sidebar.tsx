
"use client"

import * as React from "react"
import {
  CreditCard,
  Send,
  Server,
  Settings2,
  ShoppingCart,
  SquareTerminal,
  Users,
  LayoutDashboard,
  Box,
  Package,
  Cpu,
  LayoutTemplate,
  LineChart,
  ScrollText,
  Network,
  Disc
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "olekaleksander",
    email: "olekaleksander@proton.me",
    avatar: "/avatars/shadcn.jpg",
  },
  dashboard: [
    {
      title: "Server List",
      url: "/dashboard",
      icon: Server,
    },
    {
      title: "Deploy",
      url: "/dashboard/deploy",
      icon: Send,
    },
    {
      title: "Store",
      url: "/dashboard/store",
      icon: ShoppingCart,
    },
    {
      title: "Billing",
      url: "/dashboard/billing",
      icon: CreditCard,
    },
    {
      title: "ISOs",
      url: "/dashboard/isos",
      icon: Disc,
    },
  ],

  admin: [
    {
      title: "Overview",
      url: "/dashboard/admin",
      icon: LayoutDashboard,
    },
    {
      title: "Settings",
      url: "/dashboard/admin/settings",
      icon: Settings2,
    },
    {
      title: "Users",
      url: "/dashboard/admin/users",
      icon: Users,
    },
    {
      title: "Servers",
      url: "/dashboard/admin/servers",
      icon: Server,
    },
    {
      title: "Nodes",
      url: "/dashboard/admin/nodes",
      icon: Cpu,
    },
    {
      title: "Templates",
      url: "/dashboard/admin/templates",
      icon: LayoutTemplate,
    },
    {
      title: "Billing",
      url: "/dashboard/admin/billing",
      icon: CreditCard,
    },
    {
      title: "Plans",
      url: "/dashboard/admin/plans",
      icon: Package,
    },
    {
      title: "Networking",
      url: "/dashboard/admin/networking",
      icon: Network,
    },
  ],
}

export function AppSidebar({
  servers = [],
  user,
  featureFlags,
  ...props
}: React.ComponentProps<typeof Sidebar> & { servers?: any[], user?: any, featureFlags?: Record<string, boolean> }) {

  // Dynamic navigation data
  const storeEnabled = featureFlags?.store_enabled !== false
  const deployEnabled = featureFlags?.deploy_enabled !== false

  const navData = {
    user: user || data.user,
    dashboard: data.dashboard.filter((item) => {
      if (item.url === "/dashboard/store" && !storeEnabled) return false
      if (item.url === "/dashboard/deploy" && !deployEnabled) return false
      return true
    }),
    servers: [
      {
        title: "Your Servers",
        url: "/dashboard",
        icon: SquareTerminal,
        isActive: true,
        items: servers.map((s: any) => ({
          title: s.name,
          url: `/dashboard/server/${s.id}`,
          items: [
            {
              title: "Overview",
              url: `/dashboard/server/${s.id}`,
              icon: LineChart
            },
            {
              title: "Subusers",
              url: `/dashboard/server/${s.id}/subusers`,
              icon: Users
            },
            {
              title: "Activity",
              url: `/dashboard/server/${s.id}/activity`,
              icon: ScrollText
            },
            {
              title: "Billing",
              url: `/dashboard/server/${s.id}/billing`,
              icon: CreditCard
            },
            {
              title: "Settings",
              url: `/dashboard/server/${s.id}/settings`,
              icon: Settings2
            },
            {
              title: "Media & Boot",
              url: `/dashboard/server/${s.id}/media`,
              icon: Disc
            }
          ]
        }))
      }
    ],
    admin: data.admin
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Box className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">LumenPanel</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Dashboard" items={navData.dashboard} />
        {servers.length > 0 && <NavMain label="Servers" items={navData.servers} />}
        {navData.user?.role === "ADMIN" && <NavMain label="Admin" items={navData.admin} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navData.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
