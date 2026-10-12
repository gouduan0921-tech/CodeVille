import type { RoleId } from './types.ts';

export const pick = <T>(arr: readonly T[], r: () => number = Math.random): T => arr[Math.floor(r() * arr.length)];

export const NAME_POOL = ['小林', '老周', '阿稳', '小吴', '小宋', '阿美', '大壮', '木子', '阿杰', '小雨', '老赵', '阿川', '小鱼', '阿豪', '星星', '小满', '阿远', '子墨', '小安', '阿宁'];

export const TASK_TITLES: Record<'feature' | 'bug' | 'hotfix' | 'chore', string[]> = {
  feature: ['用户登录与注册', '订单列表分页', '消息中心推送', '暗色主题支持', '搜索联想功能', '支付结果页改版', '数据看板导出 CSV', '个人资料编辑', '优惠券领取流程', '多语言切换', '文件上传断点续传', '权限管理后台'],
  bug: ['修复列表滚动卡顿', '修复表单重复提交', '修复时区显示错误', '修复图片偶发裂图', '修复登录态过期未跳转'],
  hotfix: ['紧急修复支付回调失败', '紧急回滚异常配置', '修复线上接口 500'],
  chore: ['升级依赖版本', '清理无用代码', '补充单元测试', '优化构建速度', '整理接口文档'],
};

type Pool = readonly string[];

export const BUBBLES: Record<string, Pool> = {
  'req.pm': ['梳理用户故事…', '这个需求优先级怎么排？', '画原型中…', '补充验收标准', '和 CTO 对一下范围'],
  'req.artist': ['出一版设计稿…', '调整配色与间距', '导出切图', '图标统一风格中'],
  'dev.frontend': ['写组件中…', '调样式…', 'React 状态怎么拆？', '这个按钮差 1px', '接口联调！', '打包体积有点大'],
  'dev.backend': ['设计接口…', 'SQL 要加索引', '写单测…', '缓存策略再想想', '联调 API 中', '事务边界要小心'],
  'dev.review': ['看看这个 PR…', '这里可以抽函数', 'LGTM 👍'],
  'test.qa': ['跑回归用例…', '边界值再测一遍', '兼容性检查', '提交缺陷单', '自动化脚本跑起来'],
  'ops.deploy': ['打包镜像…', '灰度发布中', '检查变更清单', '滚动升级进行中'],
  'ops.monitor': ['看 CPU 曲线…', '错误率正常', '日志抽检中', '告警规则复核', '延迟 P99 稳定'],
  'cto.approve': ['发布我来批', '风险评估过了', '同意上线'],
  'cto.patrol': ['大家进展如何？', '技术债要还啊', '看看各组情况', '这个方案再评估下'],
  'art.idle': ['画点小图标…', '找灵感中', '调色板整理'],
  'break.coffee': ['来杯咖啡 ☕', '续命时间', '今天的第三杯'],
  'break.snack': ['买点零食', '糖分补给'],
  'break.water': ['喝口水', '接杯热水'],
  'break.sofa': ['歇会儿…', '放空一下', '刷刷手机'],
  chat: ['昨晚的比赛看了吗？', '午饭吃什么？', '周末有空吗', '听说要发版了', '新需求来了？'],
  meeting: ['我先说下进展', '风险点有这些', '这个我来跟进', '对齐一下口径', '排期可以接受', '同意'],
  done: ['搞定 ✓', '完成啦！', '下一个～'],
  bug: ['发现一个 Bug 🐛', '复现了！', '这个得打回去'],
  bugfix: ['又有 Bug…', '收到，马上修', '先看复现步骤'],
  incident: ['🚨 线上告警！', '错误率飙升！', '先止血！'],
  resolved: ['恢复正常 ✓', '已回滚，稳定了', '根因找到了'],
  idle: ['…', '喝水提醒', '看看邮件', '整理笔记', '待命中'],
};

export const ACTIVITY_LABEL: Record<string, string> = {
  idle: '待命',
  desk: '在工位',
  'req.pm': '梳理需求',
  'req.artist': '设计界面',
  'dev.frontend': '编写前端代码',
  'dev.backend': '编写后端代码',
  'dev.review': '代码评审讨论',
  'test.qa': '执行测试',
  'test.rack': '真机兼容测试',
  'ops.deploy': '部署发布',
  'ops.monitor': '监控线上',
  'cto.approve': '审批发布',
  'cto.patrol': '巡视团队',
  'art.idle': '画点东西',
  'break.coffee': '喝咖啡',
  'break.snack': '拿零食',
  'break.water': '喝水',
  'break.sofa': '沙发小憩',
  chat: '闲聊',
  meeting: '开会',
  incident: '处理线上事故',
  waiting: '等待协作方',
  offline: '离线',
};

const replies = {
  greet: ['你好！有什么需要我配合的吗？', '在的～请讲。', '嗨，随时可以开始。'],
  working: ['我正在处理「{task}」，当前阶段：{stage}，进度约 {p}%。', '手上是「{task}」，{stage}阶段 {p}%，预计很快。'],
  idle: ['目前手上没有任务，可以给我派点活。', '暂时空闲，需要我做什么吗？'],
  break: ['我先休息一下，马上回来。', '补充点能量，稍后继续。'],
  meeting: ['我正在开会，稍后回复你。'],
  unknown: ['收到，我记下了。', '明白，我来安排。', '好的，有进展我会在日志里同步。'],
  task: ['已把「{title}」加入需求池。', '新需求「{title}」已创建，等待排期。'],
  breakAck: ['好的，我去休息区坐一会儿。'],
  meetAck: ['好的，我这就去站会区集合。'],
};
export const REPLIES = replies;

export const ROLE_INTRO: Record<RoleId, string> = {
  cto: '我是技术总监，负责方向把控、发布审批与事故响应。',
  pm: '我是产品经理，负责需求梳理与评审。',
  artist: '我是美术，负责界面与素材设计。',
  frontend: '我是前端，负责界面实现与交互。',
  backend: '我是后端，负责接口与数据。',
  qa: '我是测试，负责质量把关。',
  devops: '我是运维，负责部署与监控。',
};

export const MEETING_TITLES: Record<string, string> = {
  standup: '每日站会',
  review: '需求评审会',
  planning: '迭代规划会',
  incident: '事故复盘会',
};

export const MEETING_SUMMARIES: Record<string, string[]> = {
  standup: ['各角色同步了昨日进展与今日计划，无阻塞项。', '前后端联调进度正常，测试环境需要重置数据。', '运维提醒本周五有发布窗口，请提前提测。'],
  review: ['确认了需求范围与验收标准，拆分为前端、后端两条线。', '评审通过，设计稿将在本迭代内交付。'],
  planning: ['确定本迭代优先级：登录、订单、消息中心。', '风险：第三方支付联调排期紧，需提前对接。'],
  incident: ['定位到配置变更引发错误率上升，已回滚并补充发布检查项。', '增加灰度与告警阈值，复盘行动项已指派。'],
};
