
"use client"

import * as React from "react"
import {
  Activity,
  CreditCard,
  Frame,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Server,
  Settings2,
  ShoppingCart,
  SquareTerminal,
  Users,
  Wallet,
  LayoutDashboard,
  Box,
  Package,
  Cpu,
  LayoutTemplate,
  UserPlus,
  Receipt,
  LineChart,
  ScrollText,
  Network
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
      title: "Wallet",
      url: "#",
      icon: Wallet,
    },
    {
      title: "Store",
      url: "#",
      icon: ShoppingCart,
    },
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
  ],

  admin: [
    {
      title: "Overview",
      url: "/dashboard/admin",
      icon: LayoutDashboard,
    },
    {
      title: "Configuration",
      url: "/dashboard/admin/settings",
      icon: Settings2,
    },
    {
      title: "Users",
      url: "/dashboard/admin/users",
      icon: Users,
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
    {
      title: "Proxmox Module",
      url: "/dashboard/admin/proxmox",
      icon: Cpu, // Using Cpu as proxy for Proxmox/Server
    },
  ],
}

export function AppSidebar({ servers = [], user, ...props }: React.ComponentProps<typeof Sidebar> & { servers?: any[], user?: any }) {

  // Dynamic navigation data
  const navData = {
    user: user || data.user,
    // ... data.dashboard etc
    dashboard: data.dashboard,
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
