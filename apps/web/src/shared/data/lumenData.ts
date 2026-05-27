import {
  Activity,
  BadgeCheck,
  Cable,
  Fingerprint,
  Gauge,
  KeyRound,
  Network,
  RadioTower,
  Rss,
  ServerCog,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export type MetricTone = 'good' | 'watch' | 'neutral'

export type DashboardMetric = {
  label: string
  value: string
  detail: string
  tone: MetricTone
  icon: LucideIcon
}

export type ActivityEvent = {
  label: string
  meta: string
  tone: MetricTone
}

export type PlaceholderSpec = {
  title: string
  eyebrow: string
  description: string
  status: string
  primaryAction: string
  icon: LucideIcon
  items: string[]
}

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: 'Active users',
    value: '18,420',
    detail: '+8.1% this week',
    tone: 'good',
    icon: UsersRound,
  },
  {
    label: 'Healthy nodes',
    value: '42 / 45',
    detail: '3 nodes need attention',
    tone: 'watch',
    icon: Network,
  },
  {
    label: 'Ingress traffic',
    value: '9.8 Tb',
    detail: 'rolling 24h',
    tone: 'neutral',
    icon: Activity,
  },
  {
    label: 'Guard posture',
    value: 'MFA 96%',
    detail: '4 privileged accounts pending',
    tone: 'watch',
    icon: ShieldCheck,
  },
]

export const activityFeed: ActivityEvent[] = [
  { label: 'Moscow edge-02 rotated inbound certificate', meta: '8 min ago', tone: 'good' },
  { label: 'Two users exceeded profile burst limit', meta: '17 min ago', tone: 'watch' },
  { label: 'API key audit export finished', meta: '31 min ago', tone: 'neutral' },
  { label: 'Subscription ruleset staged for beta squad', meta: '44 min ago', tone: 'good' },
]

export const placeholderSpecs: Record<string, PlaceholderSpec> = {
  users: {
    title: 'Users',
    eyebrow: 'Identity registry',
    description: 'Provision accounts, inspect subscription state, and prepare traffic policies.',
    status: 'CRUD pending',
    primaryAction: 'New user',
    icon: UsersRound,
    items: ['Search, segment, and bulk actions', 'Usage limits and expiry controls', 'MFA and portal access flags'],
  },
  nodes: {
    title: 'Nodes',
    eyebrow: 'Infrastructure mesh',
    description: 'Register relay nodes, track health probes, and coordinate safe config rollout.',
    status: 'Telemetry pending',
    primaryAction: 'Register node',
    icon: ServerCog,
    items: ['Health, load, and version status', 'Inbound transport inventory', 'Drain and maintenance workflows'],
  },
  hosts: {
    title: 'Hosts',
    eyebrow: 'Ingress hosts',
    description: 'Map domains and certificates to delivery groups without exposing secrets.',
    status: 'DNS pending',
    primaryAction: 'Add host',
    icon: Cable,
    items: ['SNI and public endpoint labels', 'Certificate expiry timeline', 'Host-to-node assignment plan'],
  },
  profiles: {
    title: 'Profiles',
    eyebrow: 'Client delivery',
    description: 'Shape subscription profiles, transport defaults, and user-facing config bundles.',
    status: 'Builder pending',
    primaryAction: 'New profile',
    icon: Fingerprint,
    items: ['Protocol and transport defaults', 'Template versioning', 'Preview-safe subscription output'],
  },
  squads: {
    title: 'Squads',
    eyebrow: 'Access groups',
    description: 'Group users and nodes into operational lanes with staged policy changes.',
    status: 'Rules pending',
    primaryAction: 'Create squad',
    icon: RadioTower,
    items: ['Membership and inherited limits', 'Route and node affinity', 'Release channels for testing'],
  },
  subscription: {
    title: 'Subscription',
    eyebrow: 'Public config surface',
    description: 'Control subscription endpoint behavior, cache windows, and client metadata.',
    status: 'Endpoint pending',
    primaryAction: 'Configure feed',
    icon: Rss,
    items: ['Safe URL rendering with no secrets logged', 'Client compatibility switches', 'Cache purge and preview hooks'],
  },
  license: {
    title: 'License',
    eyebrow: 'Instance entitlement',
    description: 'Expose license health, renewal windows, and seat pressure without storing keys in UI.',
    status: 'Read-only pending',
    primaryAction: 'Check status',
    icon: BadgeCheck,
    items: ['License summary and expiry', 'Feature gates and limits', 'Audit trail for entitlement checks'],
  },
  apiKeys: {
    title: 'API keys',
    eyebrow: 'Automation access',
    description: 'Prepare scoped token management for integrations and admin automation.',
    status: 'Vault pending',
    primaryAction: 'Create key',
    icon: KeyRound,
    items: ['Scoped permissions matrix', 'Last-used metadata', 'One-time reveal flow placeholder'],
  },
}

export async function getDashboardOverview() {
  return {
    activityFeed,
    metrics: dashboardMetrics,
    riskItems: [
      { label: 'Node pool drift', value: '3 outdated', icon: TriangleAlert },
      { label: 'Capacity headroom', value: '72%', icon: Gauge },
    ],
  }
}
