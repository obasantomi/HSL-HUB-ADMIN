import apiClient from "./apiClient";

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  profile: {
    id: string;
    name: string;
    description: string;
    level: string;
    course: string;
    field: string | null;
    fieldOther: string | null;
    skillLevel: string;
    portfolioUrl: string | null;
    telegramPhone: string;
    community: { id: string; name: string } | null;
  } | null;
  memberships: Array<{
    id: string;
    role: string;
    joinedAt: string;
    startup: { id: string; name: string };
  }>;
  membershipCount: number;
  taskCount: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalStartups: number;
  pendingStartups: number;
  approvedStartups: number;
  rejectedStartups: number;
  totalAnnouncements: number;
  publishedAnnouncements: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
  author: { id: string; name: string } | null;
}

export async function fetchCurrentUser(): Promise<{ id: string; email: string; role: string; profile: { name: string } | null }> {
  const response = await apiClient.get<{ status: string; data: { user: { id: string; email: string; role: string; profile: { name: string } | null } } }>("/auth/me");
  return response.data.data.user;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const response = await apiClient.get<{ status: string; data: { users: AdminUser[] } }>("/admin/users");
  return response.data.data.users;
}

export async function fetchAdminDashboard(): Promise<AdminDashboardStats> {
  const response = await apiClient.get<{ status: string; data: { dashboard: AdminDashboardStats } }>("/admin/dashboard");
  return response.data.data.dashboard;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const response = await apiClient.get<{ status: string; data: { announcements: Announcement[] } }>("/announcements");
  return response.data.data.announcements;
}

export async function createAnnouncement(data: { title: string; content: string; published: boolean }): Promise<Announcement> {
  const response = await apiClient.post<{ status: string; data: { announcement: Announcement } }>("/announcements", data);
  return response.data.data.announcement;
}

export async function updateAnnouncement(id: string, data: { title?: string; content?: string; published?: boolean }): Promise<Announcement> {
  const response = await apiClient.patch<{ status: string; data: { announcement: Announcement } }>(`/announcements/${id}`, data);
  return response.data.data.announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await apiClient.delete(`/announcements/${id}`);
}

export async function fetchAllStartups(): Promise<Array<{
  id: string;
  name: string;
  description: string;
  industry: string;
  stage: string;
  status: string;
  createdAt: string;
  owner: { id: string; name: string; profileUrl: string | null };
  memberCount: number;
}>> {
  const response = await apiClient.get<{ status: string; data: { startups: Array<{
    id: string;
    name: string;
    description: string;
    industry: string;
    stage: string;
    status: string;
    createdAt: string;
    owner: { id: string; name: string; profileUrl: string | null };
    memberCount: number;
  }> } }>("/startups?status=all");
  return response.data.data.startups;
}

export async function updateStartupStatus(id: string, status: "APPROVED" | "REJECTED"): Promise<void> {
  await apiClient.patch(`/startups/${id}/status`, { status });
}
