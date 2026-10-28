import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
// configFile：用哪份测试配置打包（默认 fixture.config.js）
const bundleWith = async (configFile) => (await build({
  entryPoints: [path.join(root, "src/launchevent/launchevent.js")], bundle: true, write: false, format: "iife", target: "es2017",
  plugins: [{ name: "mock", setup(b) {
    b.onResolve({ filter: /shared\/graph\.js$|\.\/graph\.js$/ }, () => ({ path: path.join(root, "test/mock-graph.js") }));
    b.onResolve({ filter: /\/config\.js$/ }, () => ({ path: path.join(root, configFile) }));
    b.onResolve({ filter: /generated\/images\.js$/ }, () => ({ path: path.join(root, "test/fixture.images.js") }));
  } }],
})).outputFiles[0].text;
const bundle = await bundleWith("test/fixture.config.js");

const JANE = { displayName: "Jane Doe", mail: "jane.doe@example.com", userPrincipalName: "jane.doe@example.com", mobilePhone: "+61 400 111 222", businessPhones: ["+61 2 9000 0000 EXT 601"] };
const text = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");

/**
 * 模拟一封正在撰写的邮件。fire(name) 触发 manifest 里登记的事件；
 * 正文 = 引用的历史邮件 + 加载项当前插入的签名（和真实 Outlook 一样，签名插入后会出现在正文里）。
 */
function compose({ composeType, sent = false, tokenFail = false, body = "", from, mailbox, settings = {}, code = bundle }) {
  const calls = { attachments: [], signature: null, disabled: false, notices: 0, headers: {} };
  const session = {};
  const handlers = {};
  const state = { from: from || "jane.doe@example.com" };
  const ok = (value) => ({ status: "succeeded", value });
  const item = {
    conversationId: composeType === "newMail" ? null : "AAQkConv+/=",
    getComposeTypeAsync: (cb) => cb(ok({ composeType })),
    from: { getAsync: (cb) => cb(ok({ displayName: "", emailAddress: state.from })) },
    body: {
      getAsync: (t, cb) => cb(ok(body + "\n" + text(calls.signature))),
      setSignatureAsync: (html, o, cb) => { calls.signature = html; cb(ok()); },
    },
    sessionData: {
      getAsync: (k, cb) => cb(k in session ? ok(session[k]) : { status: "failed", error: new Error("not found") }),
      setAsync: (k, v, cb) => { session[k] = v; cb(ok()); },
    },
    getAttachmentsAsync: (cb) => cb(ok(calls.attachments.map((name) => ({ name, isInline: true })))),
    disableClientSignatureAsync: (cb) => { calls.disabled = true; cb(ok()); },
    addFileAttachmentFromBase64Async: (b64, name, o, cb) => { calls.attachments.push(name); cb(ok("id")); },
    internetHeaders: { setAsync: (h, cb) => { Object.assign(calls.headers, h); cb(ok()); } },
    notificationMessages: { addAsync: () => { calls.notices++; } },
  };
  const Office = {
    onReady: () => {}, AsyncResultStatus: { Failed: "failed", Succeeded: "succeeded" }, CoercionType: { Html: "html", Text: "text" },
    MailboxEnums: { ItemNotificationMessageType: { InsightMessage: "insightMessage" }, ActionType: { ShowTaskPane: "showTaskPane" } },
    actions: { associate: (n, f) => { handlers[n] = f; } },
    context: {
      requirements: { isSetSupported: () => true },
      roamingSettings: { get: (k) => settings[k], set: (k, v) => { settings[k] = v; }, saveAsync: (cb) => cb && cb(ok()) },
      mailbox: { item, userProfile: mailbox || { displayName: "Jane Doe", emailAddress: "jane.doe@example.com" } },
    },
  };
  const ctx = vm.createContext({ Office, console: { log() {} }, setTimeout, clearTimeout,
    __MOCK: { sent, tokenFail, me: JANE, user: JANE.userPrincipalName } });
  vm.runInContext(code, ctx);
  return {
    calls, mock: ctx.__MOCK, settings,
    setFrom: (address) => { state.from = address; },
    fire: (name) => new Promise((resolve) => handlers[name]({ completed: resolve })),
  };
}

async function run(options) {
  const c = compose(options);
  await c.fire("onNewMessageComposeHandler");
  return c;
}

test("new message → full signature with embedded images", async () => {
  const { calls } = await run({ composeType: "newMail" });
  assert.ok(calls.disabled);
  assert.match(calls.signature, /data-sig="full"/);
  assert.deepEqual(calls.attachments, ["logo.png", "badge.png"]);
  assert.match(calls.signature, /cid:logo\.png/);
});

test("first reply (never sent in conversation) → full", async () => {
  const { calls, mock } = await run({ composeType: "reply", sent: false });
  assert.match(calls.signature, /data-sig="full"/);
  assert.equal(mock.checkedConv, "AAQkConv+/=");
});

test("later reply (already sent) → short, only the faded mark is embedded", async () => {
  const { calls } = await run({ composeType: "reply", sent: true });
  assert.match(calls.signature, /data-sig="short"/);
  assert.equal(calls.attachments.length, 0); // 圆环是 CSS 背景图，不占附件
});

test("forward → full (forwardAlwaysFull)", async () => {
  const { calls } = await run({ composeType: "forward", sent: true });
  assert.match(calls.signature, /data-sig="full"/);
});

test("useShortSignature=false → later replies still get the full signature", async () => {
  const code = await bundleWith("test/fixture.full-only.js");
  const { calls } = await run({ composeType: "reply", sent: true, code });
  assert.match(calls.signature, /data-sig="full"/);
});

test("no token → body fingerprint fallback + sign-in notice", async () => {
  const { calls } = await run({ composeType: "reply", tokenFail: true, body: "Kind regards,\nJane Doe\nEmail jane.doe@example.com" });
  assert.match(calls.signature, /data-sig="short"/);
  assert.equal(calls.notices, 1);
});

test("shared mailbox: new message → team signature (team phone/email, no personal mobile)", async () => {
  const { calls } = await run({ composeType: "newMail", from: "AU.Importair@example.com" });
  assert.match(calls.signature, /data-sig="full"/);
  for (const s of ["Jane Doe", "EXL Import Air", "mailto:importair@example.com.au", "Ext.</span>&nbsp;821"]) assert.ok(calls.signature.includes(s), "missing " + s);
  for (const s of ["+61 400 111 222", "jane.doe@example.com", "&nbsp;601"]) assert.ok(!calls.signature.includes(s), "should not contain " + s);
});

test("switching From to a shared mailbox replaces the signature without re-embedding images", async () => {
  const c = await run({ composeType: "newMail" });
  assert.ok(c.calls.signature.includes("+61 400 111 222"));
  c.setFrom("accounts@example.com.au");
  await c.fire("onMessageFromChangedHandler");
  assert.ok(c.calls.signature.includes("EXL Accounts") && !c.calls.signature.includes("+61 400 111 222"));
  assert.deepEqual(c.calls.attachments, ["logo.png", "badge.png"]);
  c.setFrom("jane.doe@example.com");
  await c.fire("onMessageFromChangedHandler");
  assert.ok(c.calls.signature.includes("+61 400 111 222") && !c.calls.signature.includes("EXL Accounts"));
});

test("shared mailbox reply: full until the team's signature is in the thread, whoever sent it", async () => {
  const first = await run({ composeType: "reply", sent: true, from: "au.exportsea@example.com" });
  assert.match(first.calls.signature, /data-sig="full"/);
  assert.equal(first.mock.checkedConv, undefined); // 不查本人的已发送邮件
  const later = await run({ composeType: "reply", from: "au.exportsea@example.com", body: "Kind regards,\nKim Park\nEXL Export Sea\nEmail exportsea@example.com.au" });
  assert.match(later.calls.signature, /data-sig="short"/);
  for (const s of ["Jane Doe", "EXL Export Sea", "mailto:exportsea@example.com.au"]) assert.ok(later.calls.signature.includes(s), "missing " + s);
});

test("re-selecting the same From on a first reply keeps the full signature", async () => {
  const c = await run({ composeType: "reply", sent: false });
  assert.match(c.calls.signature, /data-sig="full"/);
  await c.fire("onMessageFromChangedHandler");
  assert.match(c.calls.signature, /data-sig="full"/);
  assert.equal(c.calls.attachments.length, 2);
});

test("shared mailbox opened on its own and no sign-in → team name instead of a person", async () => {
  const { calls } = await run({ composeType: "newMail", tokenFail: true, from: "au.accounts@example.com", mailbox: { displayName: "AU.Accounts", emailAddress: "au.accounts@example.com" } });
  assert.ok(calls.signature.includes(">EXL Accounts</div>"));
  assert.ok(!calls.signature.includes("AU.Accounts"));
});

test("a colleague's cached profile (shared mailbox settings) is not used for the signed-in user", async () => {
  const other = { displayName: "Someone Else", email: "someone.else@example.com", upn: "someone.else@example.com", mobile: "", phone: "+61 2 9000 0000", ext: "", source: "graph" };
  const settings = { sigProfile: JSON.stringify({ v: 3, savedAt: Date.now(), profile: other }) };
  const { calls } = await run({ composeType: "newMail", settings });
  assert.ok(calls.signature.includes("Jane Doe") && !calls.signature.includes("Someone Else"));
});

test("the signature container id records build, decision and the From the add-in saw", async () => {
  const team = await run({ composeType: "newMail", from: "AU.Accounts@example.com" });
  assert.match(team.calls.signature, /<div id="email-signature-[a-z0-9]+-team-from-au-accounts-example-com" data-sig="full">/);
  const personal = await run({ composeType: "reply", sent: true });
  assert.match(personal.calls.signature, /<div id="email-signature-[a-z0-9]+-personal-from-jane-doe-example-com" data-sig="short">/);
});

test("every inserted signature is flagged in a message header for the Exchange fallback rule", async () => {
  const team = await run({ composeType: "newMail", from: "importair@example.com.au" });
  assert.equal(team.calls.headers["X-Email-Signature"], "inserted team full");
  const personal = await run({ composeType: "reply", sent: true });
  assert.equal(personal.calls.headers["X-Email-Signature"], "inserted personal short");
  // 切换发件人后标记跟着更新
  const c = await run({ composeType: "newMail" });
  c.setFrom("au.exportsea@example.com");
  await c.fire("onMessageFromChangedHandler");
  assert.equal(c.calls.headers["X-Email-Signature"], "inserted team full");
});
