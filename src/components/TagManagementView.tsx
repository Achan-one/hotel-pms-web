import React, { useState, useEffect, useCallback } from 'react';
import { Tag as TagIcon, PlusCircle, Check, Layers, Trash2, RefreshCw, X, SlidersHorizontal, Shield } from 'lucide-react';
import apiClient from '../api/client';

export interface RoomTagItem {
  code: string;
  name: string;
  description: string;
  category: string;
  strictness: string;
  defaultWeight: number;
  isSystemDefault?: boolean;
  systemDefault?: boolean;
}

const SYSTEM_DEFAULT_CODES = new Set([
  'HIGH_FLOOR',
  'LOW_FLOOR',
  'NEAR_ELEVATOR',
  'AWAY_FROM_ELEVATOR',
  'CORNER_ROOM',
  'QUIET_ZONE',
  'ACCESSIBLE',
]);

export default function TagManagementView() {
  const [tagList, setTagList] = useState<RoomTagItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'VIEW' | 'FLOOR' | 'LOCATION' | 'AMENITY' | 'NOISE' | 'ETC'>('VIEW');
  const [strictness, setStrictness] = useState<'SOFT' | 'HARD'>('SOFT');
  const [defaultWeight, setDefaultWeight] = useState(25);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const isDefaultTag = (tag: RoomTagItem) => {
    if (SYSTEM_DEFAULT_CODES.has(tag.code.trim().toUpperCase())) return true;
    return Boolean(tag.isSystemDefault || tag.systemDefault);
  };

  const fetchTags = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await apiClient.get('/api/admin/tags');
      setTagList(res.data.data || []);
    } catch {
      console.error('태그 목록 조회 실패');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const toggleRoom = (roomNo: string) => {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomNo)) next.delete(roomNo);
      else next.add(roomNo);
      return next;
    });
  };

  const selectFloor = (floor: number) => {
    const prefix = floor < 10 ? `0${floor}` : `${floor}`;
    const floorAvailableRooms: string[] = [];

    for (let r = 1; r <= 16; r++) {
      if (r === 13) continue;
      if (floor >= 14 && (r === 3 || r === 7)) continue;
      const padRoom = r < 10 ? `0${r}` : `${r}`;
      floorAvailableRooms.push(`${prefix}${padRoom}`);
    }

    const allSelected = floorAvailableRooms.every((r) => selectedRooms.has(r));

    setSelectedRooms((prev) => {
      const next = new Set(prev);
      floorAvailableRooms.forEach((r) => {
        if (allSelected) next.delete(r);
        else next.add(r);
      });
      return next;
    });
  };

  const clearSelectedRooms = () => setSelectedRooms(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !description.trim()) {
      alert('필수 항목을 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/admin/tags', {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        category,
        strictness,
        defaultWeight: Number(defaultWeight),
        targetRoomNumbers: Array.from(selectedRooms),
      });

      setMsg({ text: `[${name}] 태그가 성공적으로 등록되었습니다.`, isError: false });
      setCode('');
      setName('');
      setDescription('');
      setSelectedRooms(new Set());
      setIsModalOpen(false);
      await fetchTags();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || '태그 등록에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTag = async (tag: RoomTagItem) => {
    if (isDefaultTag(tag)) {
      alert(`[${tag.name}] 태그는 기본 물리 태그이므로 삭제할 수 없습니다.`);
      return;
    }
    if (!confirm(`[${tag.name}] 태그를 삭제하시겠습니까?`)) return;

    try {
      const encodedCode = encodeURIComponent(tag.code.trim());
      const res = await apiClient.delete(`/api/admin/tags/${encodedCode}`);
      alert(res.data?.message || `[${tag.name}] 태그가 삭제되었습니다.`);
      await fetchTags();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || '태그 삭제 실패');
      }
    }
  };

  return (
    <div className="flex w-full flex-col gap-3 font-sans text-slate-800">
      {/* 1. 상단 타이틀 & 액션 툴바 */}
      <div className="flex items-center justify-between rounded border border-slate-300 bg-white px-4 py-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-100 border border-slate-300 text-slate-700">
            <TagIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">객실 태그 카탈로그 & 도면 속성 매핑</h2>
              <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-700">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              규칙 기반 배정 엔진 및 AI 프롬프트 파싱 사전과 실시간 동기화되는 도면 태그 카탈로그입니다[cite: 5, 7].
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchTags()}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw size={13} className={listLoading ? 'animate-spin' : ''} /> 새로고침
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
          >
            <PlusCircle size={14} /> 새 태그 정의 등록
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded border p-2.5 text-xs font-semibold ${
          msg.isError ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'
        }`}>
          {msg.text}
        </div>
      )}

      {/* 2. 고밀도 엔터프라이즈 데이터 테이블 */}
      <div className="overflow-hidden rounded border border-slate-300 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2">
          <span className="text-xs font-semibold text-slate-700">
            총 등록 태그: <b className="text-blue-700">{tagList.length}</b>건
          </span>
          <span className="text-[11px] text-slate-400">
            * 기본 물리 태그는 시스템 무결성을 위해 도면 삭제가 제한됩니다[cite: 5, 7].
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-bold">
                <th className="w-24 px-4 py-2.5">구분</th>
                <th className="w-40 px-4 py-2.5 font-mono">태그 코드</th>
                <th className="w-32 px-4 py-2.5">표시 명칭</th>
                <th className="w-28 px-4 py-2.5">카테고리</th>
                <th className="w-24 px-4 py-2.5">엄격도</th>
                <th className="w-24 px-4 py-2.5 text-center">가중치 점수</th>
                <th className="px-4 py-2.5">AI 프롬프트 매칭 지침 및 상세 정의</th>
                <th className="w-20 px-4 py-2.5 text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tagList.map((tag, idx) => {
                const defaultTag = isDefaultTag(tag);
                return (
                  <tr key={tag.code} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/70'}>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                        defaultTag
                          ? 'border border-slate-300 bg-slate-100 text-slate-600'
                          : 'border border-blue-200 bg-blue-50 text-blue-800'
                      }`}>
                        {defaultTag ? <Shield size={11} /> : <SlidersHorizontal size={11} />}
                        {defaultTag ? '시스템 기본' : '커스텀'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{tag.code}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{tag.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 border border-slate-200">
                        {tag.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-semibold ${tag.strictness === 'HARD' ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                        {tag.strictness === 'HARD' ? 'HARD (필수)' : 'SOFT (선호)'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-700">
                      +{tag.defaultWeight ?? 25}점
                    </td>
                    <td className="max-w-[480px] truncate px-4 py-2.5 text-slate-600 font-normal">
                      {tag.description}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {defaultTag ? (
                        <span className="text-[11px] font-semibold text-slate-400">보호됨</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteTag(tag)}
                          className="rounded border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700 shadow-2xs hover:bg-rose-50"
                        >
                          <Trash2 size={11} className="inline mr-1" />삭제
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 새 태그 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-2xs">
          <div className="flex max-h-[90vh] w-[880px] flex-col overflow-hidden rounded border border-slate-300 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <PlusCircle size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">새 태그 정의 및 191실 도면 매핑</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form id="tagRegisterForm" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">태그 고유 식별 코드</label>
                  <input
                    type="text"
                    placeholder="예: VIEW_OCEAN"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">UI 화면 표시 명칭</label>
                  <input
                    type="text"
                    placeholder="예: 오션뷰"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-700">AI 프롬프트 매칭 지침 (비정형 메모 분류 기준)</label>
                <textarea
                  rows={2}
                  placeholder="예: 창문 밖으로 바다 전망이 보이는 객실. 고객이 '오션뷰', '바다', 'Ocean' 등을 원할 때 매칭."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">카테고리</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="VIEW">전망 (VIEW)</option>
                    <option value="FLOOR">층수 (FLOOR)</option>
                    <option value="LOCATION">위치/동선 (LOCATION)</option>
                    <option value="AMENITY">특수설비 (AMENITY)</option>
                    <option value="NOISE">소음 (NOISE)</option>
                    <option value="ETC">기타 (ETC)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">엄격도</label>
                  <select
                    value={strictness}
                    onChange={(e) => setStrictness(e.target.value as any)}
                    className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="SOFT">취향 선호 (SOFT)</option>
                    <option value="HARD">필수 제약 (HARD)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">배정 가중치 점수</label>
                  <input
                    type="number"
                    value={defaultWeight}
                    onChange={(e) => setDefaultWeight(Number(e.target.value))}
                    className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* 191실 도면 선택 */}
              <div className="rounded border border-slate-300 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Layers size={14} />
                    <span>부여할 객실 선택 ({selectedRooms.size}실)</span>
                  </div>
                  {selectedRooms.size > 0 && (
                    <button
                      type="button"
                      onClick={clearSelectedRooms}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      초기화
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  {Array.from({ length: 13 }, (_, i) => 15 - i).map((floor) => {
                    const prefix = floor < 10 ? `0${floor}` : `${floor}`;

                    return (
                      <div key={floor} className="flex items-stretch gap-1 h-6">
                        <button
                          type="button"
                          onClick={() => selectFloor(floor)}
                          className="w-8 shrink-0 rounded border border-slate-300 bg-white text-[10px] font-bold text-slate-700 hover:bg-slate-100"
                        >
                          {floor}F
                        </button>

                        <div className="grid flex-1 grid-cols-16 gap-0.5">
                          {Array.from({ length: 16 }, (_, rIdx) => rIdx + 1).map((r) => {
                            const padRoom = r < 10 ? `0${r}` : `${r}`;
                            const roomNo = `${prefix}${padRoom}`;

                            if (r === 13 || (floor >= 14 && (r === 3 || r === 7))) {
                              return <div key={r} className="rounded bg-slate-200/60 text-[9px] text-slate-400 flex items-center justify-center font-mono">-</div>;
                            }

                            const isSelected = selectedRooms.has(roomNo);

                            return (
                              <button
                                key={roomNo}
                                type="button"
                                onClick={() => toggleRoom(roomNo)}
                                className={`rounded text-[10px] font-mono transition ${
                                  isSelected
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {roomNo}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="submit"
                form="tagRegisterForm"
                disabled={submitting}
                className="rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
              >
                {submitting ? '등록 중...' : '태그 등록 완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}