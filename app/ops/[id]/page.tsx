import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/app/components/AppShell";
import { agencyCap } from "@/lib/pricing";
import { AdminLogoForm } from "../AdminLogoForm";
import { AgencySettingsForm } from "./AgencySettingsForm";
import { GuidanceForm } from "./GuidanceForm";
import { redirect } from "next/navigation";
import { deleteClientAgency } from "@/app/actions/admin";

/** One client, everything about them: settings, branding, prompts, people. */
export default async function OpsAgencyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, agency: myAgency } = await requireProfile();
  if (!isSystemAdmin(profile)) notFound();
  const admin = createAdminClient();
  if (!admin) notFound();

  const { data: agency } = await admin.from("agencies").select("*").eq("id", id).maybeSingle();
  if (!agency) notFound();

  const { data: members } = await admin
    .from("profiles")
    .select("id, user_id, full_name, role, suspended_at")
    .eq("agency_id", id)
    .order("created_at", { ascending: true });
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailOf = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  return (
    <AppShell agency={myAgency} profile={profile} active="/admin">
      <div className="mb-1 text-sm">
        <Link href="/ops" className="text-ink/60 underline hover:text-ink">
          ← Ops console
        </Link>
      </div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{agency.name}</h1>
          <p className="text-sm text-ink/60">
            {agency.checks_this_period} / {agencyCap(agency)} checks this period ·{" "}
            <span className="font-mono text-xs uppercase">{agency.plan}</span> ·{" "}
            <span className="font-mono text-xs">{agency.billing_status}</span>
          </p>
        </div>
        <a href={`/api/admin/audit/${agency.id}`} className="text-sm underline">
          Audit log (CSV)
        </a>
      </div>

      <div className="grid max-w-3xl gap-6">
        <section className="rounded-lg border border-line bg-card p-6">
          <h2 className="mb-4 font-semibold">Settings</h2>
          <AgencySettingsForm agency={agency} />
        </section>

        <section className="rounded-lg border border-line bg-card p-6">
          <h2 className="mb-4 font-semibold">Logo (co-branding)</h2>
          <AdminLogoForm agencyId={agency.id} agencyName={agency.name} logoUrl={agency.logo_url} />
        </section>

        <section className="rounded-lg border border-line bg-card p-6">
          <h2 className="mb-4 font-semibold">Correction letter guidance (this client only)</h2>
          <GuidanceForm agencyId={agency.id} value={agency.letter_instructions ?? ""} />
        </section>

        <section className="rounded-lg border border-line bg-card p-6">
          <h2 className="mb-4 font-semibold">People</h2>
          <ul className="divide-y divide-line/60">
            {(members ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{m.full_name}</span>
                  {m.suspended_at && (
                    <span className="ml-2 inline-flex items-center rounded border border-caution px-2 py-0.5 font-mono text-xs uppercase leading-none text-caution">
                      suspended
                    </span>
                  )}
                  <span className="block font-mono text-xs text-ink/60">{emailOf.get(m.user_id)}</span>
                </span>
                <span className="font-mono text-xs uppercase text-ink/60">{m.role.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-flag/40 bg-card p-6">
          <h2 className="mb-4 font-semibold text-flag">Danger zone</h2>
          <form
            action={async (formData: FormData) => {
              "use server";
              await deleteClientAgency(agency.id, formData);
              redirect("/ops");
            }}
            className="space-y-3"
          >
            <p className="text-sm text-ink/80">
              Deletes this client entirely: agency, every member login, every
              check and finding. Cannot be undone. Type{" "}
              <span className="font-mono font-semibold">{agency.name}</span> to
              confirm.
            </p>
            <input
              name="confirm_name"
              placeholder="Type the agency name"
              autoComplete="off"
              className="w-full max-w-sm rounded border border-line bg-paper px-3 py-2 text-sm"
            />
            <button className="rounded border border-flag px-4 py-2 text-sm font-semibold text-flag hover:bg-flag hover:text-white">
              Delete this client
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
