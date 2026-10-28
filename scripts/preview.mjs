// 生成 preview.html：用示例资料渲染完整签名 + 精简签名（图片内嵌为 data URI），用于设计确认
// 可选 preview.config.json（仓库根目录）：language "zh" | "en"、示例人物 person / teamMember、给客户看的 notes / questions
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SIGNATURE_CONFIG as CFG } from "../src/config.js";
import { buildFullSignature, buildShortSignature, escapeHtml } from "../src/shared/signature.js";
import { normalizeProfile, findSharedMailbox, teamProfile } from "../src/shared/profile.js";
import { buildFallbackHtml } from "../src/shared/fallback.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const optFile = path.join(root, "preview.config.json");
const opt = fs.existsSync(optFile) ? JSON.parse(fs.readFileSync(optFile, "utf8")) : {};
// 示例人物默认是虚构的；邮箱域名跟公司网址走
const domain = CFG.company.website.replace(/^www\./, "");
const me = opt.person || {
  displayName: "Jane Doe", jobTitle: "Managing Director", mail: "jane.doe@" + domain,
  mobilePhone: "+61 400 111 222", businessPhones: [CFG.company.mainPhone + " EXT 601"],
};
const p = normalizeProfile(me, CFG, {});
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif" };
const dataUri = (k) => {
  const file = CFG.images[k].file;
  return "data:" + (MIME[path.extname(file).toLowerCase()] || "image/png") + ";base64," + fs.readFileSync(path.join(root, "src/assets", file)).toString("base64");
};
const full = buildFullSignature(p, CFG, dataUri);
const short = buildShortSignature(p, CFG, dataUri);
// 共享邮箱（团队版）：每个共享邮箱一个完整签名示例；精简签名和 Exchange 兜底只用第一个演示；没有配置共享邮箱就都不显示
const boxes = CFG.sharedMailboxes.map((b) => findSharedMailbox(b.addresses[0], CFG));
const box = boxes[0];
const member = normalizeProfile(opt.teamMember || { displayName: "Alex Chen", jobTitle: "Coordinator", mail: "alex.chen@" + domain, mobilePhone: "+61 400 000 000", businessPhones: [CFG.company.mainPhone + " EXT 605"] }, CFG, {});
const team = box && teamProfile(member, box, CFG);
const teamShort = box && buildShortSignature(team, CFG, dataUri);

const sn = CFG.company.shortName;
const T = {
  zh: {
    title: sn + " 签名预览", h1: sn + " 邮件签名 — 设计预览",
    sub: "示例数据：" + me.displayName + "。实际签名中的个人信息从 Entra ID 自动读取。",
    notes: "说明", questions: "请确认",
    t1: "新邮件 / 会话中第一次回复 / 转发 → 完整签名",
    t1all: "所有邮件（新邮件、回复、转发）→ 完整签名",
    t2: "同一会话中后续回复 → 精简签名（无图片）",
    t3: "暗色模式（模拟 Outlook 深色主题：文字颜色被反转，图片不变）",
    t4: (a) => "用共享邮箱发信（发件人 = " + a + "）→ 团队版完整签名：团队电话和邮箱，不显示个人手机",
    t5: "共享邮箱：会话里已有团队签名后的回复 → 团队版精简签名",
    t6: "加载项没运行（手机、单独打开的共享邮箱）→ Exchange 在整封邮件末尾追加团队信息（回复时在引用内容之后）",
    quotedHist: "…引用的历史邮件…",
  },
  en: {
    title: sn + " Email Signature Preview", h1: sn + " email signature — design preview",
    sub: "Sample: " + me.displayName + ". In the live signature, each person's name, job title and phone numbers are filled in automatically from Microsoft 365.",
    notes: "How it works", questions: "Please confirm",
    t1: "New email, or first reply / forward in a conversation → full signature",
    t1all: "Every email (new, reply or forward) → full signature",
    t2: "Later replies in the same conversation → compact signature (no images)",
    t3: "Outlook dark mode (simulated: text colours are adjusted, images stay as they are)",
    t4: (a) => "Sending from the shared mailbox " + a + " → team signature with the team's phone and email, no personal mobile",
    t5: "Shared mailbox, later reply in the same conversation → compact team signature",
    t6: "Add-in not running (e.g. phone mail app, shared mailbox opened on its own) → team details are added at the end of the email by Exchange",
    quotedHist: "…earlier messages in the conversation…",
  },
}[opt.language === "en" ? "en" : "zh"];

// 暗色模式近似 Outlook：只把深色文字的亮度反过来（深蓝 → 浅蓝），浅色 / 鲜艳的文字和图片保持不变
function darkify(html) {
  return html.replace(/color:#([0-9a-f]{6})/gi, (m, hex) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (l >= 0.45) return m;
    const d = max - min, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const L = 1 - l, C = (1 - Math.abs(2 * L - 1)) * s, X = C * (1 - Math.abs((h % 2) - 1)), o = L - C / 2;
    const rgb = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][Math.floor(h) % 6];
    return "color:#" + rgb.map((v) => Math.round((v + o) * 255).toString(16).padStart(2, "0")).join("");
  });
}

const quoted = (inner) =>
  '<div style="border-top:1px solid #e1e1e1;margin-top:18px;padding-top:10px;font:12px Arial;color:#555;"><b>From:</b> John Smith &lt;john@client.com&gt;<br/><b>Sent:</b> Friday, 18 September 2026 3:12 PM<br/><b>Subject:</b> RE: Enquiry</div>' + (inner || "");
const list = (title, items, tag) =>
  items && items.length ? '<div class="list"><h2>' + title + "</h2><" + tag + ">" + items.map((i) => "<li>" + escapeHtml(i) + "</li>").join("") + "</" + tag + "></div>" : "";

// useShortSignature=false 时不展示精简签名的两种情况，编号自动连续
const useShort = CFG.useShortSignature !== false;
const sections = [
  { tag: useShort ? T.t1 : T.t1all, body: "Please find the requested documents attached.", html: full },
  useShort && { tag: T.t2, body: "Thanks — we'll proceed as discussed.", html: short + quoted() },
  { tag: T.t3, body: "Please find the requested documents attached.", html: darkify(full), dark: true },
  ...boxes.map((b) => ({ tag: T.t4(b.addresses[0]), body: "Your enquiry has been received and is being reviewed.", html: buildFullSignature(teamProfile(member, b, CFG), CFG, dataUri) })),
  box && useShort && { tag: T.t5, body: "Thanks, noted.", html: teamShort + quoted() },
  box && { tag: T.t6, body: "Received, thanks.", html: quoted('<p class="body" style="margin-top:10px;color:#555">' + T.quotedHist + "</p>") + buildFallbackHtml(box, CFG) },
].filter(Boolean);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(T.title)}</title>
<style>body{margin:0;background:#eef0f3;font:14px "Segoe UI",Arial;color:#222;-webkit-print-color-adjust:exact;print-color-adjust:exact}.wrap{max-width:900px;margin:0 auto;padding:24px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 8px}.sub{color:#666;margin:0 0 12px}ul,ol{margin:0 0 8px;padding-left:22px;line-height:1.6}
.mail{background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.08);padding:22px 26px;margin-bottom:22px;break-inside:avoid}
.tag{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:10px;margin-bottom:12px;background:#e8f1fd;color:#0b5cad}.body{font:14px Arial;margin:0 0 16px}
.dark{background:#262626}.dark .body{color:#e3e3e3}.dark .tag{background:#3a3a3a;color:#ddd}.list{break-inside:avoid}
@page{size:A4;margin:10mm}@media print{html{zoom:.72}body{background:#fff}.wrap{padding:0;max-width:none}.mail{box-shadow:none;border:1px solid #e1e1e1;margin-bottom:14px}}</style></head><body><div class="wrap">
<h1>${escapeHtml(T.h1)}</h1><p class="sub">${escapeHtml(T.sub)}</p>
${list(T.notes, opt.notes, "ul")}
${sections.map((x, i) => '<div class="mail' + (x.dark ? " dark" : "") + '"><span class="tag">' + "①②③④⑤⑥⑦⑧⑨"[i] + " " + escapeHtml(x.tag) + '</span><p class="body">Hi John,<br/><br/>' + x.body + "</p>" + x.html + "</div>").join("\n")}
${list(T.questions, opt.questions, "ol")}
</div></body></html>`;
fs.writeFileSync(path.join(root, "preview.html"), html);
console.log("✅ preview.html 已生成");
