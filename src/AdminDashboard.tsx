/** HSL admin workspace: a separate administrator surface, not a member dashboard. */
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Home,
  Info,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  Pencil,
  Plus,
  Rocket,
  Search,
  Send,
  Sun,
  Trash2,
  TriangleAlert,
  UsersRound,
  X,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "./contexts/AuthContext";
import {
  fetchAdminUsers,
  fetchAdminDashboard,
  fetchCurrentUser,
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  fetchAllStartups,
  updateStartupStatus,
  permanentlyDeleteStartup,
  type AdminStartup,
  type AdminUser,
  type Announcement as ApiAnnouncement,
} from "./lib/adminApi";
import { describeError } from "./lib/errors";
import ErrorState from "./components/ErrorState";
import LoadingButton from "./components/LoadingButton";

const PUBLIC_SITE_URL = "https://hsl-hub-lime.vercel.app";

const describeErrorKind = (error: unknown) => describeError(error).kind;

type ReviewStatus = "Pending" | "Approved" | "Rejected" | "Deleted";
type Application = {
  id: string;
  applicant: string;
  email: string;
  course: string;
  field: string;
  level: string;
  community: string;
  about: string;
  contact: string;
  submitted: string;
  status: ReviewStatus;
};
type StartupSubmission = {
  id: string;
  realId: string;
  name: string;
  founder: string;
  founderEmail: string;
  founderPhone: string;
  stage: string;
  category: string;
  description: string;
  submitted: string;
  status: ReviewStatus;
  memberCount: number;
  deletedAt: string | null;
};
type Announcement = {
  id: string;
  title: string;
  message: string;
  author: string;
  date: string;
  state: "Draft" | "Published";
};
type AdminSection = "overview" | "members" | "startups" | "announcements";

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Turns enum values like "LEVEL_300" or "CREATORS" into readable labels. */
function formatLevel(level: string | undefined): string {
  if (!level) return "Not set";
  if (level === "PG") return "Postgraduate";
  return `${level.replace("LEVEL_", "")} Level`;
}

function formatCommunity(name: string | undefined): string {
  if (!name) return "Not set";
  return name.charAt(0) + name.slice(1).toLowerCase();
}

function mapUserToApplication(user: AdminUser): Application {
  const profile = user.profile;
  // "OTHER" means the member typed their own niche into fieldOther.
  const field =
    profile?.field === "OTHER" ? profile.fieldOther : profile?.field;
  return {
    id: user.id.slice(0, 8).toUpperCase(),
    applicant: profile?.name ?? user.email.split("@")[0],
    email: user.email,
    course: profile?.course?.replace(/_/g, " ") ?? "Not set",
    field: field?.replace(/_/g, " ") || "Not set",
    level: formatLevel(profile?.level),
    community: formatCommunity(profile?.community?.name),
    about: profile?.description || "Not set",
    contact: profile?.telegramPhone ?? "Not set",
    submitted: formatRelativeDate(user.createdAt),
    status: "Approved",
  };
}

function mapStartupToSubmission(startup: AdminStartup): StartupSubmission {
  const statusMap: Record<string, ReviewStatus> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    DELETED: "Deleted",
  };
  return {
    id: startup.id.slice(0, 8).toUpperCase(),
    realId: startup.id,
    name: startup.name,
    founder: startup.owner?.name ?? "Unknown",
    founderEmail: startup.owner?.email ?? "",
    founderPhone: startup.owner?.phone ?? "",
    stage: startup.stage?.replace(/_/g, " ") ?? "Not set",
    category: startup.industry?.replace(/_/g, " ") ?? "Not set",
    description: startup.description,
    submitted: formatRelativeDate(startup.createdAt),
    status: statusMap[startup.status] ?? "Pending",
    memberCount: startup.memberCount ?? 0,
    deletedAt: startup.deletedAt ?? null,
  };
}

function mapApiAnnouncement(a: ApiAnnouncement): Announcement {
  return {
    id: a.id,
    title: a.title,
    message: a.content,
    author: a.author?.name ?? "HSL Admin",
    date: formatRelativeDate(a.createdAt),
    state: a.published ? "Published" : "Draft",
  };
}

/** Decisions an admin can take from each current status (mirrors the backend rules). */
const STARTUP_ACTIONS: Record<ReviewStatus, Array<"Approved" | "Rejected">> = {
  Pending: ["Rejected", "Approved"],
  Approved: ["Rejected"],
  Rejected: ["Approved"],
  // Founder-deleted startups are restored by support in the database, not here.
  Deleted: [],
};

/** Permanent deletion is only offered once a startup is out of circulation. */
const PERMANENTLY_DELETABLE: ReviewStatus[] = ["Rejected", "Deleted"];

let scrollLockCount = 0;

/** Freezes background scrolling while a modal is open so it keeps the admin's focus. */
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const { body, documentElement } = document;
    const previous = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    if (scrollLockCount === 0) {
      const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    }
    scrollLockCount += 1;
    return () => {
      scrollLockCount -= 1;
      if (scrollLockCount === 0) {
        body.style.overflow = previous.overflow;
        body.style.paddingRight = previous.paddingRight;
      }
    };
  }, [locked]);
}

function StatusPill({
  status,
}: {
  status: ReviewStatus | "Draft" | "Published";
}) {
  return (
    <span className={`admin-status admin-status--${status.toLowerCase()}`}>
      {status}
    </span>
  );
}

function AnimatedMetricNumber({ value }: { value: number }) {
  const numberRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const state = { value: 0 };
    const context = gsap.context(() =>
      gsap.to(state, {
        value,
        duration: 1.05,
        ease: "power3.out",
        onUpdate: () => {
          if (numberRef.current)
            numberRef.current.textContent = String(Math.round(state.value));
        },
      }),
    );
    return () => context.revert();
  }, [value]);
  return <strong ref={numberRef}>{value}</strong>;
}

function AdminOverviewChart({
  totalMembers,
  pendingStartups,
  approvedStartups,
}: {
  totalMembers: number;
  pendingStartups: number;
  approvedStartups: number;
}) {
  const chartScope = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        ".admin-bar-fill",
        { scaleY: 0, transformOrigin: "bottom" },
        {
          scaleY: 1,
          stagger: 0.1,
          duration: 0.6,
          ease: "power3.out",
          delay: 0.45,
        },
      );
    }, chartScope);
    return () => context.revert();
  }, []);
  const capacity = Math.max(totalMembers, pendingStartups, approvedStartups, 4);
  return (
    <div className="admin-chart-grid" ref={chartScope}>
      <article className="admin-chart-panel admin-animate">
        <div className="admin-chart-heading">
          <div>
            <p className="eyebrow">Overview</p>
            <h3>Approval status</h3>
          </div>
          <span className="chart-total">
            {totalMembers + pendingStartups + approvedStartups} records
          </span>
        </div>
        <div className="admin-bar-chart">
          {[
            ["Members", totalMembers, "pink"],
            ["Pending startups", pendingStartups, "orange"],
            ["Approved startups", approvedStartups, "blue"],
          ].map(([label, number, color]) => (
            <div className="admin-bar-row" key={String(label)}>
              <span>{label}</span>
              <div className="admin-bar-track">
                <i
                  className={`admin-bar-fill admin-bar-fill--${color}`}
                  style={{
                    height: `${Math.max(18, (Number(number) / capacity) * 100)}%`,
                  }}
                />
              </div>
              <strong>{number}</strong>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout: firebaseLogout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserQuery = useQuery({
    queryKey: ["current-user-role"],
    queryFn: fetchCurrentUser,
  });
  const profileName =
    currentUserQuery.data?.profile?.name ??
    user?.email?.split("@")[0] ??
    "Admin";
  const initials = profileName.slice(0, 2).toUpperCase();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);
  const toggleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  const [section, setSection] = useState<AdminSection>("overview");
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [section]);
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [selectedStartup, setSelectedStartup] =
    useState<StartupSubmission | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [startupStatus, setStartupStatus] = useState<ReviewStatus | "All">(
    "All",
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const [startupToPurge, setStartupToPurge] =
    useState<StartupSubmission | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const overviewScope = useRef<HTMLElement>(null);
  useBodyScrollLock(
    Boolean(
      selectedApplication || selectedStartup || composeOpen || startupToPurge,
    ),
  );
  const dashboardStatsQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: fetchAdminDashboard,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
  });
  const startupsQuery = useQuery({
    queryKey: ["admin", "startups"],
    queryFn: fetchAllStartups,
  });
  const announcementsQuery = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: fetchAnnouncements,
  });
  const applications = useMemo(
    () => (usersQuery.data ?? []).map(mapUserToApplication),
    [usersQuery.data],
  );
  const startups = useMemo(
    () => (startupsQuery.data ?? []).map(mapStartupToSubmission),
    [startupsQuery.data],
  );
  const announcements = useMemo(
    () => (announcementsQuery.data ?? []).map(mapApiAnnouncement),
    [announcementsQuery.data],
  );
  // Each section only depends on the data it shows, so one failing endpoint
  // doesn't take down the whole dashboard.
  const sectionQueries = {
    overview: [
      dashboardStatsQuery,
      usersQuery,
      startupsQuery,
      announcementsQuery,
    ],
    members: [usersQuery],
    startups: [startupsQuery],
    announcements: [announcementsQuery],
  }[section];
  const failedQuery = sectionQueries.find((query) => query.isError);
  const sectionError = failedQuery?.error ?? null;
  const isRetryingSection = sectionQueries.some((query) => query.isFetching);
  const retrySection = () => {
    sectionQueries
      .filter((query) => query.isError)
      .forEach((query) => void query.refetch());
  };
  const isLoading = sectionQueries.some((query) => query.isLoading);
  const metrics = useMemo(() => {
    const stats = dashboardStatsQuery.data;
    return {
      activeMembers: stats?.totalUsers ?? applications.length,
      pendingStartups:
        stats?.pendingStartups ??
        startups.filter((item) => item.status === "Pending").length,
      approvedStartups:
        stats?.approvedStartups ??
        startups.filter((item) => item.status === "Approved").length,
      rejectedStartups:
        stats?.rejectedStartups ??
        startups.filter((item) => item.status === "Rejected").length,
      deletedStartups:
        stats?.deletedStartups ??
        startups.filter((item) => item.status === "Deleted").length,
      announcements:
        stats?.publishedAnnouncements ??
        announcements.filter((item) => item.state === "Published").length,
    };
  }, [dashboardStatsQuery.data, applications, startups, announcements]);
  // Keep an open review modal in step with the latest server status.
  useEffect(() => {
    setSelectedStartup((current) =>
      current
        ? (startups.find((item) => item.realId === current.realId) ?? null)
        : current,
    );
  }, [startups]);
  const memberRows = applications.filter((item) =>
    `${item.applicant} ${item.email} ${item.field}`
      .toLowerCase()
      .includes(memberSearch.toLowerCase()),
  );
  // Founder-deleted startups live only under their own tab.
  const startupRows = startups.filter((item) =>
    startupStatus === "All"
      ? item.status !== "Deleted"
      : item.status === startupStatus,
  );
  // Refs flip synchronously, so a fast double-click can't slip a second request
  // in before React re-renders the disabled button.
  const inFlight = useRef(new Set<string>());
  const runOnce = (key: string, request: () => Promise<unknown>) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    // Failures are reported by each mutation's onError.
    request()
      .catch(() => undefined)
      .finally(() => inFlight.current.delete(key));
  };
  const showMutationError = (error: unknown, action: string) => {
    const info = describeError(error);
    toast.error(action, {
      description: info.message,
      action:
        info.kind === "unauthorized"
          ? { label: "Sign in", onClick: () => void logout() }
          : undefined,
    });
  };
  const refreshStartupViews = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "startups"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };
  const refreshAnnouncementViews = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
  };
  const startupMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "APPROVED" | "REJECTED";
    }) => updateStartupStatus(id, status),
    onSuccess: (_data, { status }) => {
      toast.success(
        status === "APPROVED"
          ? "Startup approved and now live"
          : "Startup rejected",
      );
      setSelectedStartup(null);
    },
    onError: (error, { status }) => {
      showMutationError(
        error,
        status === "APPROVED"
          ? "Couldn't approve startup"
          : "Couldn't reject startup",
      );
    },
    // Refresh every view that depends on startup status, whether the change succeeded or was refused as stale.
    onSettled: refreshStartupViews,
  });
  const purgeStartupMutation = useMutation({
    mutationFn: (id: string) => permanentlyDeleteStartup(id),
    onSuccess: () => {
      toast.success("Startup permanently deleted");
      setStartupToPurge(null);
      setSelectedStartup(null);
    },
    onError: (error) => {
      showMutationError(error, "Couldn't delete startup");
      // The startup changed or vanished underneath us; drop the stale
      // confirmation so the review modal can show its current state.
      const kind = describeErrorKind(error);
      if (kind === "conflict" || kind === "not-found") setStartupToPurge(null);
    },
    onSettled: refreshStartupViews,
  });
  const saveAnnouncementMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id?: string;
      state: "Draft" | "Published";
      data: { title: string; content: string; published: boolean };
    }) => (id ? updateAnnouncement(id, data) : createAnnouncement(data)),
    onSuccess: (_data, { id, state }) => {
      setComposeOpen(false);
      setEditingAnnouncement(null);
      toast.success(
        id
          ? "Announcement updated"
          : state === "Published"
            ? "Announcement published to all members"
            : "Draft saved",
      );
    },
    onError: (error, { id, state }) => {
      showMutationError(
        error,
        id
          ? "Couldn't save changes"
          : state === "Published"
            ? "Couldn't publish announcement"
            : "Couldn't save draft",
      );
    },
    onSettled: refreshAnnouncementViews,
  });
  const publishAnnouncementMutation = useMutation({
    mutationKey: ["admin", "announcement-row", "publish"],
    mutationFn: (id: string) => updateAnnouncement(id, { published: true }),
    onSuccess: () => {
      toast.success("Announcement published");
    },
    onError: (error) => {
      showMutationError(error, "Couldn't publish announcement");
    },
    onSettled: refreshAnnouncementViews,
  });
  const deleteAnnouncementMutation = useMutation({
    mutationKey: ["admin", "announcement-row", "delete"],
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      toast.success("Announcement deleted");
    },
    onError: (error) => {
      showMutationError(error, "Couldn't delete announcement");
    },
    onSettled: refreshAnnouncementViews,
  });
  // Several rows can be busy at once, so track each pending row by id.
  const pendingAnnouncementActions = useMutationState({
    filters: { mutationKey: ["admin", "announcement-row"], status: "pending" },
    select: (mutation) => ({
      action: mutation.options.mutationKey?.[2] as "publish" | "delete",
      id: mutation.state.variables as string,
    }),
  });
  const announcementRowAction = (id: string) =>
    pendingAnnouncementActions.find((item) => item.id === id)?.action;
  const pendingDecision = startupMutation.isPending
    ? startupMutation.variables?.status
    : undefined;
  const isStartupBusy =
    startupMutation.isPending || purgeStartupMutation.isPending;
  const isSavingAnnouncement = saveAnnouncementMutation.isPending;
  const savingState = isSavingAnnouncement
    ? saveAnnouncementMutation.variables?.state
    : undefined;
  const closeCompose = () => {
    if (isSavingAnnouncement) return;
    setComposeOpen(false);
    setEditingAnnouncement(null);
  };
  const handleStartupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement;
    const decision = submitter?.value as "Approved" | "Rejected";
    if (
      !selectedStartup ||
      !STARTUP_ACTIONS[selectedStartup.status].includes(decision)
    )
      return;
    const id = selectedStartup.realId;
    runOnce(`startup:${id}`, () =>
      startupMutation.mutateAsync({
        id,
        status: decision === "Approved" ? "APPROVED" : "REJECTED",
      }),
    );
  };
  const purgeStartup = (id: string) => {
    runOnce(`startup:${id}`, () => purgeStartupMutation.mutateAsync(id));
  };
  const copyFounderPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success("Phone number copied");
    } catch {
      toast.error("Could not copy the phone number");
    }
  };
  const saveAnnouncement = (
    form: HTMLFormElement,
    state: "Draft" | "Published",
  ) => {
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const message = String(data.get("message") || "").trim();
    if (!title || !message)
      return toast.error("Title and message are required");
    const id = editingAnnouncement?.id;
    runOnce("announcement:compose", () =>
      saveAnnouncementMutation.mutateAsync({
        id,
        state,
        data: { title, content: message, published: state === "Published" },
      }),
    );
  };
  const removeAnnouncement = (id: string) => {
    runOnce(`announcement:${id}`, () =>
      deleteAnnouncementMutation.mutateAsync(id),
    );
  };
  const publish = (id: string) => {
    runOnce(`announcement:${id}`, () =>
      publishAnnouncementMutation.mutateAsync(id),
    );
  };
  const logout = async () => {
    await firebaseLogout();
    navigate("/login");
  };
  const navItems: [AdminSection, string, typeof LayoutDashboard][] = [
    ["overview", "Overview", LayoutDashboard],
    ["members", "Membership", UsersRound],
    ["startups", "Startups", Rocket],
    ["announcements", "Announcements", Megaphone],
  ];
  useLayoutEffect(() => {
    if (section !== "overview") return;
    const context = gsap.context(() => {
      gsap.fromTo(
        ".admin-animate",
        { autoAlpha: 0, y: 22 },
        {
          autoAlpha: 1,
          y: 0,
          stagger: 0.08,
          duration: 0.58,
          ease: "power3.out",
          clearProps: "transform",
        },
      );
      gsap.fromTo(
        ".admin-metric-card",
        { autoAlpha: 0, y: 16, scale: 0.97 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          stagger: 0.06,
          duration: 0.5,
          ease: "back.out(1.25)",
          clearProps: "transform",
        },
      );
    }, overviewScope);
    return () => context.revert();
  }, [section]);
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a
          className="admin-mark"
          href={`${PUBLIC_SITE_URL}/login`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/assets/hsl-mark.png" alt="HSL" />
        </a>
        <div className="admin-brand">
          <p>HSL HUB</p>
          <strong>Admin Portal</strong>
          <span>General Admin</span>
        </div>
        <nav>
          {navItems.map(([id, label, Icon]) => (
            <button
              key={id}
              className={section === id ? "is-active" : ""}
              onClick={() => setSection(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a
            className="admin-sidebar-action"
            href={`${PUBLIC_SITE_URL}/login`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Home size={16} />
            <span>Public site</span>
            <ArrowUpRight size={15} className="admin-sidebar-action-arrow" />
          </a>
          <button className="admin-sidebar-action" onClick={logout}>
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">HSL management hub</p>
            <h1>
              {section === "overview"
                ? "Overview"
                : section === "members"
                  ? "Members"
                  : section === "startups"
                    ? "Startup review"
                    : "Announcements"}
            </h1>
          </div>
          <div className="admin-user">
            <button
              className="admin-theme-toggle"
              type="button"
              onClick={() => toggleTheme()}
              title={theme === "dark" ? "Use light mode" : "Use dark mode"}
              aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <span className="topbar-avatar">{initials}</span>
            <div>
              <strong>{profileName}</strong>
              <small>General Admin</small>
            </div>
            <button
              className="admin-mobile-logout"
              type="button"
              onClick={logout}
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        {sectionError ? (
          <section className="admin-content">
            <ErrorState
              error={sectionError}
              onRetry={retrySection}
              isRetrying={isRetryingSection}
              actions={
                describeErrorKind(sectionError) === "unauthorized" ? (
                  <button className="button button--outline" onClick={logout}>
                    Sign in again
                  </button>
                ) : undefined
              }
            />
          </section>
        ) : isLoading ? (
          <section className="admin-content">
            <div className="admin-empty">
              <ClipboardCheck size={19} />
              <strong>Loading data...</strong>
              <p>Please wait while the dashboard loads.</p>
            </div>
          </section>
        ) : (
          <>
            {section === "overview" && (
              <section className="admin-content" ref={overviewScope}>
                <div className="admin-welcome admin-animate">
                  <div>
                    <p className="eyebrow eyebrow--light">Admin overview</p>
                    <h2>The community, at a glance.</h2>
                    <p>
                      Review members, startup submissions, announcements, and
                      the administrative calendar.
                    </p>
                  </div>
                  <button
                    className="button button--white"
                    onClick={() => setSection("members")}
                  >
                    View members <ChevronRight size={14} />
                  </button>
                </div>
                <div className="admin-metrics">
                  {[
                    ["Total members", metrics.activeMembers, "members"],
                    ["Pending startups", metrics.pendingStartups, "startups"],
                    ["Approved startups", metrics.approvedStartups, "startups"],
                    [
                      "Published announcements",
                      metrics.announcements,
                      "announcements",
                    ],
                  ].map(([label, value, target]) => (
                    <button
                      className="admin-metric-card"
                      key={label}
                      onClick={() => setSection(target as AdminSection)}
                    >
                      <span>{label}</span>
                      <AnimatedMetricNumber value={Number(value)} />
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
                <AdminOverviewChart
                  totalMembers={metrics.activeMembers}
                  pendingStartups={metrics.pendingStartups}
                  approvedStartups={metrics.approvedStartups}
                />
                <div className="admin-overview-grid">
                  <section className="admin-panel admin-animate">
                    <div className="admin-panel-title">
                      <div>
                        <p className="eyebrow">Latest</p>
                        <h3>Recent members</h3>
                      </div>
                      <button
                        className="inline-action"
                        onClick={() => setSection("members")}
                      >
                        See all <ChevronRight size={13} />
                      </button>
                    </div>
                    {applications.slice(0, 3).map((item) => (
                      <button
                        className="admin-review-row"
                        key={item.id}
                        onClick={() => {
                          setSelectedApplication(item);
                          setSection("members");
                        }}
                      >
                        <span className="admin-initial">
                          {item.applicant.slice(-3)}
                        </span>
                        <div>
                          <strong>{item.applicant}</strong>
                          <small>
                            {item.course} · {item.field}
                          </small>
                        </div>
                        <time>{item.submitted}</time>
                      </button>
                    ))}
                  </section>
                  <section className="admin-panel admin-animate">
                    <div className="admin-panel-title">
                      <div>
                        <p className="eyebrow">Recent activity</p>
                        <h3>Startup submissions</h3>
                      </div>
                      <button
                        className="inline-action"
                        onClick={() => setSection("startups")}
                      >
                        See all <ChevronRight size={13} />
                      </button>
                    </div>
                    {startups
                      .filter((item) => item.status === "Pending")
                      .slice(0, 3)
                      .map((item) => (
                        <button
                          className="admin-review-row"
                          key={item.id}
                          onClick={() => {
                            setSelectedStartup(item);
                            setSection("startups");
                          }}
                        >
                          <span className="admin-initial">{item.name[0]}</span>
                          <div>
                            <strong>{item.name}</strong>
                            <small>
                              {item.category} · {item.stage}
                            </small>
                          </div>
                          <time>{item.submitted}</time>
                        </button>
                      ))}
                  </section>
                </div>
              </section>
            )}
            {section === "members" && (
              <section className="admin-content">
                <div className="admin-section-tools">
                  <p className="admin-helper">
                    View all registered members and their profile details.
                  </p>
                  <div className="admin-search">
                    <Search size={16} />
                    <input
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Search by name, email, or field"
                    />
                  </div>
                </div>
                <section className="admin-table-panel">
                  <div className="admin-table-heading">
                    <span>Member</span>
                    <span>Academic information</span>
                    <span>Joined</span>
                    <span />
                  </div>
                  {memberRows.map((item) => (
                    <div className="admin-table-row" key={item.id}>
                      <div>
                        <strong>{item.applicant}</strong>
                        <small>{item.email}</small>
                      </div>
                      <div>
                        <strong>{item.course}</strong>
                        <small>{item.field}</small>
                      </div>
                      <time>{item.submitted}</time>
                      <button
                        className="button button--outline admin-small-action"
                        onClick={() => setSelectedApplication(item)}
                      >
                        View
                      </button>
                    </div>
                  ))}
                  {memberRows.length === 0 && (
                    <div className="admin-empty">
                      <ClipboardCheck size={19} />
                      <strong>No members found</strong>
                      <p>Try a different search term.</p>
                    </div>
                  )}
                </section>
              </section>
            )}
            {section === "startups" && (
              <section className="admin-content">
                <div className="admin-section-tools">
                  <p className="admin-helper">
                    Review each submission's name, stage, description, founder,
                    and category before granting it a place on the platform.
                  </p>
                  <div className="admin-tabs">
                    {(
                      [
                        "All",
                        "Pending",
                        "Approved",
                        "Rejected",
                        "Deleted",
                      ] as const
                    ).map((status) => (
                      <button
                        key={status}
                        className={startupStatus === status ? "is-active" : ""}
                        onClick={() => setStartupStatus(status)}
                      >
                        {status}
                        {status === "Pending" && (
                          <em>{metrics.pendingStartups}</em>
                        )}
                        {status === "Rejected" &&
                          metrics.rejectedStartups > 0 && (
                            <em>{metrics.rejectedStartups}</em>
                          )}
                        {status === "Deleted" &&
                          metrics.deletedStartups > 0 && (
                            <em>{metrics.deletedStartups}</em>
                          )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="admin-governance-note" role="note">
                  <Info size={15} />
                  <p>
                    <strong>
                      Startups are governed by HSL administrators.
                    </strong>{" "}
                    Every submission is reviewed before it goes live.
                    Administrators may approve, reject, or permanently delete a
                    startup; permanent deletion is available only after a
                    startup has been rejected or removed by its founder.
                  </p>
                </div>
                {startupStatus === "Deleted" && (
                  <div
                    className="admin-governance-note admin-governance-note--warn"
                    role="note"
                  >
                    <TriangleAlert size={15} />
                    <p>
                      <strong>Removed by their founders.</strong> These startups
                      are no longer visible on the platform but remain on
                      record. They can be restored only through platform
                      support.
                    </p>
                  </div>
                )}
                {startupRows.length === 0 && (
                  <div className="admin-empty">
                    <ClipboardCheck size={19} />
                    <strong>No startups here</strong>
                    <p>
                      {startupStatus === "Deleted"
                        ? "No founder has deleted a startup."
                        : "Nothing matches this filter yet."}
                    </p>
                  </div>
                )}
                <div className="admin-startup-grid">
                  {startupRows.map((item) => (
                    <article key={item.id}>
                      <div className="admin-startup-card-top">
                        <span className="admin-startup-logo">
                          {item.name[0]}
                        </span>
                        <StatusPill status={item.status} />
                      </div>
                      <p className="eyebrow">
                        {item.category} · {item.stage}
                      </p>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className="admin-startup-card-footer">
                        <span>By {item.founder}</span>
                        <button
                          className="inline-action"
                          onClick={() => setSelectedStartup(item)}
                        >
                          Review <ChevronRight size={13} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {section === "announcements" && (
              <section className="admin-content">
                <div className="admin-section-tools">
                  <p className="admin-helper">
                    Manage messages shown to members. Published announcements
                    can be edited or deleted.
                  </p>
                  <button
                    className="button button--black"
                    onClick={() => {
                      setEditingAnnouncement(null);
                      setComposeOpen(true);
                    }}
                  >
                    <Plus size={15} />
                    Create announcement
                  </button>
                </div>
                <section className="admin-announcement-list">
                  {announcements.map((item) => {
                    const rowAction = announcementRowAction(item.id);
                    return (
                      <article
                        key={item.id}
                        className={rowAction ? "is-busy" : undefined}
                        aria-busy={Boolean(rowAction)}
                      >
                        <div className="admin-announcement-icon">
                          <Megaphone size={17} />
                        </div>
                        <div>
                          <div className="announcement-title-line">
                            <h3>{item.title}</h3>
                            <StatusPill status={item.state} />
                          </div>
                          <p>{item.message}</p>
                          <small>
                            {item.date} · {item.author}
                          </small>
                        </div>
                        <div className="admin-announcement-actions">
                          <button
                            className="button button--outline admin-small-action"
                            disabled={Boolean(rowAction)}
                            onClick={() => {
                              setEditingAnnouncement(item);
                              setComposeOpen(true);
                            }}
                          >
                            <Pencil size={13} />
                            Edit
                          </button>
                          {item.state === "Draft" && (
                            <LoadingButton
                              className="button button--outline admin-small-action"
                              loading={rowAction === "publish"}
                              loadingText="Publishing…"
                              disabled={Boolean(rowAction)}
                              onClick={() => publish(item.id)}
                            >
                              Publish <Send size={13} />
                            </LoadingButton>
                          )}
                          <LoadingButton
                            className="button button--outline admin-small-action admin-danger-action"
                            loading={rowAction === "delete"}
                            loadingText="Deleting…"
                            disabled={Boolean(rowAction)}
                            onClick={() => removeAnnouncement(item.id)}
                          >
                            <Trash2 size={13} />
                            Delete
                          </LoadingButton>
                        </div>
                      </article>
                    );
                  })}
                </section>
              </section>
            )}
          </>
        )}
        {selectedApplication && (
          <div className="app-modal-backdrop">
            <section className="admin-modal app-modal">
              <button
                className="modal-close"
                onClick={() => setSelectedApplication(null)}
              >
                <X size={18} />
              </button>
              <p className="eyebrow">Member profile</p>
              <h2>{selectedApplication.applicant}</h2>
              <p>Member details and academic information.</p>
              <dl className="admin-detail-list">
                <div>
                  <dt>Email</dt>
                  <dd>{selectedApplication.email}</dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>{selectedApplication.contact}</dd>
                </div>
                <div>
                  <dt>Course</dt>
                  <dd>{selectedApplication.course}</dd>
                </div>
                <div>
                  <dt>Field</dt>
                  <dd>{selectedApplication.field}</dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>{selectedApplication.level}</dd>
                </div>
                <div>
                  <dt>Community</dt>
                  <dd>{selectedApplication.community}</dd>
                </div>
                <div>
                  <dt>About</dt>
                  <dd className="admin-detail-about">
                    {selectedApplication.about}
                  </dd>
                </div>
                <div>
                  <dt>Joined</dt>
                  <dd>{selectedApplication.submitted}</dd>
                </div>
              </dl>
              <div className="admin-modal-actions">
                <button
                  className="button button--black"
                  onClick={() => setSelectedApplication(null)}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
        )}
        {selectedStartup && (
          <div className="app-modal-backdrop">
            <form
              className="admin-modal app-modal"
              onSubmit={handleStartupSubmit}
            >
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedStartup(null)}
                disabled={isStartupBusy}
              >
                <X size={18} />
              </button>
              <p className="eyebrow">
                Startup submission · {selectedStartup.id}
              </p>
              <h2>{selectedStartup.name}</h2>
              <p>{selectedStartup.description}</p>
              <dl className="admin-detail-list">
                <div>
                  <dt>Founder</dt>
                  <dd>{selectedStartup.founder}</dd>
                </div>
                <div>
                  <dt>Founder phone</dt>
                  <dd className="admin-copy-field">
                    {selectedStartup.founderPhone ? (
                      <>
                        <span>{selectedStartup.founderPhone}</span>
                        <button
                          type="button"
                          className="admin-copy-button"
                          onClick={() =>
                            copyFounderPhone(selectedStartup.founderPhone)
                          }
                          aria-label="Copy founder phone number"
                          title="Copy phone number"
                        >
                          <Copy size={13} />
                          Copy
                        </button>
                      </>
                    ) : (
                      "Not provided"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{selectedStartup.category}</dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{selectedStartup.stage}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{selectedStartup.submitted}</dd>
                </div>
                {selectedStartup.status === "Approved" && (
                  <div>
                    <dt>Members</dt>
                    <dd>{selectedStartup.memberCount}</dd>
                  </div>
                )}
                <div>
                  <dt>Current status</dt>
                  <dd>
                    <StatusPill status={selectedStartup.status} />
                  </dd>
                </div>
                {selectedStartup.status === "Deleted" &&
                  selectedStartup.deletedAt && (
                    <div>
                      <dt>Deleted</dt>
                      <dd>{formatRelativeDate(selectedStartup.deletedAt)}</dd>
                    </div>
                  )}
              </dl>
              {selectedStartup.status === "Deleted" && (
                <div className="admin-deleted-notice">
                  <p>
                    <strong>Founder enquiries.</strong> To learn why this
                    startup was deleted, contact the founder at{" "}
                    {selectedStartup.founderEmail ? (
                      <a href={`mailto:${selectedStartup.founderEmail}`}>
                        {selectedStartup.founderEmail}
                      </a>
                    ) : (
                      "the email address on their profile"
                    )}
                    .
                  </p>
                  <p>
                    <strong>Restoration.</strong> A deleted startup can be
                    restored only after contacting platform support.
                  </p>
                </div>
              )}
              {(selectedStartup.status === "Pending" ||
                selectedStartup.status === "Approved") && (
                <p className="admin-modal-hint">
                  To permanently delete this startup, reject it first.
                </p>
              )}
              <div className="admin-modal-actions">
                {selectedStartup.status === "Approved" && (
                  <a
                    className="button button--outline admin-modal-actions-start"
                    href={`${PUBLIC_SITE_URL}/startups/${encodeURIComponent(selectedStartup.realId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} />
                    View on public site
                  </a>
                )}
                {PERMANENTLY_DELETABLE.includes(selectedStartup.status) && (
                  <button
                    type="button"
                    className="button button--outline admin-danger-action admin-modal-actions-start"
                    onClick={() => setStartupToPurge(selectedStartup)}
                    disabled={isStartupBusy}
                  >
                    <Trash2 size={14} />
                    Delete forever
                  </button>
                )}
                {STARTUP_ACTIONS[selectedStartup.status].includes(
                  "Rejected",
                ) && (
                  <LoadingButton
                    name="decision"
                    value="Rejected"
                    className="button button--outline"
                    type="submit"
                    loading={pendingDecision === "REJECTED"}
                    loadingText={
                      selectedStartup.status === "Approved"
                        ? "Taking offline…"
                        : "Rejecting…"
                    }
                    disabled={isStartupBusy}
                  >
                    {selectedStartup.status === "Approved"
                      ? "Reject & take offline"
                      : "Reject"}
                  </LoadingButton>
                )}
                {STARTUP_ACTIONS[selectedStartup.status].includes(
                  "Approved",
                ) && (
                  <LoadingButton
                    name="decision"
                    value="Approved"
                    className="button button--black"
                    type="submit"
                    loading={pendingDecision === "APPROVED"}
                    loadingText="Approving…"
                    disabled={isStartupBusy}
                  >
                    {selectedStartup.status === "Rejected"
                      ? "Approve instead"
                      : "Approve startup"}{" "}
                    <Check size={14} />
                  </LoadingButton>
                )}
              </div>
            </form>
          </div>
        )}
        {startupToPurge && (
          <div className="app-modal-backdrop app-modal-backdrop--top">
            <section
              className="admin-modal app-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="purge-startup-title"
            >
              <button
                type="button"
                className="modal-close"
                onClick={() => setStartupToPurge(null)}
                disabled={purgeStartupMutation.isPending}
              >
                <X size={18} />
              </button>
              <p className="eyebrow">Permanent action</p>
              <h2 id="purge-startup-title">
                Delete {startupToPurge.name} forever?
              </h2>
              <p>
                This permanently erases the startup together with its
                memberships, tasks, and assignments. It cannot be undone and
                platform support will not be able to restore it.
              </p>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="button button--outline"
                  onClick={() => setStartupToPurge(null)}
                  disabled={purgeStartupMutation.isPending}
                >
                  Cancel
                </button>
                <LoadingButton
                  type="button"
                  className="button admin-danger-solid"
                  onClick={() => purgeStartup(startupToPurge.realId)}
                  loading={purgeStartupMutation.isPending}
                  loadingText="Deleting forever…"
                >
                  <Trash2 size={14} />
                  Yes, delete forever
                </LoadingButton>
              </div>
            </section>
          </div>
        )}
        {composeOpen && (
          <div className="app-modal-backdrop">
            <form
              className="admin-compose app-modal"
              aria-busy={isSavingAnnouncement}
              onSubmit={(event) => {
                event.preventDefault();
                saveAnnouncement(event.currentTarget, "Published");
              }}
            >
              <button
                className="modal-close"
                type="button"
                onClick={closeCompose}
                disabled={isSavingAnnouncement}
              >
                <X size={18} />
              </button>
              <p className="eyebrow">All members</p>
              <h2>
                {editingAnnouncement ? "Edit announcement" : "New announcement"}
              </h2>
              <p>Compose a clear update for every approved HSL member.</p>
              {/* Inputs lock while saving; values survive a failed request. */}
              <fieldset
                className="admin-compose-fields"
                disabled={isSavingAnnouncement}
              >
                <label>
                  Title
                  <input
                    name="title"
                    required
                    defaultValue={editingAnnouncement?.title || ""}
                    placeholder="What should members know?"
                  />
                </label>
                <label>
                  Message
                  <textarea
                    name="message"
                    required
                    rows={5}
                    defaultValue={editingAnnouncement?.message || ""}
                    placeholder="Write the essential details, next steps, and timing."
                  />
                </label>
              </fieldset>
              <div className="admin-modal-actions">
                <LoadingButton
                  type="button"
                  className="button button--outline"
                  loading={savingState === "Draft"}
                  loadingText="Saving draft…"
                  disabled={isSavingAnnouncement}
                  onClick={(event) => {
                    const form = event.currentTarget.form;
                    if (form) saveAnnouncement(form, "Draft");
                  }}
                >
                  Save draft
                </LoadingButton>
                <LoadingButton
                  type="submit"
                  className="button button--black"
                  loading={savingState === "Published"}
                  loadingText={
                    editingAnnouncement ? "Saving changes…" : "Publishing…"
                  }
                  disabled={isSavingAnnouncement}
                >
                  {editingAnnouncement ? "Save changes" : "Publish to all"}{" "}
                  <Send size={14} />
                </LoadingButton>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
