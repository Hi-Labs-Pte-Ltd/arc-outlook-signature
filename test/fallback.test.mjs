import test from "node:test";
import assert from "node:assert/strict";
import { SIGNATURE_CONFIG as CFG } from "./fixture.config.js";
import { buildFullSignature, buildShortSignature } from "../src/shared/signature.js";
import { normalizeProfile, teamProfile } from "../src/shared/profile.js";
import { buildFallbackHtml, markerLine, markerPattern, mobileSignatureText, renderMobilePage, renderRulesScript } from "../src/shared/fallback.js";

// 近似 Exchange 匹配正文时看到的纯文本：去掉标签、解码常见实体、合并空白
const text = (html) =>
  String(html).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const exchangeMatches = (pattern, html) => new RegExp(pattern, "i").test(text(html));

const me = { displayName: "Jane Doe", jobTitle: "Managing Director", mail: "jane.doe@example.com", mobilePhone: "+61 400 111 222", businessPhones: ["+61 2 9000 0000 EXT 601"] };

for (const box of CFG.sharedMailboxes) {
  test("fallback for " + box.team + ": block, mobile text and rule pattern agree", () => {
    const pattern = markerPattern(box, CFG);
    const html = buildFallbackHtml(box, CFG);
    assert.ok(html.length < 5000, "Exchange disclaimer limit is 5000 characters");
    assert.ok(!/<img|<style|class=/i.test(html));
    for (const s of [box.team, box.addresses[0], "Ext. " + box.ext, CFG.company.website]) assert.ok(text(html).includes(s), "block missing " + s);
    // 兜底内容和手机签名都会被规则识别为“已有签名”，同一封邮件 / 同一个 chain 里不会再追加
    assert.ok(exchangeMatches(pattern, html), "rule must recognise its own block");
    assert.ok(exchangeMatches(pattern, mobileSignatureText(box, CFG).replace(/\n/g, "<br>")), "rule must recognise the mobile signature");
    assert.ok(mobileSignatureText(box, CFG).split("\n").includes(markerLine(box, CFG)));
  });

  test("fallback for " + box.team + ": the add-in's own signatures and quoted headers don't trip the rule", () => {
    const pattern = markerPattern(box, CFG);
    const team = teamProfile(normalizeProfile(me, CFG, {}), box, CFG);
    const src = (k) => "cid:" + k + ".png";
    assert.ok(!exchangeMatches(pattern, buildFullSignature(team, CFG, src)));
    assert.ok(!exchangeMatches(pattern, buildShortSignature(team, CFG, src)));
    // 回复 / 转发里引用的邮件头
    assert.ok(!exchangeMatches(pattern, "From: John &lt;john@client.com&gt;<br>To: AU.Accounts &lt;" + box.addresses[0] + "&gt;<br>Subject: invoice"));
  });
}

test("rules script: one idempotent rule per shared mailbox with both exceptions, ASCII only", () => {
  const ps = renderRulesScript(CFG);
  assert.ok(/^[\x00-\x7f]*$/.test(ps), "Windows PowerShell 5.1 reads scripts without BOM as ANSI");
  assert.equal((ps.match(/^ {4}Name {4}= "EXL signature fallback - /gm) || []).length, CFG.sharedMailboxes.length);
  for (const box of CFG.sharedMailboxes) {
    assert.ok(ps.includes('From    = "' + box.addresses[0] + '"'));
    assert.ok(ps.includes("Pattern = '" + markerPattern(box, CFG) + "'"));
  }
  for (const s of ['ApplyHtmlDisclaimerLocation          = "Append"', 'ApplyHtmlDisclaimerFallbackAction    = "Ignore"',
    'ExceptIfHeaderContainsMessageHeader  = "X-Email-Signature"', 'ExceptIfHeaderContainsWords          = "inserted"',
    "Set-TransportRule -Identity $r.Name @params", "New-TransportRule -Name $r.Name @params"]) {
    assert.ok(ps.includes(s), "missing " + s);
  }
  // here-string 的结束符必须顶格，否则 PowerShell 解析失败
  assert.equal((ps.match(/^'@$/gm) || []).length, CFG.sharedMailboxes.length);
  // 单引号字符串里不能出现单引号
  for (const box of CFG.sharedMailboxes) assert.ok(!markerPattern(box, CFG).includes("'"));
});

test("mobile page lists every team with a copyable signature", () => {
  const page = renderMobilePage(CFG);
  for (const box of CFG.sharedMailboxes) {
    assert.ok(page.includes(box.addresses[0]));
    assert.ok(page.includes(markerLine(box, CFG).replace("&", "&amp;")));
  }
  assert.ok(page.includes("[Your name]"));
});

test("fallback uses the configured phone label, skips an empty address and uses the multi-paragraph disclaimer", () => {
  const cfg = {
    ...CFG,
    labels: { ...CFG.labels, phone: "P" },
    company: { ...CFG.company, address: "", disclaimer: ["Para one.", "Para two."] },
    colors: { ...CFG.colors, hairline: "" },
  };
  const box = cfg.sharedMailboxes[0];
  const html = buildFallbackHtml(box, cfg);
  assert.ok(text(html).includes("P " + box.phone));
  assert.ok(html.includes("Para one.<br/>Para two."));
  assert.ok(!html.includes("<br><br>") && !html.includes("solid ;"));
  assert.ok(mobileSignatureText(box, cfg).includes("P " + box.phone));
});
