import {
  Boxes,
  Database,
  LayoutDashboard,
  Layers,
  ListChecks,
  type LucideIcon,
  Send,
  ShieldCheck,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Visão geral", description: "KPIs, tendências e alertas da integração", icon: LayoutDashboard },
  { to: "/runs", label: "Lotes", description: "Histórico de lotes solicitados e seu processamento", icon: Boxes },
  { to: "/items", label: "Itens", description: "SKUs recebidos, enriquecidos e com falha", icon: ListChecks },
  { to: "/queues", label: "Filas", description: "Jobs de enriquecimento e callback no BullMQ", icon: Layers },
  { to: "/cache", label: "Cache (Redis)", description: "Memória, comandos e chaves do Redis", icon: Database },
  { to: "/deliveries", label: "Entregas", description: "Callbacks enviados e relatórios da plataforma", icon: Send },
  { to: "/registration", label: "Registro", description: "Webhook registrado e credenciais emitidas", icon: ShieldCheck },
];

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return NAV_ITEMS.find((item) => item.to !== "/" && pathname.startsWith(item.to));
}
