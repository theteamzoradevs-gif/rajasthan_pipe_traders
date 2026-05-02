import { Suspense } from "react";
import AdminLoginForm from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  const configured = Boolean(process.env.ADMIN_PASSWORD);

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-login-logo" aria-hidden>
            RPT
          </span>
          <div>
            <h1 className="admin-login-title">Admin</h1>
            <p className="admin-login-sub">Rajasthan Pipe Traders — sign in to continue</p>
          </div>
        </div>
        {!configured ? (
          <p className="admin-login-config-hint" role="status">
            Set <code className="admin-login-code">ADMIN_PASSWORD</code> in <code className="admin-login-code">.env.local</code>, then restart the dev server.
          </p>
        ) : null}
        <Suspense
          fallback={
            <p className="admin-login-fallback" aria-live="polite">
              Loading…
            </p>
          }
        >
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
