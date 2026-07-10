// Drives the real HTTP flow (no JS): signup form POST -> onboarding form POST
// -> dashboard render. Uses React's progressive-enhancement action fields.
// Usage: node scripts/e2e-onboarding-test.mjs [baseUrl]
const BASE = process.argv[2] ?? "http://localhost:3111";

const jar = new Map();
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  storeCookies(res);
  return res;
}

function unescapeHtml(s) {
  return s
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function hiddenFields(html) {
  const fields = [];
  const re = /<input[^>]*type="hidden"[^>]*>/g;
  for (const tag of html.match(re) ?? []) {
    const name = tag.match(/name="([^"]*)"/)?.[1];
    const value = tag.match(/value="([^"]*)"/)?.[1] ?? "";
    if (name) fields.push([unescapeHtml(name), unescapeHtml(value)]);
  }
  return fields;
}

async function postForm(path, html, visible) {
  const fd = new FormData();
  for (const [k, v] of hiddenFields(html)) fd.append(k, v);
  for (const [k, v] of Object.entries(visible)) fd.append(k, v);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { cookie: cookieHeader() },
    body: fd,
    redirect: "manual",
  });
  storeCookies(res);
  return res;
}

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const stamp = Date.now();
const email = `e2e-${stamp}@test.local`;
const agencyName = `E2E Agency ${stamp}`;

// 1. Signup
const signupPage = await get("/signup");
const signupHtml = await signupPage.text();
check("signup page renders", signupPage.status === 200);

const signupRes = await postForm("/signup", signupHtml, {
  full_name: "Test Owner",
  email,
  password: "test-password-123",
  accept_terms: "on",
});
const signupLoc = signupRes.headers.get("location") ?? "";
check(
  "signup redirects to onboarding",
  signupRes.status === 303 && signupLoc.includes("/onboarding"),
  `status ${signupRes.status} -> ${signupLoc}`
);

// 2. Onboarding
const obPage = await get("/onboarding");
const obHtml = await obPage.text();
check("onboarding page renders when signed in", obPage.status === 200 && obHtml.includes("Set up your agency"));

const obRes = await postForm("/onboarding", obHtml, {
  agency_name: agencyName,
  manual_check_minutes: "45",
  avg_account_premium: "25000",
  csr_hourly_rate: "35",
});
const obLoc = obRes.headers.get("location") ?? "";
check(
  "onboarding redirects to dashboard",
  obRes.status === 303 && obLoc.includes("/dashboard"),
  `status ${obRes.status} -> ${obLoc}`
);

// 3. Dashboard
const dash = await get("/dashboard");
const dashHtml = await dash.text();
check("dashboard renders", dash.status === 200);
check("dashboard shows agency name", dashHtml.includes(agencyName));
check("dashboard shows reviewer name", dashHtml.includes("Test Owner"));
check("dashboard shows first-check empty state", dashHtml.includes("Run your first check"));

// 4. Re-visiting onboarding when already onboarded bounces to dashboard.
const obAgain = await get("/onboarding");
check(
  "onboarding revisit redirects to dashboard",
  obAgain.status >= 300 && obAgain.status < 400 && (obAgain.headers.get("location") ?? "").includes("/dashboard"),
  `status ${obAgain.status}`
);

// 5. Auth pages redirect away when signed in.
const loginWhileAuthed = await get("/login");
check(
  "login redirects to dashboard when signed in",
  loginWhileAuthed.status >= 300 && (loginWhileAuthed.headers.get("location") ?? "").includes("/dashboard")
);

console.log(failures === 0 ? "\nAll E2E onboarding checks passed." : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
