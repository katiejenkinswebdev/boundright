// Phase 5 acceptance: a brand-new user can sign up, run the sample check
// from the empty dashboard, and end up with a ready report — over real HTTP.
// Server must run with CLAUDE_STUB_DIR=eval/stubs (or a real API key).
const BASE = process.argv[2] ?? "http://localhost:3114";

const jar = new Map();
const storeCookies = (res) => {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
};
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie: cookieHeader() }, redirect: "manual" });
  storeCookies(res);
  return res;
};
const unescapeHtml = (s) =>
  s.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const formScopes = (html) =>
  html.split("<form").slice(1).map((f) => f.slice(0, f.indexOf("</form>")));
const hiddenFields = (html, formIndex = 0) => {
  const scope = formScopes(html)[formIndex] ?? "";
  const fields = [];
  for (const tag of scope.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = tag.match(/name="([^"]*)"/)?.[1];
    const value = tag.match(/value="([^"]*)"/)?.[1] ?? "";
    if (name) fields.push([unescapeHtml(name), unescapeHtml(value)]);
  }
  return fields;
};
const postForm = async (path, html, visible, formIndex = 0) => {
  const fd = new FormData();
  for (const [k, v] of hiddenFields(html, formIndex)) fd.append(k, v);
  for (const [k, v] of Object.entries(visible)) fd.append(k, v);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { cookie: cookieHeader() },
    body: fd,
    redirect: "manual",
  });
  storeCookies(res);
  return res;
};

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const stamp = Date.now();

// Sign up + onboard
const signupHtml = await (await get("/signup")).text();
await postForm("/signup", signupHtml, {
  full_name: "Sample User",
  email: `sample-${stamp}@test.local`,
  password: "test-password-123",
  accept_terms: "on",
});
const obHtml = await (await get("/onboarding")).text();
await postForm("/onboarding", obHtml, {
  agency_name: `Sample Agency ${stamp}`,
  manual_check_minutes: "45",
  avg_account_premium: "25000",
  csr_hourly_rate: "35",
});

// Empty dashboard shows the sample CTA
const dashHtml = await (await get("/dashboard")).text();
check("empty dashboard offers sample check", dashHtml.includes("Run a sample check"));

// The sample-check form is the first form after the sign-out form; find the
// form whose button says "Run a sample check".
const formIndex = formScopes(dashHtml).findIndex((f) => f.includes("Run a sample check"));
check("sample form found", formIndex >= 0);

const sampleRes = await postForm("/dashboard", dashHtml, {}, formIndex);
const loc = sampleRes.headers.get("location") ?? "";
check("sample check redirects to progress screen", sampleRes.status === 303 && loc.includes("/checks/"), `status ${sampleRes.status} -> ${loc}`);

// Poll until the report is ready
const checkPath = loc;
let status = "";
for (let i = 0; i < 40; i++) {
  const apiRes = await get(`/api${checkPath}`);
  if (apiRes.status === 200) {
    status = (await apiRes.json()).status;
    if (["ready_for_review", "failed"].includes(status)) break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}
check("sample check completes", status === "ready_for_review", status);

const reportHtml = await (await get(checkPath)).text();
check("report shows seeded critical", reportHtml.includes("General Aggregate Limit"));
check("report shows confirm/dismiss", reportHtml.includes("Confirm") && reportHtml.includes("Dismiss"));
// Next SSR inserts <!-- --> between dynamic text nodes — strip before matching.
const dashAfter = (await (await get("/dashboard")).text()).replaceAll("<!-- -->", "");
check(
  "sample did not consume quota",
  dashAfter.includes("10 of 10 checks remaining"),
  dashAfter.match(/\d+ of \d+ checks remaining/)?.[0] ?? "banner not found"
);

console.log(failures === 0 ? "\nSample-check E2E passed." : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
