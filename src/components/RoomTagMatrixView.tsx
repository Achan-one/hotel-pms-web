import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Filter, X } from 'lucide-react';
import { pmsService } from '../api/pmsService';
import type { FloorMapResponseDto, RoomMatrixItemDto, TagCatalogItem } from '../types/pms';
import RoomMatrixGrid from './RoomMatrixGrid';
import { CATEGORY_CLASS, CATEGORY_LABEL, buildTagNameMap, tagNamesOf } from './tagDisplay';

/**
 * 태그 사전 관리의 "객실 매트릭스" 탭. 어떤 방에 어떤 태그가 붙어 있는지 도면 위에서 확인한다.
 * 태그를 하나 이상 고르면 그 태그를 모두 가진 방만 강조하고 나머지는 흐리게 보여 준다.
 */
export default function RoomTagMatrixView() {
  const [floorMap, setFloorMap] = useState<FloorMapResponseDto | null>(null);
  const [catalog, setCatalog] = useState<TagCatalogItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 조회 일자를 주지 않으면 서버가 현재 영업일 기준으로 내려 준다. 태그는 날짜와 무관하다.
      const [data, tags] = await Promise.all([pmsService.getRoomIndicator(), pmsService.getTagCatalog()]);
      setFloorMap(data);
      setCatalog(tags);
    } catch (err) {
      console.error('객실 태그 매트릭스 로드 실패:', err);
      setError('객실 태그 정보를 불러오지 못했습니다. 새로고침해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tagNames = useMemo(() => buildTagNameMap(catalog), [catalog]);

  // 태그별로 몇 개 방에 붙어 있는지. 태그 목록의 배지에 함께 보여 준다.
  const roomCountByTag = useMemo(() => {
    const counts = new Map<string, number>();
    if (!floorMap) return counts;
    Object.values(floorMap.floorRooms).flat().forEach((room) => {
      (room.tags ?? []).forEach((code) => counts.set(code, (counts.get(code) ?? 0) + 1));
    });
    return counts;
  }, [floorMap]);

  const matches = useCallback(
    (room: RoomMatrixItemDto) => selected.size === 0 || [...selected].every((code) => (room.tags ?? []).includes(code)),
    [selected]
  );

  const matchedRoomCount = useMemo(() => {
    if (!floorMap || selected.size === 0) return 0;
    return Object.values(floorMap.floorRooms).flat().filter(matches).length;
  }, [floorMap, selected, matches]);

  const toggleTag = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <div className="flex w-full flex-col gap-3 font-sans text-slate-800">
      <div className="rounded border border-slate-300 bg-white px-4 py-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">객실 태그 매트릭스</h3>
            <p className="text-[11px] text-slate-500">
              방마다 붙어 있는 태그를 도면에서 확인합니다. 태그를 고르면 그 태그를 모두 가진 방만 강조됩니다. 방에 마우스를 올리면 전체 태그가 보입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>

        {/* 태그 필터 */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
            <Filter size={12} /> 태그 필터
          </span>
          {catalog.map((tag) => {
            const on = selected.has(tag.code);
            const tone = CATEGORY_CLASS[tag.category] ?? CATEGORY_CLASS.ETC;
            return (
              <button
                key={tag.code}
                type="button"
                onClick={() => toggleTag(tag.code)}
                title={`${CATEGORY_LABEL[tag.category] ?? tag.category} · ${tag.description}`}
                className={`rounded border px-2 py-0.5 text-[11px] font-semibold transition ${tone} ${
                  on ? 'ring-2 ring-blue-500 ring-offset-1' : 'opacity-80 hover:opacity-100'
                }`}
              >
                {tag.name} <span className="font-mono text-[10px] opacity-70">{roomCountByTag.get(tag.code) ?? 0}</span>
              </button>
            );
          })}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <X size={11} /> 선택 해제
            </button>
          )}
        </div>
        {selected.size > 0 && (
          <p className="mt-2 text-[11px] text-slate-600">
            선택한 태그를 모두 가진 방: <b className="text-blue-700">{matchedRoomCount}실</b>
          </p>
        )}
      </div>

      {error && (
        <div className="rounded border border-rose-300 bg-rose-50 px-4 py-2 text-xs text-rose-800">{error}</div>
      )}

      {floorMap && (
        <div className="flex min-h-[520px] flex-col overflow-hidden rounded border border-slate-300 bg-slate-200/60 p-1.5 shadow-xs">
          <RoomMatrixGrid
            floorRooms={floorMap.floorRooms}
            renderRoom={(room) => {
              const names = tagNamesOf(room, tagNames);
              const highlighted = selected.size > 0 && matches(room);
              const dimmed = selected.size > 0 && !highlighted;
              return (
                <div
                  title={`[${room.roomNumber}호] ${room.roomTypeName}\n태그: ${names.length > 0 ? names.join(', ') : '없음'}`}
                  className={`flex h-full min-w-0 select-none flex-col justify-between rounded border px-1 py-0.5 shadow-2xs transition ${
                    highlighted
                      ? 'border-blue-600 bg-blue-100 text-blue-900 ring-2 ring-blue-500'
                      : dimmed
                        ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400'
                  }`}
                >
                  <span className="border-b border-black/5 pb-0.5 font-mono text-[11px] font-extrabold leading-none tracking-tight">
                    {room.roomNumber}
                  </span>
                  <div className="truncate pt-0.5 text-center text-[9px] font-semibold leading-none">
                    {names.length === 0 ? (
                      <span className="opacity-40">-</span>
                    ) : (
                      <span className="truncate">
                        {names[0]}
                        {names.length > 1 && <span className="font-mono opacity-70"> +{names.length - 1}</span>}
                      </span>
                    )}
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
