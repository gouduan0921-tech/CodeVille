import type { RoleId, RoomId, StageId } from './types.ts';

export interface RoleDef {
  id: RoleId;
  name: string; // 中文名
  en: string;
  emoji: string;
  color: string; // 名牌色（参考 MVO 的彩色名牌）
  home: RoomId;
  homeLabel: string;
  skin: number; // 默认精灵
  hue: number;
  desc: string;
}

export const ROLES: RoleDef[] = [
  { id: 'cto', name: '技术总监', en: 'CTO', emoji: '⚡', color: '#ffd700', home: 'cto', homeLabel: 'CTO 办公室', skin: 3, hue: 0, desc: '把控技术方向，审批发布，处理线上事故' },
  { id: 'pm', name: '产品', en: 'PM', emoji: '📋', color: '#4d79ff', home: 'product', homeLabel: '产品会议室', skin: 5, hue: 0, desc: '梳理需求，撰写 PRD，组织评审' },
  { id: 'artist', name: '美术', en: 'Artist', emoji: '🎨', color: '#e0508c', home: 'art', homeLabel: '美术工作室', skin: 5, hue: 150, desc: '界面与素材设计，产出设计稿' },
  { id: 'frontend', name: '前端', en: 'Frontend', emoji: '🖥️', color: '#29b6f6', home: 'dev', homeLabel: '开发区', skin: 0, hue: 0, desc: '界面实现，交互与性能优化' },
  { id: 'backend', name: '后端', en: 'Backend', emoji: '🗄️', color: '#ab47bc', home: 'dev', homeLabel: '开发区', skin: 1, hue: 0, desc: '接口、数据与服务端逻辑' },
  { id: 'qa', name: '测试', en: 'QA', emoji: '🧪', color: '#43a047', home: 'qa', homeLabel: '测试实验室', skin: 2, hue: 0, desc: '用例设计、回归测试、缺陷跟踪' },
  { id: 'devops', name: '运维', en: 'DevOps', emoji: '🛠️', color: '#ff7300', home: 'ops', homeLabel: '运维中心', skin: 4, hue: 0, desc: '构建部署，线上监控与告警响应' },
];

export const ROLE_MAP: Record<RoleId, RoleDef> = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<RoleId, RoleDef>;

export interface StageDef {
  id: StageId;
  name: string;
  emoji: string;
  color: string;
  /** 本阶段参与的角色（在团队中存在才需要） */
  needs: RoleId[];
  /** 基础耗时（秒，1x 速度） */
  seconds: number;
}

export const STAGES: StageDef[] = [
  { id: 'backlog', name: '需求池', emoji: '📥', color: '#6c757d', needs: [], seconds: 0 },
  { id: 'requirement', name: '需求', emoji: '📋', color: '#4d79ff', needs: ['pm', 'artist'], seconds: 16 },
  { id: 'dev', name: '开发', emoji: '💻', color: '#ffc107', needs: ['frontend', 'backend'], seconds: 28 },
  { id: 'test', name: '测试', emoji: '🧪', color: '#43a047', needs: ['qa'], seconds: 18 },
  { id: 'deploy', name: '部署', emoji: '🚀', color: '#ff7300', needs: ['devops', 'cto'], seconds: 9 },
  { id: 'monitor', name: '监控', emoji: '📡', color: '#00bcd4', needs: ['devops'], seconds: 14 },
  { id: 'done', name: '完成', emoji: '✅', color: '#198754', needs: [], seconds: 0 },
];

export const STAGE_MAP: Record<StageId, StageDef> = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<StageId, StageDef>;
export const PIPELINE: StageId[] = ['requirement', 'dev', 'test', 'deploy', 'monitor'];

export const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  working: { label: '工作中', color: '#ff5252', icon: '🔴' },
  idle: { label: '空闲', color: '#4caf50', icon: '🟢' },
  meeting: { label: '会议中', color: '#2196f3', icon: '🔵' },
  break: { label: '休息', color: '#ffb300', icon: '☕' },
  blocked: { label: '阻塞', color: '#ff9800', icon: '⏳' },
  error: { label: '故障', color: '#e91e63', icon: '🚨' },
  offline: { label: '离线', color: '#78909c', icon: '⚫' },
};
