export type AdminUser = {
  id: string;
  name: string;
  roleKey: "bruger" | "bruger2";
  role: string;
  access: string;
  permissions: Array<{
    label: string;
    description: string;
    path: string;
  }>;
};

export const ADMIN_USERS: AdminUser[] = [
  {
    id: "bruger-1",
    name: "Bruger 1",
    roleKey: "bruger",
    role: "Bruger",
    access: "Ledige vikarer",
    permissions: [
      {
        label: "Ledige vikarer",
        description: "Kan se vikaroversigten med ledige og aktive vikarer.",
        path: "/admin/workers",
      },
    ],
  },
  {
    id: "bruger-2",
    name: "Bruger 2",
    roleKey: "bruger2",
    role: "Bruger",
    access: "Ledige vikarer",
    permissions: [
      {
        label: "Ledige vikarer",
        description: "Kan se vikaroversigten med ledige og aktive vikarer.",
        path: "/admin/workers",
      },
    ],
  },
];

export function findAdminUser(id: string): AdminUser | undefined {
  return ADMIN_USERS.find((user) => user.id === id);
}
