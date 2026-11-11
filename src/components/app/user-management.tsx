"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  AlertCircle,
  Building2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  KeyRound,
  ListChecks,
  Mail,
  Lock,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserCog,
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { createUserAction, type SystemState } from "@/server/actions/system";
import {
  deleteUserAction,
  getUserMenuPermissionAction,
  resetUserPasswordAction,
  saveUserMenuPermissionAction,
  setUserSingleRoleAction,
  updateUserAvatarAction,
  updateUserProfileAction,
} from "@/server/actions/user-management";

export interface RoleOption {
  id: string;
  name: string;
  slug: string;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface MenuOption {
  href: string;
  label: string;
  group: string;
}

export interface UserRowData {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  branchId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  roleIds: string[];
  avatarUrl?: string | null;
}

interface Props {
  users: UserRowData[];
  roles: RoleOption[];
  branches: BranchOption[];
  menuOptions: MenuOption[];
  currentUserId: string;
  currentUserIsSuper: boolean;
}

type RoleStyle = { icon: React.ComponentType<{ size?: number; className?: string }>; iconClass: string; bg: string; text: string; ring: string };

const ROLE_STYLE: Record<string, RoleStyle> = {
  superadmin: { icon: Crown, iconClass: "text-amber-600", bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200" },
  sales: { icon: UserCheck, iconClass: "text-sky-600", bg: "bg-sky-50", text: "text-sky-600", ring: "ring-sky-200" },
  ops: { icon: UserCog, iconClass: "text-emerald-600", bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200" },
  acct: { icon: Calculator, iconClass: "text-purple-600", bg: "bg-purple-50", text: "text-purple-600", ring: "ring-purple-200" },
};

const FALLBACK_STYLE: RoleStyle = {
  icon: Shield,
  iconClass: "text-primary",
  bg: "bg-primary/10",
  text: "text-primary",
  ring: "ring-primary/20",
};

function styleOf(slug: string): RoleStyle {
  return ROLE_STYLE[slug] ?? FALLBACK_STYLE;
}

function usageStatus(u: UserRowData, currentUserId: string) {
  if (u.id === currentUserId) {
    return { label: "Sedang Dipakai", tone: "text-sky-700 bg-sky-50", detail: "Akun yang sedang aktif digunakan sekarang." };
  }
  if (u.lastLoginAt) {
    return { label: "Sudah Pernah Dipakai", tone: "text-sky-600 bg-sky-50", detail: "Akun ini pernah dipakai masuk ke sistem." };
  }
  return { label: "Belum Pernah Dipakai", tone: "text-amber-700 bg-amber-50", detail: "Akun sudah dibuat, tetapi belum pernah login." };
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : "-";

const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

const inputCls =
  "w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";

export function UserManagement({ users, roles, branches, menuOptions, currentUserId, currentUserIsSuper }: Props) {
  const router = useRouter();

  const manageableRoles = useMemo(
    () => roles.filter((r) => currentUserIsSuper || r.slug !== "superadmin"),
    [roles, currentUserIsSuper]
  );
  const primaryRoleOf = (u: UserRowData) => roles.find((r) => u.roleIds.includes(r.id));
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
    [users]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", phone: "" });

  const [, createAction, createPending] = useActionState(
    async (_prev: SystemState, fd: FormData): Promise<SystemState> => {
      const res = await createUserAction(_prev, fd);
      if (res?.success) {
        toast.success("Akun baru berhasil dibuat.");
        setCreateForm({ name: "", email: "", password: "", phone: "" });
        setShowCreateForm(false);
        router.refresh();
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    undefined
  );

  const [selectedUser, setSelectedUser] = useState<UserRowData | null>(null);
  const [showDeleteAsk, setShowDeleteAsk] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [resetForm, setResetForm] = useState({ password: "", confirmPassword: "" });

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingReset, setSavingReset] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [, startToggling] = useTransition();
  const [toggleAsk, setToggleAsk] = useState<UserRowData | null>(null);

  const filtered = sortedUsers.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const role = primaryRoleOf(u);
    const matchRole = !roleFilter || (role && role.slug === roleFilter);
    return matchQ && matchRole;
  });

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageUsers = filtered.slice(pageStart, pageStart + pageSize);
  const pageWindowStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => pageWindowStart + i);

  const roleCounts = roles.reduce<Record<string, number>>((acc, r) => {
    acc[r.slug] = users.filter((u) => u.roleIds.includes(r.id)).length;
    return acc;
  }, {});

  const isSelf = (u: UserRowData) => u.id === currentUserId;
  const canTouch = (u: UserRowData) => {
    if (isSelf(u)) return false;
    const role = primaryRoleOf(u);
    return currentUserIsSuper || role?.slug !== "superadmin";
  };

  const openEdit = (u: UserRowData) => {
    setSelectedUser(u);
    setEditForm({ name: u.name, email: u.email });
    setIsEditOpen(true);
  };

  const openReset = (u: UserRowData) => {
    setSelectedUser(u);
    setResetForm({ password: "", confirmPassword: "" });
    setIsResetOpen(true);
  };

  const askDelete = (u: UserRowData) => {
    setSelectedUser(u);
    setShowDeleteAsk(true);
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuCustom, setMenuCustom] = useState(false);
  const [menuChecked, setMenuChecked] = useState<string[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);

  const openMenu = async (u: UserRowData) => {
    setSelectedUser(u);
    setIsMenuOpen(true);
    setMenuLoading(true);
    setMenuCustom(false);
    setMenuChecked([]);
    const res = await getUserMenuPermissionAction(u.id);
    setMenuLoading(false);
    if (res.error) {
      toast.error(res.error);
      setIsMenuOpen(false);
      return;
    }
    if (res.custom && res.menus) {
      setMenuCustom(true);
      setMenuChecked(res.menus);
    }
  };

  const handleSaveMenu = async () => {
    if (!selectedUser) return;
    setSavingMenu(true);
    const res = await saveUserMenuPermissionAction(selectedUser.id, menuCustom ? menuChecked : null);
    setSavingMenu(false);
    if (res.error) return toast.error(res.error);
    toast.success(menuCustom ? `Menu khusus ${selectedUser.name} tersimpan.` : `Menu ${selectedUser.name} kembali mengikuti standar role.`);
    setIsMenuOpen(false);
    setSelectedUser(null);
    router.refresh();
  };

    const handleUploadAvatar = async () => {
    if (!selectedUser || !avatarFile) return;
    setSavingAvatar(true);
    const fd = new FormData();
    fd.set("userId", selectedUser.id);
    fd.set("file", avatarFile);
    const res = await updateUserAvatarAction(fd);
    setSavingAvatar(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Avatar ${selectedUser.name} diperbarui.`);
    setAvatarFile(null);
    router.refresh();
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    const name = editForm.name.trim();
    const email = editForm.email.trim();
    if (name.length < 3) return toast.error("Nama minimal 3 karakter.");
    if (!email) return toast.error("Email login wajib diisi.");
    setSavingEdit(true);
    const res = await updateUserProfileAction(selectedUser.id, { name, email });
    setSavingEdit(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Akun ${selectedUser.name} diperbarui.`);
    setIsEditOpen(false);
    setSelectedUser(null);
    router.refresh();
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (resetForm.password.length < 8) return toast.error("Password baru minimal 8 karakter.");
    if (resetForm.password !== resetForm.confirmPassword) return toast.error("Konfirmasi password belum sama.");
    setSavingReset(true);
    const res = await resetUserPasswordAction(selectedUser.id, resetForm.password);
    setSavingReset(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Password untuk ${selectedUser.name} berhasil direset.`);
    setIsResetOpen(false);
    setSelectedUser(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setDeleting(true);
    const res = await deleteUserAction(selectedUser.id);
    setDeleting(false);
    setShowDeleteAsk(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Pengguna ${selectedUser.name} dihapus dari daftar.`);
    setSelectedUser(null);
    router.refresh();
  };

  const handleRoleChange = (u: UserRowData, roleId: string) => {
    if (isSelf(u)) return toast.error("Keamanan sistem: tidak diizinkan mengubah role diri sendiri.");
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    startToggling(async () => {
      setUpdating(u.id);
      const res = await setUserSingleRoleAction(u.id, roleId);
      if (res.error) toast.error(res.error);
      else toast.success(`Role ${u.name} dialihkan ke ${role.name}.`);
      setUpdating(null);
    });
  };

  const handleToggleActive = (u: UserRowData) => {
    if (isSelf(u) && u.isActive) return toast.error("Tidak bisa menonaktifkan akun sendiri.");
    startToggling(async () => {
      setUpdating(u.id);
      const { toggleUserActiveAction } = await import("@/server/actions/system");
      const res = await toggleUserActiveAction(u.id, !u.isActive);
      if (res.error) toast.error(res.error);
      else toast.success(!u.isActive ? `${u.name} diaktifkan.` : `${u.name} dinonaktifkan.`);
      setUpdating(null);
      router.refresh();
    });
  };


  return (
    <div className="space-y-5 pb-10">
      {/* Header + tombol tambah */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-foreground">
            <UserCheck className="text-primary" size={26} /> Manajemen Pengguna
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola akun, role, dan akses tim Madani Aqiqah.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary-strong"
        >
          {showCreateForm ? <X size={16} /> : <Plus size={16} />}
          {showCreateForm ? "Tutup Form" : "Tambah Pengguna"}
        </button>
      </div>

      {/* Form tambah user */}
      {showCreateForm ? (
        <form action={createAction} className="grid gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <UserCheck size={14} /> Nama
            </span>
            <input required name="name" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Nama pengguna" />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <Mail size={14} /> Email
            </span>
            <input required type="email" name="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} className={inputCls} placeholder="nama@gmail.com" />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <Lock size={14} /> Password
            </span>
            <input required type="password" name="password" minLength={8} value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} className={inputCls} placeholder="Minimal 8 karakter" />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <Building2 size={14} /> Telepon
            </span>
            <input name="phone" value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))} className={inputCls} placeholder="Opsional" />
          </label>
          <div className="flex items-center gap-4 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Role</span>
            {manageableRoles.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="roleIds" value={r.id} className="h-4 w-4 rounded border-input accent-primary" />
                {r.name}
              </label>
            ))}
          </div>
          <div className="flex justify-end border-t border-primary/10 pt-4 md:col-span-2 xl:col-span-4">
            <button type="submit" disabled={createPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary-strong disabled:opacity-50">
              {createPending ? <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <Plus size={16} />}
              {createPending ? "Menyimpan..." : "Simpan Pengguna"}
            </button>
          </div>
        </form>
      ) : null}

      {/* Kartu ringkasan per role */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {roles.map((r) => {
          const st = styleOf(r.slug);
          const Icon = st.icon;
          const count = roleCounts[r.slug] ?? 0;
          return (
            <button
              key={r.id}
              onClick={() => {
                setRoleFilter(roleFilter === r.slug ? "" : r.slug);
                setPage(1);
              }}
              className={`rounded-2xl border p-4 text-left transition shadow-sm ${roleFilter === r.slug ? "border-primary bg-primary/5" : "border-line bg-surface hover:bg-canvas"}`}
            >
              <div className={`mb-3 w-fit rounded-xl p-2 ${st.bg} ${st.text}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-black leading-none text-foreground">{count >= 10 ? count : `0${count}`}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{r.name}</p>
            </button>
          );
        })}
      </div>

      {/* Pencarian */}
      <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm md:flex-row md:items-center">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
          <input
            type="text"
            placeholder="Cari pengguna berdasarkan nama atau email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-line bg-canvas py-2.5 pl-9 pr-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {roleFilter ? (
            <button onClick={() => { setRoleFilter(""); setPage(1); }} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-canvas">
              <X size={15} /> Reset
            </button>
          ) : null}
          <div className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            <ListChecks size={11} />
            <span>{totalFiltered} Pengguna</span>
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Pegawai</th>
                <th className="px-4 py-3">Detail Otentikasi</th>
                <th className="px-4 py-3">Otoritas</th>
                <th className="px-4 py-3">Cabang</th>
                <th className="px-4 py-3 text-right">Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {pageUsers.length > 0 ? (
                pageUsers.map((u) => {
                  const role = primaryRoleOf(u);
                  const st = styleOf(role?.slug ?? "");
                  const RoleIcon = st.icon;
                  const usage = usageStatus(u, currentUserId);
                  const touch = canTouch(u);
                  return (
                    <tr key={u.id} className={`transition hover:bg-canvas ${isSelf(u) ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-black text-lg ${st.bg} ${st.text}`}>
                            {u.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{u.name}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${usage.tone}`}>{usage.label}</span>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${u.isActive ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger-soft-foreground"}`}>{u.isActive ? "Aktif" : "Nonaktif"}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="mb-1.5 text-xs font-bold text-muted-foreground">{u.email}</p>
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                          <Clock size={12} />
                          dibuat {fmtDate(u.createdAt)}
                        </div>
                        <p className="mt-2 text-[10px] font-bold text-muted-foreground">
                          {u.lastLoginAt ? `Login terakhir ${fmtDateTime(u.lastLoginAt)}` : usage.detail}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${st.bg} ${st.text}`}>
                          <RoleIcon size={11} />
                          {role?.name ?? "tanpa role"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-muted-foreground">
                        {branches.find((b) => b.id === u.branchId)?.name ?? "Pusat"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {touch ? (
                            <select
                              value={role?.id ?? ""}
                              onChange={(e) => handleRoleChange(u, e.target.value)}
                              disabled={updating === u.id}
                              className="rounded-xl border border-line bg-canvas px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-primary"
                              aria-label="Ubah role"
                            >
                              {manageableRoles.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          ) : null}
                          {updating === u.id ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /> : null}
                          <div className="flex items-center">
                            {touch ? (
                              <Switch checked={u.isActive} disabled={updating === u.id} onCheckedChange={() => setToggleAsk(u)} aria-label={u.isActive ? "Nonaktifkan" : "Aktifkan"} />
                            ) : null}
                          </div>
                          {touch ? (
                            <button onClick={() => openEdit(u)} className="rounded-xl bg-primary/10 p-2 text-primary transition hover:bg-primary/20" title="Ubah nama & email login">
                              <Pencil size={15} />
                            </button>
                          ) : null}
                          {touch ? (
                            <button onClick={() => void openMenu(u)} className="rounded-xl bg-primary/10 p-2 text-primary transition hover:bg-primary/20" title="Hak akses menu">
                              <ListChecks size={15} />
                            </button>
                          ) : null}
                          {touch ? (
                            <button onClick={() => openReset(u)} className="rounded-xl bg-primary/10 p-2 text-primary transition hover:bg-primary/20" title="Reset password">
                              <KeyRound size={15} />
                            </button>
                          ) : null}
                          {currentUserIsSuper && !isSelf(u) ? (
                            <button onClick={() => askDelete(u)} className="rounded-xl bg-danger/10 p-2 text-danger-soft-foreground transition hover:bg-danger/20" title="Hapus pengguna">
                              <Trash2 size={15} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-xl bg-canvas shadow-inner">
                      <AlertCircle className="text-muted-foreground/40" size={40} />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">Pengguna tidak ditemukan</h3>
                    <p className="mx-auto max-w-xs text-sm text-muted-foreground">Sistem tidak menemukan pengguna dengan kriteria pencarian tersebut.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalFiltered > 0 ? (
          <div className="flex flex-col gap-3 border-t border-line bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-muted-foreground">
              <span>
                Menampilkan <span className="text-foreground">{pageStart + 1}–{Math.min(pageStart + pageSize, totalFiltered)}</span> dari <span className="text-foreground">{totalFiltered}</span> pengguna
              </span>
              <label className="inline-flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Baris</span>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-bold text-foreground outline-none transition focus:border-primary">
                  {[10, 25, 50, 100].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="inline-flex size-9 items-center justify-center rounded-xl border border-line bg-surface text-muted-foreground transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman sebelumnya">
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((n) => (
                <button key={n} type="button" onClick={() => setPage(n)} className={`inline-flex size-9 items-center justify-center rounded-xl border text-xs font-black transition ${n === currentPage ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-line bg-surface text-muted-foreground hover:bg-canvas"}`}>
                  {n}
                </button>
              ))}
              <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className="inline-flex size-9 items-center justify-center rounded-xl border border-line bg-surface text-muted-foreground transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40" aria-label="Halaman berikutnya">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Legend */}
      <div className="relative rotate-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-strong to-black p-10 text-white group">
        <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-md">
            <div className="mb-5 w-fit rounded-xl border border-white/10 bg-white/10 p-4">
              <Shield size={28} className="text-white/80" />
            </div>
            <h4 className="mb-3 text-3xl font-black uppercase tracking-tight">Siklus Otoritas</h4>
            <p className="text-sm font-medium leading-relaxed text-white/70">
              Setiap pengguna diberi role sesuai tanggung jawabnya. Nama & email bisa diubah, password bisa direset, dan pengguna yang keluar cukup dinonaktifkan — riwayat transaksinya tetap aman.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:w-auto">
            {roles.slice(0, 4).map((r) => {
              const st = styleOf(r.slug);
              const Icon = st.icon;
              return (
                <div key={r.id} className="flex items-center gap-5 rounded-xl border border-white/5 bg-white/5 p-5 backdrop-blur-md transition hover:bg-white/10">
                  <div className={`rounded-2xl p-3 ${st.bg}`}>
                    <Icon size={22} className={st.iconClass} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-black uppercase tracking-widest text-white">{r.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{r.slug}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dialog: ubah nama & email */}
      {isEditOpen && selectedUser ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setIsEditOpen(false); setSelectedUser(null); }} />
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Ubah Akun</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-foreground">{selectedUser.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Email di bawah dipakai user untuk login. Role dan password diatur lewat tombol masing-masing di tabel.</p>
              </div>
              <button type="button" onClick={() => { setIsEditOpen(false); setSelectedUser(null); }} className="rounded-full p-2 text-muted-foreground transition hover:bg-canvas">
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground"><UserCheck size={14} /> Nama</span>
                <input className={inputCls} value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nama pengguna" />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground"><Mail size={14} /> Email Login</span>
                <input type="email" className={inputCls} value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} placeholder="nama@gmail.com" />
              </label>
            </div>
            <div className="mt-6 flex items-center gap-4 rounded-xl bg-surface-dim/60 p-4">
              {selectedUser.avatarUrl ? (
                <Image src={selectedUser.avatarUrl} alt={selectedUser.name} width={56} height={56} className="size-14 rounded-full object-cover ring-1 ring-line/10" />
              ) : (
                <span className="grid size-14 place-items-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">{(selectedUser.name || "?").slice(0, 2).toUpperCase()}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground"><ImagePlus className="mr-1 inline size-3" /> Foto profil (avatar — dipakai untuk tampilan kanan atas)</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">JPEG/PNG/WebP maksimal 2 MB.</p>
              </div>
              <button
                type="button"
                disabled={!avatarFile || savingAvatar}
                onClick={() => void handleUploadAvatar()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary-strong disabled:opacity-50"
              >
                {savingAvatar ? "Mengunggah…" : "Unggah"}
              </button>
            </div>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setIsEditOpen(false); setSelectedUser(null); }} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-canvas">
                Batal
              </button>
              <button type="button" disabled={savingEdit} onClick={() => void handleSaveEdit()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary-strong disabled:opacity-50">
                {savingEdit ? <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <Pencil size={16} />}
                {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Dialog: reset password */}
      {isResetOpen && selectedUser ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setIsResetOpen(false); setSelectedUser(null); }} />
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">Reset Password</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-foreground">{selectedUser.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Masukkan password baru. Semua sesi login lama user ini otomatis dicabut.</p>
              </div>
              <button type="button" onClick={() => { setIsResetOpen(false); setSelectedUser(null); }} className="rounded-full p-2 text-muted-foreground transition hover:bg-canvas">
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground"><Lock size={14} /> Password Baru</span>
                <input type="password" className={inputCls} value={resetForm.password} onChange={(e) => setResetForm((p) => ({ ...p, password: e.target.value }))} placeholder="Minimal 8 karakter" />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground"><Lock size={14} /> Konfirmasi Password</span>
                <input type="password" className={inputCls} value={resetForm.confirmPassword} onChange={(e) => setResetForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="Ulangi password baru" />
              </label>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setIsResetOpen(false); setSelectedUser(null); }} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-canvas">
                Batal
              </button>
              <button type="button" disabled={savingReset} onClick={() => void handleResetPassword()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary-strong disabled:opacity-50">
                {savingReset ? <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <KeyRound size={16} />}
                {savingReset ? "Menyimpan..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={showDeleteAsk}
        onOpenChange={setShowDeleteAsk}
        title="Hapus Pengguna Ini?"
        description={`${selectedUser?.name ?? "Pengguna"} akan dihapus dari daftar dan sesinya dicabut. Riwayat transaksi tetap tersimpan (soft delete).`}
        confirmLabel="Ya, hapus"
        tone="danger"
        pending={deleting}
        onConfirm={() => void handleDelete()}
      />

      {/* Konfirmasi on/off aktif */}
      <ConfirmDialog
        open={!!toggleAsk}
        onOpenChange={(v) => !v && setToggleAsk(null)}
        title={toggleAsk?.isActive ? "Nonaktifkan pengguna ini?" : "Aktifkan pengguna ini?"}
        description={toggleAsk?.isActive ? "Pengguna tidak akan bisa masuk sampai diaktifkan kembali." : "Pengguna akan bisa masuk kembali ke aplikasi."}
        confirmLabel={toggleAsk?.isActive ? "Ya, nonaktifkan" : "Ya, aktifkan"}
        tone={toggleAsk?.isActive ? "danger" : "info"}
        pending={updating === toggleAsk?.id}
        onConfirm={() => {
          if (toggleAsk) void handleToggleActive(toggleAsk);
          setToggleAsk(null);
        }}
      />

      {/* Dialog: Hak Akses Menu User */}
      {isMenuOpen && selectedUser ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setIsMenuOpen(false); setSelectedUser(null); }} />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Hak Akses Menu</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-foreground">{selectedUser.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
              <button type="button" onClick={() => { setIsMenuOpen(false); setSelectedUser(null); }} className="rounded-full p-2 text-muted-foreground transition hover:bg-canvas">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {menuLoading ? (
                <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  Memuat izin menu...
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-canvas p-4">
                    <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${menuCustom ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <ListChecks size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        Default: mengikuti standar role ({selectedUser.name === "Super Admin" ? "Super Admin" : "role akun ini"}).
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Centang menu di bawah untuk memberi/menarik akses khusus user ini.
                      </p>
                    </div>
                  </div>

                  <label className="mb-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3 transition hover:border-primary/30">
                    <span className="flex items-center gap-3">
                      <Shield size={18} className={menuCustom ? "text-primary" : "text-muted-foreground"} />
                      <span>
                        <span className="block text-sm font-bold text-foreground">Izin khusus menu</span>
                        <span className="block text-xs text-muted-foreground">Mengikuti standar role. Perubahan di bawah akan menjadi menu khusus user ini.</span>
                      </span>
                    </span>
                    <Switch checked={menuCustom} onCheckedChange={setMenuCustom} />
                  </label>

                  {menuCustom ? (
                    <div className="space-y-5">
                      {(() => {
                        const groups = Array.from(new Map(menuOptions.map((m) => [m.group, m.group])).keys());
                        return groups.map((group) => {
                          const items = menuOptions.filter((m) => m.group === group);
                          return (
                            <div key={group}>
                              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{group}</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {items.map((item) => {
                                  const isDash = item.href === "/dashboard";
                                  const checked = menuChecked.includes(item.href);
                                  return (
                                    <button
                                      key={item.href}
                                      type="button"
                                      disabled={isDash}
                                      onClick={() =>
                                        setMenuChecked((prev) =>
                                          checked ? prev.filter((h) => h !== item.href) : [...prev, item.href]
                                        )
                                      }
                                      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${isDash ? "border-line bg-canvas opacity-60" : checked ? "border-primary bg-primary/5" : "border-line bg-canvas hover:border-primary/30"}`}
                                    >
                                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <span className={`grid size-4 place-items-center rounded border ${checked ? "border-primary bg-primary" : "border-muted-foreground/40 bg-surface"}`}>
                                          {checked ? <span className="block h-2 w-2 rounded-sm bg-primary-foreground" /> : null}
                                        </span>
                                        {item.label}
                                        {isDash ? <span className="text-[10px] font-bold uppercase text-muted-foreground">wajib</span> : null}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setIsMenuOpen(false); setSelectedUser(null); }} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-canvas">
                Batal
              </button>
              <button type="button" disabled={savingMenu || menuLoading} onClick={() => void handleSaveMenu()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary-strong disabled:opacity-50">
                {savingMenu ? <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <ListChecks size={16} />}
                {savingMenu ? "Menyimpan..." : "Simpan Izin Menu"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

