"use client";

import { settingsSections } from "@/lib/settings-sections";
import { useRef, useState, type ReactNode, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { controlClass, FormField, MutationError } from "@/components/grades/form-parts";
import { adminCommandSchema, type AdminCommand, type AdminUserView } from "@/lib/admin/commands";
import type { MessageKey } from "@/lib/i18n/messages";
import { PasswordMatchHint } from "@/components/auth/password-match-hint";
import { usernameSchema } from "@/lib/auth/validation";

const errorMessages: Record<string, MessageKey> = {
  INVALID_INPUT: "invalidInput",
  UNAUTHENTICATED: "gradeSignIn",
  FORBIDDEN: "gradeForbidden",
  PASSWORD_CHANGE_REQUIRED: "passwordRequired",
  NOT_FOUND: "adminNotFound",
  SELF_ACTION: "adminSelfAction",
  LAST_ADMIN: "lastAdmin",
  USERNAME_TAKEN: "usernameTaken",
  CONFIRMATION_REQUIRED: "adminConfirmation",
};
type TargetAction = Exclude<AdminCommand["action"], "create">;
type Selection = { action: "create" } | { action: TargetAction; user: AdminUserView };

export function AdminUsers({
  users,
  currentUserId,
  children,
}: {
  users: AdminUserView[];
  currentUserId: string;
  children?: ReactNode;
}) {
  const { t, locale } = useLanguage();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{t.administration}</h1>
          <span className="rounded-full bg-muted px-3 py-1 text-sm tabular-nums text-muted-foreground">
            {new Intl.NumberFormat(locale).format(users.length)}
            <span className="sr-only"> {t.adminAccounts}</span>
          </span>
        </div>
        <Button
          onClick={() => {
            setNotice(null);
            setSelection({ action: "create" });
          }}
        >
          {t.createUser}
        </Button>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{t.adminHelp}</p>
      {notice && (
        <p role="status" className="rounded-lg bg-muted p-3 text-sm">
          {t[notice]}
        </p>
      )}
      <ul className="space-y-3">
        {users.map((user) => {
          const ownAccount = user.id === currentUserId;
          const username = user.username ?? user.id;
          return (
            <li key={user.id} className="min-w-0">
              <details className="group rounded-2xl bg-card text-card-foreground shadow-surface">
                <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl p-5 hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
                  <span
                    aria-hidden="true"
                    className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary sm:flex"
                  >
                    {username.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="grid min-w-0 flex-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="min-w-0 break-words text-base font-semibold [overflow-wrap:anywhere]">
                          {username}
                        </h2>
                        {ownAccount && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {t.currentAccount}
                          </span>
                        )}
                      </div>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span
                          className={
                            user.role === "ADMIN" ? "font-medium text-primary" : "font-medium"
                          }
                        >
                          <span className="sr-only">{t.userRole}: </span>
                          {user.role}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.createdDate}:{" "}
                          <time dateTime={user.createdAt}>
                            {date.format(new Date(user.createdAt))}
                          </time>
                        </span>
                      </p>
                      {user.mustChangePassword && (
                        <p className="text-xs text-muted-foreground">{t.passwordChangePending}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${user.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                        {user.isActive ? t.active : t.inactiveUser}
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                        {user.twoFactorEnabled ? t.factorOn : t.factorOff}
                      </span>
                    </div>
                  </div>
                  <span className="mt-1 flex shrink-0 items-center gap-2 text-muted-foreground">
                    <span className="sr-only">
                      {t.adminUserActions}: {username}
                    </span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="size-4 group-open:rotate-180"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </summary>
                <div className="space-y-4 p-5">
                  {ownAccount ? (
                    <>
                      <p className="max-w-2xl text-sm text-muted-foreground">{t.ownAdminHelp}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setNotice(null);
                            setSelection({ action: "setUsername", user });
                          }}
                        >
                          {t.setUsername}
                        </Button>
                        <Link
                          href={{ pathname: "/settings", hash: settingsSections.security }}
                          className="inline-flex min-h-10 items-center text-sm text-primary underline underline-offset-4"
                        >
                          {t.settings}
                          <span aria-hidden="true" className="ml-2">
                            →
                          </span>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            "setUsername",
                            "setActive",
                            "setPassword",
                            "forcePasswordChange",
                            "resetTwoFactor",
                          ] as const
                        ).map((action) => (
                          <Button
                            key={action}
                            variant="secondary"
                            onClick={() => {
                              setNotice(null);
                              setSelection({ action, user });
                            }}
                          >
                            {t[actionLabel(action, user)]}
                          </Button>
                        ))}
                      </div>
                      <div className="pt-4">
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setNotice(null);
                            setSelection({ action: "delete", user });
                          }}
                        >
                          {t.deleteUser}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      {children}
      {selection && (
        <AdminDialog
          selection={selection}
          users={users}
          onClose={() => setSelection(null)}
          onSaved={() => {
            setNotice(selection.action === "create" ? "userCreatedHelp" : "adminActionSaved");
            setSelection(null);
          }}
        />
      )}
    </div>
  );
}

function actionLabel(action: TargetAction, user: AdminUserView): MessageKey {
  switch (action) {
    case "setActive":
      return user.isActive ? "deactivateUser" : "activateUser";
    case "setPassword":
      return "setTemporaryPassword";
    case "delete":
      return "deleteUser";
    default:
      return action;
  }
}

function actionHelp(selection: Selection): MessageKey {
  switch (selection.action) {
    case "create":
      return "createUserHelp";
    case "setPassword":
      return "temporaryPasswordHelp";
    case "setUsername":
      return "renameUserHelp";
    case "delete":
      return "deleteUserHelp";
    case "resetTwoFactor":
      return "resetFactorHelp";
    case "forcePasswordChange":
      return "forcePasswordHelp";
    case "setActive":
      return selection.user.isActive ? "deactivateHelp" : "activateHelp";
  }
}

function AdminDialog({
  selection,
  users,
  onClose,
  onSaved,
}: {
  selection: Selection;
  users: AdminUserView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const inFlight = useRef(false);
  const creating = selection.action === "create";
  const usernameNeeded = creating || selection.action === "setUsername";
  const [usernameValue, setUsernameValue] = useState(
    creating ? "" : (selection.user.username ?? ""),
  );
  const parsedUsername = usernameSchema.safeParse(usernameValue);
  const usernameTaken =
    error === "usernameTaken" ||
    (parsedUsername.success &&
      users.some(
        (user) =>
          (creating || user.id !== selection.user.id) &&
          user.username?.toLowerCase() === parsedUsername.data,
      ));
  const passwordNeeded = creating || selection.action === "setPassword";
  const title = creating ? t.createUser : t[actionLabel(selection.action, selection.user)];
  const help = actionHelp(selection);
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    setError(null);
    const form = new FormData(event.currentTarget);
    if (usernameNeeded && usernameTaken) {
      setError("usernameTaken");
      return;
    }
    if (passwordNeeded && form.get("password") !== form.get("repeatPassword")) {
      setError("passwordMismatch");
      return;
    }
    const command = creating
      ? {
          action: "create",
          username: form.get("username"),
          password: form.get("password"),
          role: form.get("role"),
          mustChangePassword: form.has("mustChangePassword"),
        }
      : {
          action: selection.action,
          id: selection.user.id,
          ...(selection.action === "setActive" ? { active: !selection.user.isActive } : {}),
          ...(selection.action === "setPassword" ? { password: form.get("password") } : {}),
          ...(selection.action === "setUsername" ? { username: form.get("username") } : {}),
          ...(selection.action === "delete" ? { confirmation: form.get("confirmation") } : {}),
        };
    const parsed = adminCommandSchema.safeParse(command);
    if (!parsed.success) {
      setError("invalidInput");
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const code =
          body && typeof body === "object" && "code" in body && typeof body.code === "string"
            ? body.code
            : "";
        setError(Object.hasOwn(errorMessages, code) ? errorMessages[code] : "serviceUnavailable");
        return;
      }
      router.refresh();
      onSaved();
    } catch {
      setError("connectionFailed");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog title={title} onClose={onClose} busy={pending}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {!creating && (
          <p className="break-words font-medium">{selection.user.username ?? selection.user.id}</p>
        )}
        <p className="text-sm text-muted-foreground">{t[help]}</p>
        {!creating && <p className="text-sm text-muted-foreground">{t.adminSecurityHelp}</p>}
        <fieldset disabled={pending} className="space-y-4">
          {usernameNeeded && (
            <>
              <FormField label={t.username}>
                <Input
                  name="username"
                  required
                  minLength={3}
                  maxLength={32}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-autofocus
                  value={usernameValue}
                  onChange={(event) => {
                    setUsernameValue(event.target.value);
                    setError(null);
                  }}
                  aria-invalid={usernameTaken}
                  aria-describedby="admin-username-help admin-username-status"
                />
              </FormField>
              <p id="admin-username-help" className="text-xs text-muted-foreground">
                {t.usernameHelp}
              </p>
              <p
                id="admin-username-status"
                role="status"
                className={`text-sm ${usernameTaken ? "text-destructive" : "text-success"}`}
              >
                {parsedUsername.success
                  ? usernameTaken
                    ? t.usernameTaken
                    : t.usernameAvailable
                  : ""}
              </p>
            </>
          )}
          {creating && (
            <>
              <FormField label={t.userRole}>
                <select name="role" className={controlClass} defaultValue="USER">
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </FormField>
            </>
          )}
          {passwordNeeded && (
            <>
              <FormField label={creating ? t.password : t.temporaryPassword}>
                <Input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  data-autofocus={!creating || undefined}
                  value={passwordValue}
                  onChange={(event) => {
                    setPasswordValue(event.target.value);
                    setError(null);
                  }}
                />
              </FormField>
              <div className="space-y-2">
                <FormField label={creating ? t.repeatPassword : t.repeatTemporaryPassword}>
                  <Input
                    name="repeatPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={confirmation}
                    onChange={(event) => {
                      setConfirmation(event.target.value);
                      setError(null);
                    }}
                    aria-describedby="admin-password-match"
                    aria-invalid={confirmation.length > 0 && confirmation !== passwordValue}
                  />
                </FormField>
                <PasswordMatchHint
                  id="admin-password-match"
                  password={passwordValue}
                  confirmation={confirmation}
                />
              </div>
            </>
          )}
          {creating && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                name="mustChangePassword"
                type="checkbox"
                defaultChecked
                className="size-5 shrink-0 accent-primary"
              />
              {t.requireFirstPasswordChange}
            </label>
          )}
          {selection.action === "delete" && (
            <FormField label={t.confirmUsername}>
              <Input
                name="confirmation"
                required
                maxLength={128}
                autoComplete="off"
                spellCheck={false}
              />
            </FormField>
          )}
        </fieldset>
        <MutationError message={error ? t[error] : null} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            data-autofocus={(!passwordNeeded && !usernameNeeded) || undefined}
            onClick={onClose}
          >
            {t.cancel}
          </Button>
          <Button
            type="submit"
            variant={selection.action === "delete" ? "destructive" : "default"}
            disabled={pending || (usernameNeeded && usernameTaken)}
          >
            {pending ? t.saving : title}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
