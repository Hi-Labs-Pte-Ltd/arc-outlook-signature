/**
 * ARC Capital Group 签名配置—— 公司统一信息都在这里改，改完重新 build + 推送即可全员生效。
 * 个人信息（姓名、手机、电话、分机、职位）从 Entra ID 自动读取，不在这里写。
 */
export const SIGNATURE_CONFIG = {
  company: {
    name: "Arc Capital Group",
    shortName: "ARC",
    website: "www.arccapitalgroup.com.au",
    websiteUrl: "https://www.arccapitalgroup.com.au",
    // Entra 里没有填办公电话时使用的总机号码
    mainPhone: "1300 272 168",
    address: "",
    // 点击地址时打开的地图链接（留空则地址不加链接）
    addressUrl: "",
    // 保密声明 & 条款链接 —— 请替换为你们真实的地址
    termsUrl: "",
    termsText: "",
    // 免责声明（一行）：disclaimerPrefix + 链接文字(termsText)
    disclaimerPrefix: "",
    // 多段纯文本免责声明（不带链接）；填了就替代上面 “前缀 + 条款链接” 那一行
    disclaimer: [
      "The content of this email is confidential and intended for the recipient specified in the message only. It is strictly forbidden to share any part of this message with any third party, without the written consent of the sender.",
      "If you received this message by mistake, please reply to this message and follow with its deletion to ensure such a mistake does not occur in the future.",
    ],
  },

  // 签名上方的结束语；设为 "" 则不插入
  signOff: "Regards,",
  // 精简签名是否也带结束语
  signOffInShort: true,

  // 完整签名是否在姓名下方显示职位
  showTitleInFull: true,
  // 精简签名是否显示职位
  showTitleInShort: true,
  // 精简签名是否在公司名称后显示公司地址
  showAddressInShort: false,
  // 职位位置："below" 姓名下一行；"inline" 和姓名同一行（“Name | Title”，颜色用 colors.title）
  titlePosition: "inline",
  // 完整签名在姓名下方显示公司名称（company.name）
  showCompanyInFull: true,

  /**
   * 通知栏（如节假日停业），显示在联系方式下方，斜体，颜色 colors.notice；text 留空则不显示。
   *  - until  ：最后显示的日期（YYYY-MM-DD，含当天），过了自动消失，不用重新发布；留空则一直显示
   *  - inShort：精简签名（回复）里也显示
   * 文字里的邮箱地址会自动变成链接。
   */
  notice: {
    text: "Please note we will be closed from 25 December 2026 to 12 January 2027 (inclusive). For urgent enquiries during this period, please call 1300 272 168 or email info@arccapitalgroup.com.au.",
    until: "2027-01-12",
    inShort: true,
  },

  // 标语：几段文字，每段可以单独设颜色，如 [{ text: "Our slogan.", color: "#1F4E79" }]；images.taglineBadge 跟在最后
  tagline: [
    { text: "Empower Australian SMEs to secure their future.", color: "#002f92" },
    { text: "Proud to partner with WAGEC.", color: "#9a34ff" },
  ],
  // 宣传横幅（images.banner）点击后打开的链接；留空则不加链接
  bannerUrl: "https://www.arccapitalgroup.com.au",
  // 联系方式标签那一列的宽度（px）；标签是单个字母（M / P / E / W）时可以改小
  labelWidth: 14,

  /**
   * 共享邮箱（团队邮箱）：发件人 (From) 是下面某个地址时，自动改用团队版签名 ——
   * 发件人姓名 + 团队名 + 团队电话 / 分机 + 团队邮箱，默认不显示个人手机。
   *  - addresses ：这个邮箱的全部地址（不区分大小写）。第一个显示在签名里，其余只用来识别发件人；
   *                Exchange 里的主地址和别名都要写上，否则用另一个地址发信时识别不到
   *  - team      ：签名里显示的团队名
   *  - phone/ext ：团队电话和分机
   *  - showMobile：设为 true 时，这个团队的签名也显示发件人本人的手机
   *  - showSender：设为 false 时，签名不显示发件人姓名，姓名位置显示团队名，职位位置显示 title
   * 不在这张表里的共享邮箱，签名仍然是发件人本人的。新增 / 修改团队：改这里 → 提交即可，不需要重新上传 manifest。
   */
  sharedMailboxes: [
    // 和员工签名同一个模板：姓名位置是 “Info @”，职位位置是公司名，不显示是谁发的
    { addresses: ["info@arccapitalgroup.com.au"], team: "Info @", title: "Arc Capital Group", phone: "1300 272 168", showSender: false },
    // 地址按 info@ 的格式推断，等 ARC 确认
    { addresses: ["approved@arccapitalgroup.com.au"], team: "Approved @", title: "Arc Capital Group", phone: "1300 272 168", showSender: false },
  ],

  // 分机号来源：先从 Entra "办公电话" 里解析（如 "+61 2 0000 0000 EXT 601" / "x601"），
  // 解析不到再读这个扩展属性（Exchange 自定义属性 1 = extensionAttribute1）
  extensionAttribute: "extensionAttribute1",

  /**
   * 图片模式：
   *  - "embed"：图片以内嵌附件（CID）方式插入，任何客户端都能直接显示，不会被“阻止下载图片”拦截（推荐）
   *  - "link" ：图片引用 baseUrl/assets/ 上的外链，邮件更小，但收件人 Outlook 可能默认不显示图片
   */
  imageMode: "embed",

  // 联系方式标签。注意：邮箱那一行（labels.email + 地址）也用于识别引用邮件里是否已有本人签名（profile.js bodyHasOwnSignature）
  labels: { mobile: "M", phone: "P", email: "E", web: "W", address: "A" },

  images: {
    // 文件放在 src/assets/ 下；width/height 是显示尺寸（源图为 2 倍分辨率，透明背景 + 白色描边以适配暗色模式）
    // Logo 高度与右侧姓名 + 联系方式信息块一致
    logo: { file: "arc-logo.png", width: 126, height: 69, alt: "Arc Capital Group" },
    // 底部徽章（如行业协会认证）
    badge: null,
    // 品牌标志：完整版（footer / name 位置用）和淡化的 1/4 版（overlay / corner 位置用）
    mark: null,
    markCorner: null,
    // 标语后面的小徽章（如合作伙伴标志）
    taglineBadge: { file: "wagec-badge.png", width: 52, height: 13, alt: "Walk for WAGEC" },
    // 宣传横幅（完整签名，免责声明上方）。width/height 是显示尺寸；建议用 JPG 压到 100KB 以内，每封新邮件都会带上
    banner: { file: "arc-banner.jpg", width: 600, height: 200, alt: "Arc Capital Group - Business Smart 8.99% p.a., Business Bridge 9.24% p.a." },
    // 不需要底部徽章 / 标志 / 横幅就设为 null
  },

  /**
   * 品牌圆环标志的位置（完整签名）：
   *  - "overlay"：淡化的 1/4 圆环压在地址那行文字后面（推荐）。
   *               新版 Outlook / 网页版 Outlook / Gmail / Apple Mail 正常显示；
   *               经典 Outlook（Word 引擎）不支持定位，会自动隐藏圆环，其余部分不受影响。
   *  - "corner" ：同样的圆环，但放在联系方式右侧单独一格、不与文字重叠（所有客户端都显示）
   *  - "footer" ：底部分隔线右端的完整圆环
   *  - "name"   ：姓名这一行最右侧的完整圆环
   *  - "none"   ：不显示
   * 精简签名不放图片（每封回复都会多一个内嵌附件），所以圆环只出现在完整签名里。
   */
  markPosition: "none",
  // overlay 位置微调：距联系方式区域右边 / 下边多少像素（right:0 = 圆环右边缘与地址末尾对齐）
  markOverlayOffset: { right: 0, bottom: -2 },

  // 精简签名里也放这个淡化圆环（网址那一行附近）。代价：每封回复多一个 ~4KB 的内嵌图片
  markInShort: false,
  markShortOffset: { right: 0, bottom: 16 },

  // 字号（px）—— 想整体再紧凑或再大一点，改这里就行
  fontSizes: { name: 16, title: 13, row: 13, label: 13, rowLine: 19, footer: 11, notice: 13, tagline: 14 },

  /**
   * 回复 / 转发规则：
   * - 新邮件：完整签名
   * - 回复：如果本人在这个邮件会话里还没发过邮件 → 完整签名；已经发过 → 精简签名
   * - 转发：forwardAlwaysFull=true 时始终用完整签名（转给新的人通常需要完整联系方式）
   * - 共享邮箱回复：引用的历史邮件里已经有这个团队的签名 → 精简签名，否则完整签名（不看是谁发的）
   * - useShortSignature=false：不用精简签名，回复也一律用完整签名（每封回复都会重新带上图片附件）
   */
  forwardAlwaysFull: true,
  // ARC：所有邮件都用完整签名
  useShortSignature: false,

  colors: {
    text: "#0c328c",
    value: "#0c328c", // 联系方式内容
    muted: "#3c3838", // 公司名那一行
    label: "#ffb700", // 联系方式前的标签（M / P / E / W）
    link: "#0c328c",
    footer: "#a7a7a7", // 底部免责声明
    divider: "#0c328c", // Logo 与信息之间的竖线
    hairline: "", // 底部分隔细线；设为 "" 则不画
    accent: "#002f92", // 品牌主色（也用于加载项面板和手机签名页）
    title: "#ffb700", // 职位
    notice: "#f4901d", // 通知栏文字
  },
  fontFamily: "Arial, Helvetica, sans-serif",
};
