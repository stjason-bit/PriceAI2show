# Code Review SaaS Productization Design

Date: 2026-07-20

## Goal

将当前 ShipAny Two 项目产品化为面向创业团队和小型研发团队的代码审查 SaaS。首版要形成可销售闭环：用户登录后上传仓库 ZIP，系统执行安全索引、规则扫描和 LLM 跨文件审查，生成可确认、可导出的报告；代码审查按模式消耗积分；用户通过订阅套餐获得周期积分，并可购买补充积分包。

## Product Positioning

产品主线是一句话：把仓库快照转成团队可以执行的代码审查报告。

目标用户：

- 创业团队 CTO、技术负责人、Tech Lead。
- 小型研发团队，希望在发版、交付、重构前快速发现风险。
- 没有足够 senior reviewer 带宽，但需要稳定审查质量的团队。

核心价值：

- 节省高级工程师初筛时间。
- 在发布前发现权限、支付、API、数据边界、重复逻辑、测试缺口等风险。
- 生成结构化报告，支持人工确认、状态留痕和 Markdown/JSON 导出。

## Decisions

- 代码审查必须消耗积分。
- 定价采用订阅为主、补充积分包为辅。
- 首版不做组织空间、团队成员、GitHub App、PR 评论、自动修复或质量门禁。
- 优先复用 ShipAny 现有组件、模型、支付、积分、鉴权和动态页面机制。
- 中英文文案都围绕代码审查 SaaS，移除 ShipAny boilerplate 相关销售文案。
- 不使用虚假客户 logo 或伪造客户评价；首页可使用产品指标、角色场景和技术信任点增强商业 SaaS 感。

## Scope

### In Scope

- 首页落地页商业化改造。
- 导航、SEO、Header/Footer、CTA 文案统一为 CodeReview AI。
- 定价页改为代码审查订阅套餐和补充积分包。
- 代码审查发起流程接入积分检查和积分扣除。
- 代码审查列表、详情、上传表单显示积分成本、余额不足提示和购买入口。
- 支付成功继续使用现有订单、订阅、积分发放逻辑。
- 修复当前中文 JSON 文案乱码，保证中文页面可读。
- 保持现有登录、数据库、用户中心、Admin、RBAC、积分管理和支付能力。

### Out of Scope

- 多租户组织账单。
- 团队成员邀请和权限分层。
- GitHub/GitLab 代码仓库连接。
- PR 差异审查和评论回写。
- 自动提交修复代码。
- 漏洞数据库或 SBOM 深度依赖扫描。
- 后台异步队列化大规模任务。

## User Journey

1. 访客进入首页，看到清晰的代码审查 SaaS 定位、工作流程、模式、价格和 CTA。
2. 访客点击开始审查，未登录时弹出或跳转登录。
3. 登录用户进入 `/activity/code-reviews`。
4. 用户选择 ZIP、审查模式和附加说明。
5. 前端展示该模式所需积分和当前余额。
6. 余额不足时阻止提交，并引导到 `/pricing`。
7. 余额充足时提交审查，服务端再次校验余额。
8. 服务端完成安全索引、规则扫描、LLM 审查、报告生成。
9. 审查成功后扣除积分，并记录消费流水。
10. 审查失败时不扣积分；如果扣分动作已发生，需要回滚或返还。
11. 用户查看报告、更新 finding 状态、导出 Markdown/JSON。
12. 用户在 `/settings/credits` 查看积分流水，在 `/settings/billing` 查看订阅。

## Credits Design

审查模式消耗：

- Standard Review: 10 credits。
- Deep Review: 25 credits。
- Security Review: 20 credits。

扣费原则：

- 前端只做提示，服务端是最终校验点。
- `/api/code-reviews` 创建任务前检查用户剩余积分。
- 积分不足返回结构化错误，前端显示购买入口。
- 审查成功完成后写入积分消费流水。
- 如果审查过程中失败，不应产生最终消费。
- 如果实现上必须先预扣，应在失败时返还；首版推荐完成后扣费，避免长任务失败造成用户争议。

积分场景：

- 新增代码审查消费场景标识，例如 `code_review_standard`、`code_review_deep`、`code_review_security`。
- 消费记录 metadata 保存 job id、mode、archive name、included file count、model。

## Pricing Design

定价采用两个 group：

- Subscription: 月付/年付订阅，周期性获得审查积分。
- Credit Packs: 一次性补充积分包。

订阅套餐：

- Starter: 面向个人 founder 或很小团队，包含基础月度积分。
- Team: 默认推荐，面向 3-10 人研发团队，包含更多月度积分和深度审查额度。
- Pro: 面向高频发版团队，包含更高积分、优先支持和更长报告保留策略文案。

补充包：

- 100 credits。
- 300 credits。
- 1000 credits。

实现方式：

- 继续使用 `pages.pricing` JSON 驱动 Pricing block。
- `product_id`、`product_name`、`credits`、`valid_days` 与现有 checkout API 保持兼容。
- 订阅套餐使用 `interval: "month"` 和 `interval: "year"`。
- 补充包使用 `interval: "one-time"`。
- 套餐文案必须描述代码审查权益，不再描述模板、部署、隐私政策生成或 boilerplate。

## Landing Page Design

首页继续走动态页面 JSON，不重写路由。

建议 section 顺序：

1. `hero`: 首屏定位、价值主张、主 CTA、次 CTA、安全提示。
2. `logos`: 不放客户 logo，改为“Built for modern engineering stacks”，使用现有技术 logo 资产。
3. `stats`: 使用真实产品事实，例如 3 review modes、7-stage pipeline、0 code execution。
4. `introduce` with `features-list`: 解释规则扫描、LLM 跨文件推理、人工确认报告。
5. `workflow` with `features-step`: 上传、索引、规则扫描、LLM 审查、分类、确认、导出。
6. `benefits` with `features-accordion`: 低噪声、安全边界、发布前风险控制。
7. `features`: 正确性、安全权限、支付/API、重复逻辑、架构测试、报告导出。
8. `testimonials`: 不写成真实客户评价，改为角色场景卡片，例如 CTO、Tech Lead、Founder 的使用场景。
9. `pricing`: 首页可展示订阅主套餐入口，完整购买仍可访问 `/pricing`。
10. `faq`: 回答是否执行代码、扣多少积分、失败是否扣费、支持哪些文件、是否支持 PR。
11. `cta`: 打开审查工作台或查看价格。

Hero 文案方向：

- Title: "Ship safer code reviews before every release"
- Highlight: "safer code reviews"
- Description: "Upload a repository snapshot and get a structured review report with rule evidence, cross-file reasoning, human triage, and exportable findings."

中文方向：

- Title: "让每次发版前都有一份可信代码审查"
- Highlight: "可信代码审查"
- Description: "上传仓库快照，生成包含规则证据、跨文件推理、人工确认状态和可导出结论的结构化报告。"

## Authentication and Account Protection

保留现有 Better Auth。

要求：

- 未登录用户点击审查或购买，复用现有 sign modal 或跳转登录。
- `/activity/code-reviews` 继续受 `proxy.ts` 登录保护。
- 服务端 API 全部使用 `getUserInfo()` 校验用户。
- 用户只能访问自己的 code review job、findings 和 report。

## Database and Models

保留现有表：

- user/session/account/verification。
- order/subscription/credit。
- codeReviewJob/codeReviewFile/codeReviewFinding/codeReviewReport。

需要最小模型扩展：

- 代码审查消费积分时复用 `consumeCredits`。
- `CreditTransactionScene` 可新增 code review 相关场景，或在 `scene` 中存储字符串并通过 metadata 区分。
- 如果为了类型清晰新增 enum 值，Postgres/MySQL/SQLite schema 也要保持兼容。

## API Design

`POST /api/code-reviews` 增强：

- 解析 mode 后计算积分成本。
- 校验登录。
- 校验余额。
- 校验 ZIP 和说明长度。
- 执行审查。
- 审查完成后扣除积分。
- 持久化 job/report/findings。
- 返回 job、report、creditsCost、remainingCredits。

失败响应：

- `insufficient_credits`: 返回 requiredCredits、remainingCredits、pricingUrl。
- `file_required`、`archive_too_large`、`invalid_archive` 等继续返回用户可理解的信息。
- LLM/API 失败时 job 标记 failed，且不扣积分。

前端行为：

- 上传表单展示模式说明、消耗积分和余额。
- 余额不足时按钮变为“购买积分”或显示次级按钮。
- 成功后跳转报告详情。

## UI Components

优先复用：

- `src/themes/default/blocks/hero.tsx`
- `features-list`
- `features-step`
- `features-accordion`
- `features`
- `stats`
- `logos`
- `testimonials`
- `pricing`
- `faq`
- `cta`
- `ConsoleLayout`
- `Card`、`Button`、`Badge`、`Tabs`、`Select`、`Table`

允许的新增 UI：

- 如果现有 code-review upload form 无法优雅展示积分余额，可在 `src/shared/blocks/code-review/upload-form.tsx` 内做局部增强。
- 不新增独立设计系统。
- 不做大规模视觉重构。

## Error Handling

- 余额不足：明确告诉用户还差多少积分，并提供 `/pricing` 链接。
- 未登录：显示登录入口。
- 支付未配置：Pricing block 仍显示套餐，但 checkout 错误保持现有提示；配置工作通过 Admin 完成。
- 审查失败：job 保留 failed 状态和错误信息；用户不会被扣费。
- 中文 JSON 无效或乱码：构建必须捕获，修复为合法 UTF-8 JSON。

## Testing

必要验证：

- `pnpm test`
- `pnpm lint`
- `$env:VERCEL='1'; pnpm build`

新增或更新测试：

- code review mode 到积分成本的映射。
- 积分不足时 API 返回 `insufficient_credits`。
- 审查失败不扣积分。
- 审查成功产生消费流水。
- 定价 JSON 可以被加载。

手动验证：

- 未登录点击开始审查会要求登录。
- 低余额用户无法发起审查并能跳转价格页。
- 高余额用户能完成审查。
- `/settings/credits` 能看到代码审查消费记录。
- `/pricing` 套餐文案和商品名称都已变成 CodeReview AI。
- `/` 中英文首页无乱码，CTA 指向正确。

## Implementation Notes

- 工作优先顺序：先修正文案和定价，再接入积分扣费，最后补测试和验证。
- 不修改无关 scaffold 基础能力。
- 保留已有 code-review Evolink provider 和报告流程。
- 普通 `pnpm build` 在当前 Windows 环境可能因 standalone symlink 权限失败；以 Vercel 构建路径作为主要验证，同时在最终说明中记录该环境限制。

## Acceptance Criteria

- 首页看起来像专业代码审查 SaaS，而不是 ShipAny 模板演示站。
- 代码审查核心 CTA 明确导向 `/activity/code-reviews`。
- 定价页展示订阅套餐和补充积分包。
- 代码审查按 Standard/Deep/Security 消耗不同积分。
- 积分不足时用户不能创建审查任务。
- 支付购买套餐后仍沿用现有积分发放逻辑。
- 中文和英文主线文案一致且无乱码。
- 测试、lint、Vercel build 验证通过。
