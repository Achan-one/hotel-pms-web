import type { RoomMatrixItemDto, TagCatalogItem } from '../types/pms';

/** 태그 코드를 사람이 읽는 이름으로 바꾸는 조회표. 목록에 없는 코드(삭제된 태그 등)는 코드를 그대로 쓴다. */
export function buildTagNameMap(catalog: TagCatalogItem[]): Map<string, string> {
  return new Map(catalog.map((t) => [t.code, t.name]));
}

export function tagNamesOf(room: RoomMatrixItemDto, names: Map<string, string>): string[] {
  return (room.tags ?? []).map((code) => names.get(code) ?? code);
}

/** 객실 칸에 마우스를 올렸을 때 보이는 툴팁. 예약 상태와 함께 보유 태그를 적는다. */
export function roomTooltip(room: RoomMatrixItemDto, names: Map<string, string>): string {
  const tags = tagNamesOf(room, names);
  const lines = [
    `[${room.roomNumber}호] ${room.roomTypeName}`,
    `상태: ${room.status}`,
  ];
  if (room.guestName) lines.push(`고객명: ${room.guestName}`);
  if (room.stayPeriodStr) lines.push(`기간: ${room.stayPeriodStr}`);
  lines.push(tags.length > 0 ? `태그: ${tags.join(', ')}` : '태그: 없음');
  return lines.join('\n');
}

// 태그 카테고리별 색. 태그 매트릭스에서 어떤 종류의 태그인지 한눈에 보이게 한다.
export const CATEGORY_CLASS: Record<string, string> = {
  FLOOR: 'border-sky-300 bg-sky-50 text-sky-800',
  LOCATION: 'border-violet-300 bg-violet-50 text-violet-800',
  VIEW: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  AMENITY: 'border-amber-300 bg-amber-50 text-amber-800',
  NOISE: 'border-rose-300 bg-rose-50 text-rose-800',
  ETC: 'border-slate-300 bg-slate-50 text-slate-700',
};

export const CATEGORY_LABEL: Record<string, string> = {
  FLOOR: '층수',
  LOCATION: '위치/동선',
  VIEW: '전망',
  AMENITY: '특수설비',
  NOISE: '소음',
  ETC: '기타',
};
