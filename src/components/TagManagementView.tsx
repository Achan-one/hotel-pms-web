import React, { useState, useEffect, useCallback } from 'react';
import { Tag as TagIcon, PlusCircle, Layers, Trash2, RefreshCw, X, SlidersHorizontal, Shield, Settings2, Edit3 } from 'lucide-react';
import apiClient from '../api/client';
import { pmsService } from '../api/pmsService';
import RoomTagMatrixView from './RoomTagMatrixView';

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

interface TagManagementViewProps {
  // 새 태그 정의 등록은 관리자만 할 수 있다. 정직원은 기존 태그 수정, 삭제, 객실 배치만 가능하다.
  canRegister: boolean;
}

export default function TagManagementView({ canRegister }: TagManagementViewProps) {
  // 태그 사전(목록/편집)과 객실 매트릭스(방마다 어떤 태그가 있는지) 두 화면을 탭으로 나눈다.
  const [subTab, setSubTab] = useState<'DICTIONARY' | 'MATRIX'>('DICTIONARY');
  const [tagList, setTagList] = useState<RoomTagItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // 1. 신규 태그 등록 모달
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<'VIEW' | 'FLOOR' | 'LOCATION' | 'AMENITY' | 'NOISE' | 'ETC'>('VIEW');
  const [newStrictness, setNewStrictness] = useState<'SOFT' | 'HARD'>('SOFT');
  const [newDefaultWeight, setNewDefaultWeight] = useState(25);
  const [selectedRoomsForNew, setSelectedRoomsForNew] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // 2. 통합 편집 모달 (태그 속성 + 191실 방 배치 동시 편집)
  const [editingTag, setEditingTag] = useState<RoomTagItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<'VIEW' | 'FLOOR' | 'LOCATION' | 'AMENITY' | 'NOISE' | 'ETC'>('VIEW');
  const [editStrictness, setEditStrictness] = useState<'SOFT' | 'HARD'>('SOFT');
  const [editDefaultWeight, setEditDefaultWeight] = useState(25);
  const [editRooms, setEditRooms] = useState<Set<string>>(new Set());
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

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

  const toggleRoomInSet = (roomNo: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(roomNo)) next.delete(roomNo);
      else next.add(roomNo);
      return next;
    });
  };

  const toggleFloorInSet = (floor: number, targetSet: Set<string>, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const prefix = floor < 10 ? `0${floor}` : `${floor}`;
    const floorAvailableRooms: string[] = [];

    for (let r = 1; r <= 16; r++) {
      if (r === 13) continue;
      if (floor >= 14 && (r === 3 || r === 7)) continue;
      const padRoom = r < 10 ? `0${r}` : `${r}`;
      floorAvailableRooms.push(`${prefix}${padRoom}`);
    }

    const allSelected = floorAvailableRooms.every((r) => targetSet.has(r));

    setter((prev) => {
      const next = new Set(prev);
      floorAvailableRooms.forEach((r) => {
        if (allSelected) next.delete(r);
        else next.add(r);
      });
      return next;
    });
  };

  // 통합 편집 모달 열기 (태그 정보와 적용 방 목록 로드)
  const handleOpenEditModal = async (tag: RoomTagItem) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditDescription(tag.description);
    setEditCategory((tag.category as any) || 'VIEW');
    setEditStrictness((tag.strictness as any) || 'SOFT');
    setEditDefaultWeight(tag.defaultWeight ?? 25);

    setEditLoading(true);
    try {
      const assignedRooms = await pmsService.getRoomsByTag(tag.code);
      setEditRooms(new Set(assignedRooms));
    } catch (e) {
      console.error('태그 적용 객실 목록 조회 실패:', e);
      alert('객실 매핑 정보를 불러오는 데 실패했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  // 통합 편집 저장 실행
  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;

    setEditSaving(true);
    try {
      await pmsService.updateTagFull(editingTag.code, {
        name: editName.trim(),
        description: editDescription.trim(),
        category: editCategory,
        strictness: editStrictness,
        defaultWeight: Number(editDefaultWeight),
        targetRoomNumbers: Array.from(editRooms),
      });

      setMsg({ text: `[${editName}] 태그 정보 및 방 배치(${editRooms.size}실)가 성공적으로 저장되었습니다.`, isError: false });
      setEditingTag(null);
      await fetchTags();
    } catch (err: any) {
      alert(err.response?.data?.message || '태그 수정 및 저장 실패');
    } finally {
      setEditSaving(false);
    }
  };

  // 모달 내부에서 커스텀 태그 완전 삭제 실행
  const handleDeleteFromModal = async () => {
    if (!editingTag || isDefaultTag(editingTag)) return;

    if (!confirm(`정말 [${editingTag.name}] 태그를 완전히 삭제하시겠습니까?\n191실에 부여된 해당 태그 매핑도 모두 회수됩니다.`)) {
      return;
    }

    try {
      const encodedCode = encodeURIComponent(editingTag.code.trim());
      const res = await apiClient.delete(`/api/admin/tags/${encodedCode}`);
      alert(res.data?.message || `[${editingTag.name}] 태그가 삭제되었습니다.`);
      setEditingTag(null);
      await fetchTags();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || '태그 삭제 실패');
      }
    }
  };

  // 신규 태그 등록 제출
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim() || !newDescription.trim()) {
      alert('필수 항목을 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/admin/tags', {
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        description: newDescription.trim(),
        category: newCategory,
        strictness: newStrictness,
        defaultWeight: Number(newDefaultWeight),
        targetRoomNumbers: Array.from(selectedRoomsForNew),
      });

      setMsg({ text: `[${newName}] 태그가 성공적으로 등록되었습니다.`, isError: false });
      setNewCode('');
      setNewName('');
      setNewDescription('');
      setSelectedRoomsForNew(new Set());
      setIsRegisterModalOpen(false);
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

  const subTabClass = (tab: 'DICTIONARY' | 'MATRIX') =>
    `rounded-t border border-b-0 px-4 py-1.5 text-xs font-bold transition ${
      subTab === tab
        ? 'border-slate-300 bg-white text-blue-700'
        : 'border-transparent bg-transparent text-slate-500 hover:text-slate-800'
    }`;

  return (
    <div className="flex w-full flex-col gap-3 font-sans text-slate-800">
      <div className="flex gap-1 border-b border-slate-300">
        <button type="button" className={subTabClass('DICTIONARY')} onClick={() => setSubTab('DICTIONARY')}>
          태그 사전
        </button>
        <button type="button" className={subTabClass('MATRIX')} onClick={() => setSubTab('MATRIX')}>
          객실 매트릭스
        </button>
      </div>

      {subTab === 'MATRIX' && <RoomTagMatrixView />}

      {subTab === 'DICTIONARY' && (
      <>
      {/* 1. 상단 타이틀 바 */}
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
              기본 물리 태그 및 커스텀 태그의 191실 배치 매핑과 속성을 자유롭게 조회하고 변경할 수 있습니다.
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
          {canRegister && (
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              <PlusCircle size={14} /> 새 태그 정의 등록
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`rounded border p-2.5 text-xs font-semibold ${
          msg.isError ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'
        }`}>
          {msg.text}
        </div>
      )}

      {/* 2. 데이터 테이블 (테이블 외부 휴지통 버튼 제거 -> 모달 내부 통합) */}
      <div className="overflow-hidden rounded border border-slate-300 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2">
          <span className="text-xs font-semibold text-slate-700">
            총 등록 태그: <b className="text-blue-700">{tagList.length}</b>건
          </span>
          <span className="text-[11px] text-slate-500">
            * <b>[속성 및 방 배치]</b> 버튼을 눌러 속성 변경, 191실 매핑 및 삭제를 진행할 수 있습니다.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-bold">
                <th className="w-24 px-4 py-2.5">구분</th>
                <th className="w-40 px-4 py-2.5 font-mono">태그 코드</th>
                <th className="w-32 px-4 py-2.5">표시 명칭</th>
                <th className="w-24 px-4 py-2.5">카테고리</th>
                <th className="w-24 px-4 py-2.5">엄격도</th>
                <th className="w-24 px-4 py-2.5 text-center">가중치</th>
                <th className="px-4 py-2.5">설명 및 AI 지침</th>
                <th className="w-32 px-4 py-2.5 text-center">방 배치 및 설정</th>
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
                    <td className="max-w-[420px] truncate px-4 py-2.5 text-slate-600 font-normal" title={tag.description}>
                      {tag.description}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => void handleOpenEditModal(tag)}
                        className="flex items-center justify-center gap-1 mx-auto rounded border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-2xs hover:bg-blue-100 transition"
                      >
                        <Edit3 size={12} /> 속성 및 방 배치
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. 통합 편집 모달: 커스텀 속성 수정 + 191실 매핑 + 좌측 하단 안전 삭제 */}
      {/* ========================================================================= */}
      {editingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-2xs">
          <div className="flex max-h-[92vh] w-[900px] flex-col overflow-hidden rounded border border-slate-300 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  [{editingTag.name} ({editingTag.code})] 태그 정보 및 191실 도면 배치 편집
                </h3>
                {isDefaultTag(editingTag) ? (
                  <span className="rounded bg-slate-200 border border-slate-300 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                    시스템 기본 (속성 잠김 / 방 배치만 수정 가능)
                  </span>
                ) : (
                  <span className="rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                    커스텀 태그 (속성, 방 배치, 삭제 가능)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditingTag(null)}
                className="text-slate-400 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form id="tagEditForm" onSubmit={handleSaveEditModal} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-5">
              
              {/* 태그 기본 정보 패널 */}
              <div className={`flex flex-col gap-3 rounded border p-3.5 ${
                isDefaultTag(editingTag) ? 'bg-slate-100/70 border-slate-300' : 'bg-blue-50/40 border-blue-200'
              }`}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">태그 고유 코드 (변경 불가)</label>
                    <input
                      type="text"
                      disabled
                      value={editingTag.code}
                      className="w-full rounded border border-slate-300 bg-slate-100 p-2 font-mono text-xs text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">UI 화면 표시 명칭</label>
                    <input
                      type="text"
                      disabled={isDefaultTag(editingTag)}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={`w-full rounded border border-slate-300 p-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none ${
                        isDefaultTag(editingTag) ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'
                      }`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">AI 프롬프트 매칭 지침 (비정형 메모 분류 기준)</label>
                  <textarea
                    rows={2}
                    disabled={isDefaultTag(editingTag)}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className={`w-full rounded border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none ${
                      isDefaultTag(editingTag) ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'
                    }`}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">카테고리</label>
                    <select
                      disabled={isDefaultTag(editingTag)}
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as any)}
                      className={`w-full rounded border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none ${
                        isDefaultTag(editingTag) ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'
                      }`}
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
                      disabled={isDefaultTag(editingTag)}
                      value={editStrictness}
                      onChange={(e) => setEditStrictness(e.target.value as any)}
                      className={`w-full rounded border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none ${
                        isDefaultTag(editingTag) ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'
                      }`}
                    >
                      <option value="SOFT">취향 선호 (SOFT)</option>
                      <option value="HARD">필수 제약 (HARD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">배정 가중치 점수</label>
                    <input
                      type="number"
                      disabled={isDefaultTag(editingTag)}
                      value={editDefaultWeight}
                      onChange={(e) => setEditDefaultWeight(Number(e.target.value))}
                      className={`w-full rounded border border-slate-300 p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none ${
                        isDefaultTag(editingTag) ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'
                      }`}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* 191실 도면 배치 매핑 선택 패널 */}
              <div className="rounded border border-slate-300 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Layers size={14} className="text-blue-700" />
                    <span>부여된 객실 배치 현황 (<b className="text-blue-700">{editRooms.size}실</b> 선택됨)</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditRooms(new Set())}
                      className="rounded border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      전체 해제
                    </button>
                  </div>
                </div>

                {editLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-600" />
                    객실 매핑 로딩 중...
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {Array.from({ length: 13 }, (_, i) => 15 - i).map((floor) => {
                      const prefix = floor < 10 ? `0${floor}` : `${floor}`;

                      return (
                        <div key={floor} className="flex items-stretch gap-1 h-6">
                          <button
                            type="button"
                            title={`${floor}층 전체 토글`}
                            onClick={() => toggleFloorInSet(floor, editRooms, setEditRooms)}
                            className="w-8 shrink-0 rounded border border-slate-300 bg-white text-[10px] font-bold text-slate-700 hover:bg-slate-100"
                          >
                            {floor}F
                          </button>

                          <div className="grid flex-1 grid-cols-16 gap-0.5">
                            {Array.from({ length: 16 }, (_, rIdx) => rIdx + 1).map((r) => {
                              const padRoom = r < 10 ? `0${r}` : `${r}`;
                              const roomNo = `${prefix}${padRoom}`;

                              if (r === 13 || (floor >= 14 && (r === 3 || r === 7))) {
                                return (
                                  <div
                                    key={r}
                                    className="rounded bg-slate-200/60 text-[9px] text-slate-400 flex items-center justify-center font-mono select-none"
                                  >
                                    -
                                  </div>
                                );
                              }

                              const isSelected = editRooms.has(roomNo);

                              return (
                                <button
                                  key={roomNo}
                                  type="button"
                                  onClick={() => toggleRoomInSet(roomNo, setEditRooms)}
                                  className={`rounded text-[10px] font-mono transition select-none ${
                                    isSelected
                                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
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
                )}
              </div>
            </form>

            {/* 모달 하단 푸터: [좌측 삭제 버튼] vs [우측 취소/저장 버튼] */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-2.5">
              <div>
                {!isDefaultTag(editingTag) ? (
                  <button
                    type="button"
                    onClick={handleDeleteFromModal}
                    className="flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                  >
                    <Trash2 size={13} /> 태그 완전 삭제
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">
                    * 시스템 기본 태그는 도면 보호를 위해 삭제가 불가합니다.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTag(null)}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  form="tagEditForm"
                  disabled={editSaving || editLoading}
                  className="rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:bg-slate-300"
                >
                  {editSaving ? '저장 중...' : `편집 내용 및 방 배치 (${editRooms.size}실) 저장`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. 신규 태그 등록 모달 */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-2xs">
          <div className="flex max-h-[90vh] w-[880px] flex-col overflow-hidden rounded border border-slate-300 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <PlusCircle size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">새 태그 정의 및 191실 도면 매핑</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form id="tagRegisterForm" onSubmit={handleRegisterSubmit} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">태그 고유 식별 코드</label>
                  <input
                    type="text"
                    placeholder="예: VIEW_OCEAN"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">UI 화면 표시 명칭</label>
                  <input
                    type="text"
                    placeholder="예: 오션뷰"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
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
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-700">카테고리</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
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
                    value={newStrictness}
                    onChange={(e) => setNewStrictness(e.target.value as any)}
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
                    value={newDefaultWeight}
                    onChange={(e) => setNewDefaultWeight(Number(e.target.value))}
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
                    <span>부여할 객실 선택 ({selectedRoomsForNew.size}실)</span>
                  </div>
                  {selectedRoomsForNew.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedRoomsForNew(new Set())}
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
                          onClick={() => toggleFloorInSet(floor, selectedRoomsForNew, setSelectedRoomsForNew)}
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

                            const isSelected = selectedRoomsForNew.has(roomNo);

                            return (
                              <button
                                key={roomNo}
                                type="button"
                                onClick={() => toggleRoomInSet(roomNo, setSelectedRoomsForNew)}
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
                onClick={() => setIsRegisterModalOpen(false)}
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
      </>
      )}
    </div>
  );
}