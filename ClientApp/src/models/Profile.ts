export type Subscription = "Basic" | "Plus" | "Pro";

export interface DemoProfile {
  displayName: string;
  fullName: string;
  phone: string;
  about: string;
  email: string | null;
  subscription: Subscription;
  avatarUrl: string | null;
  refreshMinutes: number;
  loginEmail: string;
  notificationsEnabled: boolean;
  compactTable: boolean;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}
