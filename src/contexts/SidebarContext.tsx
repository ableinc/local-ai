import React from "react"
import type { SidebarContextProps } from "@/components/ui/sidebar"

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

export { SidebarContext }