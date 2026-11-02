import test from "node:test";
import assert from "node:assert/strict";
import { SIGNATURE_CONFIG as CFG } from "./fixture.config.js";
import { buildFullSignature, buildShortSignature, escapeHtml } from "../src/shared/signature.js";
import { normalizeProfile, splitExtension, bodyHasOwnSignature, findSharedMailbox, teamProfile } from "../src/shared/profile.js";

const me = {
  displayName: "Jane Doe", jobTitle: "Managing Director - Australia", mail: "Jane.Doe@example.com",
  mobilePhone: "+61 400 111 222", businessPhones: ["+61 2 9000 0000 EXT 601"],
};
const src = (k) => "cid:" + k + ".png";

test("splitExtension handles common formats", () => {
  assert.deepEqual(splitExtension("+61 2 9000 0000 EXT 601"), { number: "+61 2 9000 0000", ext: "601" });
  assert.deepEqual(splitExtension("+61 2 9000 0000 x601"), { number: "+61 2 9000 0000", ext: "601" });
  assert.deepEqual(splitExtension("+61 2 9000 0000 ext.601"), { number: "+61 2 9000 0000", ext: "601" });
  assert.deepEqual(splitExtension("+61 2 9000 0000"), { number: "+61 2 9000 0000", ext: "" });
  assert.deepEqual(splitExtension(""), { number: "", ext: "" });
  assert.deepEqual(splitExtension("EXT 602"), { number: "", ext: "602" });
  assert.deepEqual(splitExtension("602"), { number: "", ext: "602" });
});

test("normalizeProfile: graph data, ext attribute and fallbacks", () => {
  const p = normalizeProfile(me, CFG, {});
  assert.equal(p.email, "jane.doe@example.com");
  assert.equal(p.phone, "+61 2 9000 0000");
  assert.equal(p.ext, "601");
  assert.equal(p.source, "graph");
  const p2 = normalizeProfile({ displayName: "A B", onPremisesExtensionAttributes: { extensionAttribute1: "x 605" } }, CFG, {});
  assert.equal(p2.phone, CFG.company.mainPhone);
  assert.equal(p2.ext, "605");
  const p3 = normalizeProfile(null, CFG, { displayName: "Fallback User", emailAddress: "f@example.com" });
  assert.equal(p3.source, "fallback");
  assert.equal(p3.displayName, "Fallback User");
});

test("full signature contains all rows, images with explicit size, no <style>/svg", () => {
  const html = buildFullSignature(normalizeProfile(me, CFG, {}), CFG, src);
  for (const s of ["Jane Doe", "+61 400 111 222", "Ext.</span>&nbsp;601", "mailto:jane.doe@example.com", "www.example.com", "Sydney", "cid:logo.png", "cid:badge.png", "background-image:url(cid:markCorner.png)", 'width="150" height="91"', "Kind regards,", ">Mobile<", ">Tel<", ">Email<", ">Web<", ">Address<"]) {
    assert.ok(html.includes(s), "missing " + s);
  }
  assert.ok(!/<style|<svg|class=/i.test(html));
  assert.ok(html.length < 30000, "setSignatureAsync limit is 30,000 chars");
});

test("extension-only office phone uses main number; home street address is ignored", () => {
  const p = normalizeProfile({ displayName: "Leon Liu", businessPhones: ["EXT 602"], streetAddress: "11 Home St", city: "St Ives" }, CFG, {});
  assert.equal(p.phone, CFG.company.mainPhone);
  assert.equal(p.ext, "602");
  const html = buildFullSignature(p, CFG, src);
  assert.ok(!html.includes("Home St"));
  assert.ok(html.includes("Sydney"));
});

test("stale cached profile with a personal address never shows it", () => {
  const p = { ...normalizeProfile(me, CFG, {}), address: "11 Home St, St Ives NSW 2075" };
  for (const html of [buildFullSignature(p, CFG, src), buildShortSignature(p, CFG)]) {
    assert.ok(!html.includes("Home St"));
    assert.ok(html.includes("Sydney"));
  }
});

test("disclaimer is a single line", () => {
  const html = buildFullSignature(normalizeProfile(me, CFG, {}), CFG, src);
  const m = html.match(/This email is subject to our.*?<\/td>/);
  assert.ok(m && !/<br/i.test(m[0]));
});

test("full signature omits empty rows", () => {
  const html = buildFullSignature(normalizeProfile({ displayName: "No Mobile", mail: "n@example.com" }, CFG, {}), CFG, src);
  assert.ok(!html.includes(">Mobile<"));
  assert.ok(html.includes(">Tel<") && html.includes("+61 2 9000 0000")); // falls back to main phone
});

test("short signature: no <img>, faded mark only as CSS background", () => {
  const html = buildShortSignature(normalizeProfile(me, CFG, {}), CFG, src);
  assert.ok(!/<img/i.test(html));
  assert.ok(html.includes("background-image:url(") && html.includes("background-repeat:no-repeat"));
  assert.ok(!/background-image/i.test(buildShortSignature(normalizeProfile(me, CFG, {}), CFG))); // 不传 imageSrc → 纯文字
  for (const s of ["Jane Doe", "Managing Director - Australia", "Mobile</b>&nbsp;+61 400 111 222", "Ext.</span>&nbsp;601", "Example Logistics", "Level 1, 1 Example St, Sydney NSW 2000"]) assert.ok(html.includes(s), "missing " + s);
});

test("short signature carries the same one-line disclaimer, no images", () => {
  const html = buildShortSignature(normalizeProfile(me, CFG, {}), CFG, src);
  assert.ok(html.includes(CFG.company.disclaimerPrefix));
  assert.ok(html.includes(CFG.company.termsUrl) && html.includes(escapeHtml(CFG.company.termsText)));
  assert.ok(!/<br\s*\/?>\s*$/i.test(html));
});

test("the faded mark never takes part in layout (background image, no positioning)", () => {
  const html = buildFullSignature(normalizeProfile(me, CFG, {}), CFG, src);
  assert.ok(!/position\s*:\s*absolute/i.test(html));
  assert.match(html, /background-position:right \d+px bottom -?\d+px/);
});

test("HTML injection is escaped", () => {
  assert.equal(escapeHtml('<b>"x"&'), "&lt;b&gt;&quot;x&quot;&amp;");
  const html = buildShortSignature(normalizeProfile({ displayName: "<script>alert(1)</script>" }, CFG, {}), CFG);
  assert.ok(!html.includes("<script>"));
});

test("thread detection: own signature vs quoted headers", () => {
  const p = normalizeProfile(me, CFG, {});
  const firstReply = "Hi Jane,\n\nFrom: John <john@client.com>\nTo: Jane Doe <jane.doe@example.com>\nSubject: quote\n\nPlease quote.";
  assert.equal(bodyHasOwnSignature(firstReply, p), false);
  const laterReply = firstReply + "\n\nKind regards,\nJane Doe\nMob\t+61 400 111 222\nEmail\tjane.doe@example.com";
  assert.equal(bodyHasOwnSignature(laterReply, p), true);
  const localFormat = "Jane Doe | M 0400 111 222";
  assert.equal(bodyHasOwnSignature(localFormat, p), true);
  const emailOnly = normalizeProfile({ displayName: "X", mail: "x@example.com" }, CFG, {});
  assert.equal(bodyHasOwnSignature("Email x@example.com", emailOnly), true);
  assert.equal(bodyHasOwnSignature("To: x@example.com", emailOnly), false);
});

test("shared mailbox table: every address belongs to exactly one team", () => {
  const seen = new Map();
  for (const box of CFG.sharedMailboxes) {
    assert.ok(box.team && box.phone && box.addresses.length, "incomplete entry " + JSON.stringify(box));
    for (const a of box.addresses) {
      const key = a.toLowerCase();
      assert.ok(!seen.has(key), key + " is listed for both " + seen.get(key) + " and " + box.team);
      seen.set(key, box.team);
    }
  }
});

test("findSharedMailbox matches any listed address, case-insensitively", () => {
  assert.equal(findSharedMailbox("importair@example.com.au", CFG).team, "EXL Import Air");
  assert.equal(findSharedMailbox(" AU.ImportSea@Example.com ", CFG).team, "EXL Import Sea");
  assert.equal(findSharedMailbox("jane.doe@example.com", CFG), null);
  assert.equal(findSharedMailbox("", CFG), null);
});

test("teamProfile keeps the person's name, swaps in team contact details", () => {
  const box = findSharedMailbox("au.accounts@example.com", CFG);
  const t = teamProfile(normalizeProfile(me, CFG, {}), box, CFG);
  assert.deepEqual([t.displayName, t.team, t.email, t.phone, t.ext, t.mobile, t.shared], ["Jane Doe", "EXL Accounts", "accounts@example.com.au", "+61 2 9000 0000", "820", "", true]);
  const withMobile = teamProfile(normalizeProfile(me, CFG, {}), { ...box, showMobile: true }, CFG);
  assert.equal(withMobile.mobile, "+61 400 111 222");
});

test("team signatures: full and short show team name and team mailbox", () => {
  const t = teamProfile(normalizeProfile(me, CFG, {}), findSharedMailbox("exportair@example.com.au", CFG), CFG);
  const full = buildFullSignature(t, CFG, src);
  for (const s of ["Jane Doe", "Managing Director - Australia", "EXL Export Air", "mailto:exportair@example.com.au", "&nbsp;822", "Sydney"]) assert.ok(full.includes(s), "full missing " + s);
  assert.ok(!full.includes(">Mobile<") && full.length < 30000);
  const short = buildShortSignature(t, CFG);
  for (const s of ["Jane Doe", "EXL Export Air", "mailto:exportair@example.com.au", "&nbsp;822"]) assert.ok(short.includes(s), "short missing " + s);
  // 个人签名不受影响：精简版不带邮箱
  assert.ok(!buildShortSignature(normalizeProfile(me, CFG, {}), CFG).includes("mailto:"));
});

test("thread detection: team signature is recognised by the team mailbox only", () => {
  const t = teamProfile(normalizeProfile(me, CFG, {}), { ...findSharedMailbox("accounts@example.com.au", CFG), showMobile: true }, CFG);
  assert.equal(bodyHasOwnSignature("Kind regards,\nSam Lee\nEXL Accounts\nEmail accounts@example.com.au", t), true);
  assert.equal(bodyHasOwnSignature("Kind regards,\nJane Doe\nMobile +61 400 111 222\nEmail jane.doe@example.com", t), false);
});

// 可选区块：职位同一行、公司名、通知栏、标语 + 小徽章、宣传横幅、多段免责声明
const blocksCfg = {
  ...CFG,
  titlePosition: "inline",
  showCompanyInFull: true,
  labels: { mobile: "M", phone: "P", email: "E", web: "W", address: "A" },
  notice: { text: "Closed 25 Dec. Email info@example.com.", until: "2999-12-31", inShort: true },
  tagline: [{ text: "Our slogan.", color: "#002f92" }, { text: "Proud partner.", color: "#9a34ff" }],
  bannerUrl: "https://www.example.com/rates",
  company: { ...CFG.company, name: "EXL Logistics", disclaimer: ["Para one.", "Para two."] },
  images: {
    ...CFG.images,
    taglineBadge: { file: "partner.png", width: 53, height: 14, alt: "Partner" },
    banner: { file: "banner.jpg", width: 600, height: 200, alt: "Rates" },
  },
  colors: { ...CFG.colors, title: "#f1c233", notice: "#f4901d", hairline: "" },
};

test("optional blocks: inline title, company line, notice, tagline, banner, multi-paragraph disclaimer", () => {
  const html = buildFullSignature(normalizeProfile(me, CFG, {}), blocksCfg, src);
  for (const s of [
    '<span style="font-weight:normal;color:#f1c233;">Managing Director - Australia</span>',
    "EXL Logistics",
    'href="mailto:info@example.com"',
    "font-style:italic",
    "cid:taglineBadge.png", 'width="53" height="14"',
    '<a href="https://www.example.com/rates"', "cid:banner.png", "max-width:100%",
    "Para one.<br/>Para two.",
  ]) {
    assert.ok(html.includes(s), "missing " + s);
  }
  assert.ok(!html.includes("This email is subject to our"));
  assert.ok(!html.includes("border-top"), "hairline off");
  const at = (s) => html.indexOf(s);
  assert.ok(at("Closed 25 Dec") < at("Our slogan.") && at("Our slogan.") < at("cid:banner.png") && at("cid:banner.png") < at("Para one."));
});

test("full signature uses no colspan: wide blocks below must not stretch the logo column in Word", () => {
  for (const cfg of [CFG, blocksCfg]) {
    assert.ok(!buildFullSignature(normalizeProfile(me, CFG, {}), cfg, src).includes("colspan"));
  }
});

test("notice disappears after its until date; replies keep it unless inShort=false", () => {
  const p = normalizeProfile(me, CFG, {});
  assert.ok(buildShortSignature(p, blocksCfg).includes("Closed 25 Dec"));
  assert.ok(!buildShortSignature(p, { ...blocksCfg, notice: { ...blocksCfg.notice, inShort: false } }).includes("Closed 25 Dec"));
  const expired = { ...blocksCfg, notice: { ...blocksCfg.notice, until: "2000-01-01" } };
  assert.ok(!buildFullSignature(p, expired, src).includes("Closed 25 Dec"));
  assert.ok(!buildShortSignature(p, expired).includes("Closed 25 Dec"));
});

test("short signature does not repeat the short name when the company name starts with it", () => {
  const p = normalizeProfile(me, CFG, {});
  assert.ok(buildShortSignature(p, CFG).includes(">EXL</b>"));
  assert.ok(!buildShortSignature(p, blocksCfg).includes(">EXL</b>"));
});

test("thread detection uses the configured email label", () => {
  const p = { email: "jane.doe@example.com" };
  assert.equal(bodyHasOwnSignature("E jane.doe@example.com", p, "E"), true);
  assert.equal(bodyHasOwnSignature("E jane.doe@example.com", p), false);
  assert.equal(bodyHasOwnSignature("Email jane.doe@example.com", p, "E"), false);
});

test("shared mailbox with showSender=false: team name and box title replace the sender", () => {
  const box = { ...findSharedMailbox("accounts@example.com.au", CFG), team: "Accounts @", title: "Example Logistics", showSender: false };
  const t = teamProfile(normalizeProfile(me, CFG, {}), box, CFG);
  assert.equal(t.displayName, "Accounts @");
  assert.equal(t.jobTitle, "Example Logistics");
  assert.equal(t.team, "");
  const html = buildFullSignature(t, { ...CFG, titlePosition: "inline" }, src);
  assert.ok(html.includes("Accounts @") && html.includes("Example Logistics") && html.includes("mailto:accounts@example.com.au"));
  assert.ok(!html.includes("Jane Doe") && !html.includes("+61 400 111 222"));
});
