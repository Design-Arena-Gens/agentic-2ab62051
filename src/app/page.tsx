'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Activity,
  BadgeCheck,
  BellRing,
  Clock3,
  Cloud,
  Cpu,
  Gauge,
  Globe,
  HardDrive,
  MemoryStick,
  Power,
  Plus,
  RefreshCcw,
  Search,
  Server as ServerIcon,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ServerStatus = "running" | "stopped" | "restarting" | "deploying";
type SupportTier = "standard" | "premium";

type Server = {
  id: string;
  name: string;
  provider: string;
  region: string;
  plan: string;
  ipAddress: string;
  status: ServerStatus;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  bandwidthUsage: number;
  uptimeHours: number;
  alerts: number;
  backupsEnabled: boolean;
  tags: string[];
  createdAt: string;
  lastBackup: string;
  supportTier: SupportTier;
  monthlyCost: number;
};

const STORAGE_KEY = "nebula-vps-servers";

const defaultServers: Server[] = [
  {
    id: "atlas-nyc-1",
    name: "Atlas API • nyc",
    provider: "DigitalOcean",
    region: "New York 3",
    plan: "Premium AMD 8GB",
    ipAddress: "167.172.104.18",
    status: "running",
    cpuUsage: 42,
    memoryUsage: 63,
    diskUsage: 38,
    bandwidthUsage: 820,
    uptimeHours: 176,
    alerts: 1,
    backupsEnabled: true,
    tags: ["production", "api"],
    createdAt: "2024-01-11T07:00:00.000Z",
    lastBackup: "2024-06-04T02:00:00.000Z",
    supportTier: "premium",
    monthlyCost: 48,
  },
  {
    id: "nebula-fra-edge",
    name: "Nebula Edge • fra",
    provider: "Hetzner",
    region: "Frankfurt 1",
    plan: "AX41-NVMe",
    ipAddress: "95.217.58.251",
    status: "running",
    cpuUsage: 67,
    memoryUsage: 72,
    diskUsage: 54,
    bandwidthUsage: 1630,
    uptimeHours: 862,
    alerts: 0,
    backupsEnabled: true,
    tags: ["edge", "cdn"],
    createdAt: "2023-11-19T10:40:00.000Z",
    lastBackup: "2024-06-03T23:30:00.000Z",
    supportTier: "standard",
    monthlyCost: 58,
  },
  {
    id: "aurora-sgp-workers",
    name: "Aurora Workers • sgp",
    provider: "Lightsail",
    region: "Singapore",
    plan: "High Memory 4GB",
    ipAddress: "18.139.92.10",
    status: "stopped",
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 16,
    bandwidthUsage: 210,
    uptimeHours: 0,
    alerts: 0,
    backupsEnabled: false,
    tags: ["standby", "batch"],
    createdAt: "2024-02-08T16:20:00.000Z",
    lastBackup: "2024-05-28T07:00:00.000Z",
    supportTier: "standard",
    monthlyCost: 24,
  },
  {
    id: "lunar-sfo-apps",
    name: "Lunar Apps • sfo",
    provider: "Vultr",
    region: "Silicon Valley",
    plan: "High Frequency 4vCPU",
    ipAddress: "209.151.138.77",
    status: "running",
    cpuUsage: 51,
    memoryUsage: 44,
    diskUsage: 41,
    bandwidthUsage: 540,
    uptimeHours: 328,
    alerts: 0,
    backupsEnabled: true,
    tags: ["apps", "node"],
    createdAt: "2024-03-30T12:10:00.000Z",
    lastBackup: "2024-06-05T05:30:00.000Z",
    supportTier: "premium",
    monthlyCost: 36,
  },
];

type NewServerPayload = {
  name: string;
  provider: string;
  region: string;
  plan: string;
  tags: string[];
  backups: boolean;
};

const planCatalog: Record<string, { cost: number; cpu: number; memory: number }> = {
  "Premium AMD 8GB": { cost: 48, cpu: 4, memory: 8 },
  "AX41-NVMe": { cost: 58, cpu: 6, memory: 32 },
  "High Memory 4GB": { cost: 24, cpu: 2, memory: 4 },
  "High Frequency 4vCPU": { cost: 36, cpu: 4, memory: 8 },
  "Premium Intel 16GB": { cost: 68, cpu: 6, memory: 16 },
  "Optimized Compute 8GB": { cost: 54, cpu: 4, memory: 8 },
};

const providers = [
  "DigitalOcean",
  "Hetzner",
  "Vultr",
  "Lightsail",
  "Linode",
  "Scaleway",
];

const regionsByProvider: Record<string, string[]> = {
  DigitalOcean: ["New York 3", "San Francisco 2", "Amsterdam 3", "Toronto 1"],
  Hetzner: ["Frankfurt 1", "Nuremberg 2", "Helsinki 1"],
  Vultr: ["Silicon Valley", "Tokyo", "Sydney", "London"],
  Lightsail: ["Singapore", "Paris", "Mumbai", "Virginia"],
  Linode: ["Dallas", "Mumbai", "Frankfurt", "Osaka"],
  Scaleway: ["Paris", "Warsaw", "Amsterdam"],
};

function formatUptime(hours: number) {
  if (hours <= 0) return "offline";
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (days === 0) {
    return `${remainingHours}h uptime`;
  }
  return `${days}d ${remainingHours}h`;
}

function formatStatus(status: ServerStatus) {
  switch (status) {
    case "running":
      return "Online";
    case "stopped":
      return "Powered off";
    case "restarting":
      return "Rebooting";
    case "deploying":
      return "Deploying";
  }
}

function randomIpSegment(min = 10, max = 240) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(0)}/mo`;
}

function statusColor(status: ServerStatus) {
  switch (status) {
    case "running":
      return "text-emerald-300 bg-emerald-500/10 border-emerald-400/30";
    case "stopped":
      return "text-zinc-300 bg-zinc-500/10 border-zinc-400/20";
    case "restarting":
      return "text-amber-200 bg-amber-500/10 border-amber-400/25";
    case "deploying":
      return "text-sky-200 bg-sky-500/10 border-sky-400/25";
  }
}

export default function Home() {
  const [servers, setServers] = useState<Server[]>(defaultServers);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServerStatus | "all">("all");
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const rebootTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed: Server[] = JSON.parse(stored);
      startTransition(() => setServers(parsed));
    } catch {
      // ignore corrupted storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
  }, [servers]);

  useEffect(() => {
    const timers = rebootTimers.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setServers((prev) =>
        prev.map((server) => {
          if (server.status !== "running") {
            return server;
          }
          const cpu = clamp(server.cpuUsage + jitter());
          const memory = clamp(server.memoryUsage + jitter(8));
          const disk = clamp(server.diskUsage + jitter(4));
          return {
            ...server,
            cpuUsage: cpu,
            memoryUsage: memory,
            diskUsage: disk,
            uptimeHours: server.uptimeHours + 0.2,
            bandwidthUsage: Math.min(server.bandwidthUsage + Math.random() * 18, 2048),
          };
        })
      );
    }, 4800);

    return () => clearInterval(timer);
  }, []);

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      if (statusFilter !== "all" && server.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const value = query.toLowerCase();
      return (
        server.name.toLowerCase().includes(value) ||
        server.provider.toLowerCase().includes(value) ||
        server.region.toLowerCase().includes(value) ||
        server.ipAddress.toLowerCase().includes(value) ||
        server.tags.some((tag) => tag.toLowerCase().includes(value))
      );
    });
  }, [servers, query, statusFilter]);

  const metrics = useMemo(() => {
    const runningServers = servers.filter((server) => server.status === "running");
    const monthlySpend = servers.reduce((acc, server) => acc + server.monthlyCost, 0);
    const alerts = servers.reduce((sum, server) => sum + server.alerts, 0);

    return {
      active: runningServers.length,
      total: servers.length,
      avgCpu:
        runningServers.length > 0
          ? Math.round(
              runningServers.reduce((acc, server) => acc + server.cpuUsage, 0) /
                runningServers.length
            )
          : 0,
      monthlySpend,
      alerts,
    };
  }, [servers]);

  function handlePowerToggle(id: string) {
    setServers((prev) =>
      prev.map((server) => {
        if (server.id !== id) return server;
        if (server.status === "restarting" || server.status === "deploying") {
          return server;
        }
        if (server.status === "running") {
          return {
            ...server,
            status: "stopped",
            cpuUsage: 0,
            memoryUsage: 0,
            bandwidthUsage: Math.max(server.bandwidthUsage - 15, 0),
            uptimeHours: 0,
          };
        }
        return {
          ...server,
          status: "running",
          uptimeHours: 0.2,
          cpuUsage: clamp(35 + Math.random() * 20),
          memoryUsage: clamp(40 + Math.random() * 25),
        };
      })
    );
  }

  function handleReboot(id: string) {
    setServers((prev) =>
      prev.map((server) => {
        if (server.id !== id) return server;
        if (server.status !== "running") return server;
        return { ...server, status: "restarting" };
      })
    );
    const timer = setTimeout(() => {
      setServers((prev) =>
        prev.map((server) => {
          if (server.id !== id) return server;
          return {
            ...server,
            status: "running",
            cpuUsage: clamp(38 + Math.random() * 15),
            memoryUsage: clamp(42 + Math.random() * 18),
            uptimeHours: 0.4,
          };
        })
      );
    }, 2800);
    rebootTimers.current.push(timer);
  }

  function handleCreateServer(payload: NewServerPayload) {
    const id = `srv-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const ipAddress = [
      10 + Math.floor(Math.random() * 40),
      randomIpSegment(),
      randomIpSegment(),
      randomIpSegment(),
    ].join(".");
    const catalog = planCatalog[payload.plan] ?? { cost: 32, cpu: 2, memory: 4 };
    const supportTier: SupportTier = catalog.cost >= 50 ? "premium" : "standard";

    const newServer: Server = {
      id,
      name: payload.name || `New Instance • ${payload.region}`,
      provider: payload.provider,
      region: payload.region,
      plan: payload.plan,
      ipAddress,
      status: "deploying",
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 8,
      bandwidthUsage: 0,
      uptimeHours: 0,
      alerts: 0,
      backupsEnabled: payload.backups,
      tags: payload.tags.length ? payload.tags : ["new"],
      createdAt: now,
      lastBackup: now,
      supportTier,
      monthlyCost: catalog.cost,
    };

    setServers((prev) => [newServer, ...prev]);
    setShowCreate(false);

    const timer = setTimeout(() => {
      setServers((prev) =>
        prev.map((server) =>
          server.id === id
            ? {
                ...server,
                status: "running",
                cpuUsage: clamp(30 + Math.random() * 18),
                memoryUsage: clamp(35 + Math.random() * 22),
                uptimeHours: 0.1,
              }
            : server
        )
      );
    }, 3400);
    rebootTimers.current.push(timer);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:py-16">
      <span className="blur-halo top-12 left-8 hidden sm:block" />
      <span className="blur-halo secondary bottom-10 right-10 hidden sm:block" />
      <div className="w-full max-w-[420px]">
        <div className="relative overflow-hidden rounded-[42px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_30px_90px_rgba(6,12,42,0.55)] backdrop-blur-3xl">
          <div className="absolute inset-x-0 top-0 m-auto h-1.5 w-20 rounded-full bg-white/30" />
          <header className="flex items-center justify-between pt-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                Nebula Fleet
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white">
                Control Center
              </h1>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 transition hover:bg-[var(--accent-strong)]"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </header>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <SummaryCard
              icon={ServerIcon}
              label="Online"
              value={`${metrics.active}/${metrics.total}`}
              hint={`${metrics.active} active nodes`}
            />
            <SummaryCard
              icon={Activity}
              label="Average CPU"
              value={`${metrics.avgCpu}%`}
              hint="Live load"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Monthly"
              value={formatCurrency(metrics.monthlySpend)}
              hint={`${metrics.alerts} alerts`}
            />
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Proactive monitoring enabled • 3 regions synched</span>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a server or tag"
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-white/90 placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
            </div>
            <button
              onClick={() =>
                setStatusFilter((prev) =>
                  prev === "all" ? "running" : prev === "running" ? "stopped" : "all"
                )
              }
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/70 transition hover:border-white/30 hover:text-white"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          <StatusFilter
            value={statusFilter}
            onChange={setStatusFilter}
          />

          <div className="mt-4 flex flex-col gap-4">
            {filteredServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onTogglePower={() => handlePowerToggle(server.id)}
                onReboot={() => handleReboot(server.id)}
                onOpenDetails={() => setSelectedServer(server)}
              />
            ))}
            {filteredServers.length === 0 && (
              <div className="rounded-3xl border border-dashed border-white/12 bg-white/5 p-6 text-center text-sm text-white/60">
                Nothing matches <span className="text-white/80">“{query}”</span>. Try a
                different keyword or reset filters.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/8 p-4 text-sm text-white/70">
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-4 w-4 text-emerald-300" />
              <span>Automated backups and access controls verified 6 minutes ago.</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/40">
              <span>Next maintenance window</span>
              <span>Sunday • 03:00 UTC</span>
            </div>
          </div>
        </div>
      </div>

      <ServerDetailsSheet
        server={selectedServer}
        onClose={() => setSelectedServer(null)}
        onPowerToggle={handlePowerToggle}
        onReboot={handleReboot}
      />

      <CreateServerSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreateServer}
      />
    </div>
  );
}

function jitter(scale = 10) {
  const delta = (Math.random() - 0.5) * scale;
  return delta;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/7 px-3.5 py-4 text-white/80 shadow-inner">
      <Icon className="h-4 w-4 text-white/60" />
      <p className="mt-2 text-xs uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      <p className="text-[11px] text-white/45">{hint}</p>
    </div>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  value: ServerStatus | "all";
  onChange: (value: ServerStatus | "all") => void;
}) {
  const filters: Array<{ label: string; value: ServerStatus | "all" }> = [
    { label: "All", value: "all" },
    { label: "Online", value: "running" },
    { label: "Stopped", value: "stopped" },
    { label: "Deploying", value: "deploying" },
  ];
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={cn(
            "flex-shrink-0 rounded-2xl border px-4 py-2 text-xs font-medium transition",
            value === filter.value
              ? "border-white/40 bg-white/15 text-white"
              : "border-white/10 bg-white/5 text-white/55 hover:border-white/25 hover:text-white"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function ServerCard({
  server,
  onTogglePower,
  onReboot,
  onOpenDetails,
}: {
  server: Server;
  onTogglePower: () => void;
  onReboot: () => void;
  onOpenDetails: () => void;
}) {
  const disabled = server.status === "restarting" || server.status === "deploying";
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/12 bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent p-5 backdrop-blur-2xl">
      <div className="absolute -top-28 -right-16 h-48 w-48 rounded-full bg-[var(--accent)]/15 blur-3xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-white/55">
            <span className="font-medium">{server.provider}</span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                statusColor(server.status)
              )}
            >
              {formatStatus(server.status)}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{server.name}</h2>
          <p className="text-xs text-white/35">
            {server.region} • {server.ipAddress}
          </p>
        </div>
        <button
          onClick={onTogglePower}
          disabled={disabled}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white transition",
            disabled
              ? "bg-white/10 text-white/40"
              : server.status === "running"
                ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/25"
                : "bg-white/10 hover:border-white/25 hover:bg-white/15"
          )}
        >
          <Power className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-3 text-white/70">
        <MetricPill icon={Cpu} label="CPU" value={`${server.cpuUsage}%`} />
        <MetricPill icon={MemoryStick} label="Memory" value={`${server.memoryUsage}%`} />
        <MetricPill icon={HardDrive} label="Disk" value={`${server.diskUsage}%`} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/45">
        <div className="flex items-center gap-2">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{formatUptime(server.uptimeHours)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Cloud className="h-3.5 w-3.5" />
          <span>{server.bandwidthUsage.toFixed(0)} GB transfer</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {server.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/60"
          >
            {tag}
          </span>
        ))}
      </div>

      {(server.status === "restarting" || server.status === "deploying") && (
        <div className="mt-4 flex items-center gap-3 text-xs text-white/55">
          <div className="flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
          <span>{formatStatus(server.status)}</span>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={onReboot}
          disabled={disabled || server.status !== "running"}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 py-2.5 text-sm text-white transition",
            disabled || server.status !== "running"
              ? "opacity-50"
              : "hover:border-white/30 hover:bg-white/12"
          )}
        >
          <RefreshCcw className="h-4 w-4" />
          Reboot
        </button>
        <button
          onClick={onOpenDetails}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 py-2.5 text-sm text-white hover:border-white/30 hover:bg-white/12"
        >
          <Gauge className="h-4 w-4" />
          Inspect
        </button>
      </div>
    </div>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-[11px] uppercase tracking-wide text-white/55">
      <div className="flex items-center gap-2 text-white/70">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function ServerDetailsSheet({
  server,
  onClose,
  onPowerToggle,
  onReboot,
}: {
  server: Server | null;
  onClose: () => void;
  onPowerToggle: (id: string) => void;
  onReboot: (id: string) => void;
}) {
  if (!server) return null;
  const disabled = server.status === "restarting" || server.status === "deploying";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 px-4 pb-8 pt-24">
      <button
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 -z-10"
      />
      <div className="w-full max-w-[420px] overflow-hidden rounded-[36px] border border-white/10 bg-[#070b1a]/98 shadow-[0_40px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex flex-col gap-3 border-b border-white/10 px-6 pb-5 pt-6 text-white">
          <div className="mx-auto h-1 w-12 rounded-full bg-white/25" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                {server.provider}
              </p>
              <h2 className="text-2xl font-semibold">{server.name}</h2>
              <p className="text-xs text-white/35">
                {server.region} • {server.ipAddress}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide",
                statusColor(server.status)
              )}
            >
              {formatStatus(server.status)}
            </span>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6 text-white">
          <section>
            <h3 className="text-xs uppercase tracking-[0.2em] text-white/45">
              Utilization
            </h3>
            <div className="mt-3 space-y-3">
              <Bar label="CPU" value={server.cpuUsage} accent="from-emerald-400 to-teal-300" />
              <Bar
                label="Memory"
                value={server.memoryUsage}
                accent="from-sky-400 to-indigo-300"
              />
              <Bar
                label="Disk"
                value={server.diskUsage}
                accent="from-violet-400 to-purple-300"
              />
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 text-sm text-white/70">
            <DetailCard icon={Globe} label="Region" value={server.region} />
            <DetailCard icon={Gauge} label="Uptime" value={formatUptime(server.uptimeHours)} />
            <DetailCard
              icon={TrendingUp}
              label="Bandwidth"
              value={`${server.bandwidthUsage.toFixed(0)} GB`}
            />
            <DetailCard icon={Cloud} label="Plan" value={server.plan} />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/60">
            <div className="flex items-center gap-3">
              <BellRing className="h-4 w-4 text-amber-200" />
              <div>
                <p className="text-white">Notifications</p>
                {server.alerts === 0 ? (
                  <p className="text-xs text-white/40">No active alerts</p>
                ) : (
                  <p className="text-xs text-amber-200">
                    {server.alerts} issue requires your attention
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/40">
              <span>Backups</span>
              <span>{server.backupsEnabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-white/40">
              <span>Last snapshot</span>
              <span>
                {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(server.lastBackup))}
              </span>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            {server.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wide text-white/55"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3 border-t border-white/10 px-6 py-5">
          <button
            onClick={() => onPowerToggle(server.id)}
            disabled={disabled}
            className={cn(
              "flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition",
              disabled
                ? "bg-white/10 text-white/40"
                : server.status === "running"
                  ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/25"
                  : "bg-white/10 text-white hover:bg-white/20"
            )}
          >
            {server.status === "running" ? "Power Off" : "Power On"}
          </button>
          <button
            onClick={() => onReboot(server.id)}
            disabled={disabled || server.status !== "running"}
            className={cn(
              "flex-1 rounded-2xl border border-white/12 bg-white/7 px-4 py-3 text-sm font-semibold text-white transition",
              disabled || server.status !== "running"
                ? "opacity-50"
                : "hover:border-white/25 hover:bg-white/12"
            )}
          >
            Reboot
          </button>
        </div>
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs uppercase tracking-wide text-white/45">
        <span>{label}</span>
        <span className="text-white/70">{value}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r", accent)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function DetailCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 px-3.5 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
        <Icon className="h-3.5 w-3.5 text-white/70" />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-white/80">{value}</p>
    </div>
  );
}

function CreateServerSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NewServerPayload) => void;
}) {
  const [provider, setProvider] = useState(providers[0]);
  const [region, setRegion] = useState(regionsByProvider[providers[0]][0]);
  const [plan, setPlan] = useState(Object.keys(planCatalog)[0]);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("mobile, edge");
  const [backups, setBackups] = useState(true);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setName("");
        setTags("mobile, edge");
        setBackups(true);
        setProvider(providers[0]);
        setPlan(Object.keys(planCatalog)[0]);
        setRegion(regionsByProvider[providers[0]][0]);
      }, 200);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 pt-24">
      <button
        aria-label="Close sheet"
        onClick={onClose}
        className="absolute inset-0 -z-10"
      />
      <div className="w-full max-w-[420px] rounded-[32px] border border-white/12 bg-[#080d1f]/95 p-6 text-white shadow-[0_35px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="mx-auto h-1 w-12 rounded-full bg-white/25" />
        <h2 className="mt-4 text-xl font-semibold">Launch a new instance</h2>
        <p className="text-sm text-white/45">
          Provision a virtual machine in any provider directly from your phone.
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              name: name.trim(),
              provider,
              region,
              plan,
              tags: tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
              backups,
            });
          }}
        >
          <Field label="Instance name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Edge worker alpha"
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/6 px-3 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
            />
          </Field>

          <Field label="Cloud provider">
            <select
              value={provider}
              onChange={(event) => {
                const nextProvider = event.target.value;
                setProvider(nextProvider);
                const available = regionsByProvider[nextProvider];
                if (available?.length) {
                  setRegion(available[0]);
                } else {
                  setRegion(nextProvider);
                }
              }}
              className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-white/6 px-3 text-sm text-white focus:border-white/25 focus:outline-none"
            >
              {providers.map((option) => (
                <option key={option} value={option} className="bg-[#080d1f]">
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Region">
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-white/6 px-3 text-sm text-white focus:border-white/25 focus:outline-none"
            >
              {(regionsByProvider[provider] ?? []).map((option) => (
                <option key={option} value={option} className="bg-[#080d1f]">
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Plan">
            <select
              value={plan}
              onChange={(event) => setPlan(event.target.value)}
              className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-white/6 px-3 text-sm text-white focus:border-white/25 focus:outline-none"
            >
              {Object.entries(planCatalog).map(([option, details]) => (
                <option key={option} value={option} className="bg-[#080d1f]">
                  {option} • {formatCurrency(details.cost)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tags">
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="production, realtime"
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/6 px-3 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none"
            />
          </Field>

          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            <div>
              <p className="font-medium text-white">Enable automatic backups</p>
              <p className="text-xs text-white/40">Recommended for production workloads</p>
            </div>
            <input
              type="checkbox"
              checked={backups}
              onChange={(event) => setBackups(event.target.checked)}
              className="h-5 w-5 rounded border-white/30 bg-transparent accent-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(92,125,255,0.25)] transition hover:bg-[var(--accent-strong)]"
          >
            <Plus className="h-4 w-4" />
            Deploy instance
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm text-white/55">
      <span className="mb-1 block text-xs uppercase tracking-wide text-white/35">
        {label}
      </span>
      {children}
    </label>
  );
}
