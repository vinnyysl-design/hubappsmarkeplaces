import { LayoutGrid, Star, Clock, Cog, Megaphone, FileBarChart, Calculator, RotateCcw, MessageCircle, Folder, StarHalf } from "lucide-react";
import logoAsset from "@/assets/logo-x-futurista.png.asset.json";
import wordmarkDarkAsset from "@/assets/analyticalx-wordmark-dark.png.asset.json";
import wordmarkLightAsset from "@/assets/analyticalx-wordmark-light.png.asset.json";
const logoSrc = logoAsset.url;
const wordmarkDarkSrc = wordmarkDarkAsset.url;
const wordmarkLightSrc = wordmarkLightAsset.url;

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { openReviewDialog } from "@/components/ReviewButton";

export type HubView = "todos" | "favoritos" | "recentes" | `cat:${string}`;

const catIcons: Record<string, typeof Cog> = {
  "Operação": Cog,
  "Marketing": Megaphone,
  "Relatórios": FileBarChart,
  "Simuladores": Calculator,
  "Devoluções": RotateCcw,
};

interface Props {
  view: HubView;
  onChange: (v: HubView) => void;
  counts: { todos: number; favoritos: number; recentes: number; cats: Record<string, number> };
  categorias: string[];
  supportHref: string;
}

export default function HubSidebar({ view, onChange, counts, categorias, supportHref }: Props) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  const go = (v: HubView) => {
    onChange(v);
    if (isMobile) setOpenMobile(false);
  };

  const main = [
    { v: "todos" as HubView, label: "Todos os aplicativos", icon: LayoutGrid, count: counts.todos },
    { v: "favoritos" as HubView, label: "Favoritos", icon: Star, count: counts.favoritos },
    { v: "recentes" as HubView, label: "Utilizados recentemente", icon: Clock, count: counts.recentes },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <img src={logoSrc} alt="Analytical X" className="h-8 w-8 rounded-md object-contain shrink-0" />
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <img src={wordmarkDarkSrc} alt="Analytical X" className="h-5 w-auto max-w-full object-contain [.light_&]:hidden" />
              <img src={wordmarkLightSrc} alt="Analytical X" className="hidden h-5 w-auto max-w-full object-contain [.light_&]:block" />

              <p className="text-[11px] text-muted-foreground truncate">BI Para Marketplaces</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((m) => (
                <SidebarMenuItem key={m.v}>
                  <SidebarMenuButton isActive={view === m.v} onClick={() => go(m.v)} tooltip={m.label}>
                    <m.icon />
                    <span>{m.label}</span>
                  </SidebarMenuButton>
                  {m.count > 0 && <SidebarMenuBadge>{m.count}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Categorias</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categorias.map((c) => {
                const Icon = catIcons[c] || Folder;
                const v = `cat:${c}` as HubView;
                return (
                  <SidebarMenuItem key={c}>
                    <SidebarMenuButton isActive={view === v} onClick={() => go(v)} tooltip={c}>
                      <Icon />
                      <span>{c}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>{counts.cats[c] ?? 0}</SidebarMenuBadge>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Suporte via WhatsApp">
              <a href={supportHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                <span>Suporte</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={openReviewDialog} tooltip="Nos avalie">
              <StarHalf />
              <span>Nos avalie</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
