import {
  BadgeCheck,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Layers3,
  Network,
  RadioTower,
  Rss,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export type NavigationItem = {
  label: string
  to: string
  icon: LucideIcon
}

export type NavigationGroup = {
  label: string
  items: NavigationItem[]
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Control',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Users', to: '/users', icon: UsersRound },
      { label: 'Nodes', to: '/nodes', icon: Network },
      { label: 'Hosts', to: '/hosts', icon: Globe2 },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { label: 'Profiles', to: '/profiles', icon: Layers3 },
      { label: 'Squads', to: '/squads', icon: RadioTower },
      { label: 'Subscription', to: '/subscription', icon: Rss },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'License', to: '/license', icon: BadgeCheck },
      { label: 'API keys', to: '/api-keys', icon: KeyRound },
      { label: 'Guard portal', to: '/guard/portal', icon: ShieldCheck },
    ],
  },
]
