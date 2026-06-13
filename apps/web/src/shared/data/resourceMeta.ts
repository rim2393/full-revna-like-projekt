import {
  Cable,
  Fingerprint,
  KeyRound,
  RadioTower,
  Rss,
  ServerCog,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export type MetricTone = 'danger' | 'good' | 'info' | 'neutral' | 'watch'

export type DashboardMetric = {
  label: string
  value: string
  detail: string
  tone: MetricTone
  icon: LucideIcon
}

export type SectionSpec = {
  title: string
  eyebrow: string
  description: string
  status: string
  primaryAction: string
  icon: LucideIcon
  items: string[]
}

export const sectionSpecs: Record<string, SectionSpec> = {
  users: {
    title: 'Users',
    eyebrow: 'Identity registry',
    description: 'Provision accounts, inspect subscription state, and prepare traffic policies.',
    status: 'API backed',
    primaryAction: 'New user',
    icon: UsersRound,
    items: ['Search, segment, and bulk actions', 'Usage limits and expiry controls', 'MFA and portal access flags'],
  },
  nodes: {
    title: 'Nodes',
    eyebrow: 'Infrastructure mesh',
    description: 'Register relay nodes, track health probes, and coordinate safe config rollout.',
    status: 'Live telemetry',
    primaryAction: 'Register node',
    icon: ServerCog,
    items: ['Health, load, and version status', 'Inbound transport inventory', 'Drain and maintenance workflows'],
  },
  hosts: {
    title: 'Hosts',
    eyebrow: 'Ingress hosts',
    description: 'Map domains and certificates to delivery groups without exposing secrets.',
    status: 'DNS mapped',
    primaryAction: 'Add host',
    icon: Cable,
    items: ['SNI and public endpoint labels', 'Certificate expiry timeline', 'Host-to-node assignment plan'],
  },
  profiles: {
    title: 'Profiles',
    eyebrow: 'Client delivery',
    description: 'Shape subscription profiles, transport defaults, and user-facing config bundles.',
    status: 'Profile builder',
    primaryAction: 'New profile',
    icon: Fingerprint,
    items: ['Protocol and transport defaults', 'Template versioning', 'Client-safe subscription output'],
  },
  squads: {
    title: 'Squads',
    eyebrow: 'Access groups',
    description: 'Group users and nodes into operational lanes with staged policy changes.',
    status: 'Policy groups',
    primaryAction: 'Create squad',
    icon: RadioTower,
    items: ['Membership and inherited limits', 'Route and node affinity', 'Release channels for testing'],
  },
  subscription: {
    title: 'Subscription',
    eyebrow: 'Public config surface',
    description: 'Control subscription endpoint behavior, cache windows, and client metadata.',
    status: 'Endpoint active',
    primaryAction: 'Configure feed',
    icon: Rss,
    items: ['Safe URL rendering with no secrets logged', 'Client compatibility switches', 'Cache purge and import checks'],
  },
  apiKeys: {
    title: 'API keys',
    eyebrow: 'Automation access',
    description: 'Prepare scoped token management for integrations and admin automation.',
    status: 'Scoped tokens',
    primaryAction: 'Create key',
    icon: KeyRound,
    items: ['Scoped permissions matrix', 'Last-used metadata', 'One-time reveal flow'],
  },
}
