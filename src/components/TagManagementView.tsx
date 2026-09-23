import React, { useState, useEffect, useCallback } from 'react';
import { Tag as TagIcon, PlusCircle, Check, Layers, Trash2, ShieldCheck, RefreshCw } from 'lucide-react';
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

function generateAllRoomNumbers(): string[] {
  const rooms: string[] = [];
  for (let floor = 3; floor <= 15; floor++) {
    for (let r = 1; r <= 16; r++) {
      if (r === 13) continue;
      if (floor >= 14 && (r === 3 || r === 7)) continue;
      const padFloor = floor < 10 ? `0${floor}` : `${floor}`;
      const padRoom = r < 10 ? `0${r}` : `${r}`;
      rooms.push(`${padFloor}${padRoom}`);
    }
  }
  return rooms;
}

const ALL_ROOMS = generateAllRoomNumbers();

// 🔒 건축 도면 기반 불변 시스템 기본 태그 코드 화이트리스트
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

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'VIEW' | 'FLOOR' | 'LOCATION' | 'AMENITY' | 'NOISE' | 'ETC'>('VIEW');
  const [strictness, setStrictness] = useState<'SOFT' | 'HARD'>('SOFT');
  const [defaultWeight, setDefaultWeight] = useState(25);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set(['1401', '1402', '1501', '1502']));
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // [2중 방어 검증] 태그 코드 자체 및 백엔드 JSON 불리언 속성 양방향 확인
  const isDefaultTag = (tag: RoomTagItem) => {
    if (SYSTEM_DEFAULT_CODES.has(tag.code.trim().toUpperCase())) {
      return true;
    }
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

  const selectFloor = (floorNum: number) => {
    const prefix = floorNum < 10 ? `0${floorNum}` : `${floorNum}`;
    const floorRooms = ALL_ROOMS.filter((r) => r.startsWith(prefix));
    const allSelected = floorRooms.every((r) => selectedRooms.has(r));

    setSelectedRooms((prev) => {
      const next = new Set(prev);
      floorRooms.forEach((r) => {
        if (allSelected) next.delete(r);
        else next.add(r);
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !description.trim()) {
      setMsg({ text: '태그 코드, 이름, AI 지침 설명을 모두 입력해 주세요.', isError: true });
      return;
    }

    setSubmitting(true);
    setMsg(null);

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

      setMsg({
        text: `[${name}] 태그가 등록되었습니다! AI 동적 사전 및 선택한 ${selectedRooms.size}개 객실에 즉시 주입되었습니다.`,
        isError: false,
      });

      setCode('');
      setName('');
      setDescription('');
      setSelectedRooms(new Set());
      await fetchTags();
    } catch (err: any) {
      setMsg({
        text: err.response?.data?.message || '태그 등록에 실패했습니다.',
        isError: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTag = async (tag: RoomTagItem) => {
    if (isDefaultTag(tag)) {
      alert(`[${tag.name}] 태그는 시스템 기본 물리 태그이므로 삭제할 수 없습니다.`);
      return;
    }

    if (!confirm(`정말 [${tag.name}] 태그를 삭제하시겠습니까?\n객실에서 해당 태그가 제거되며 AI 프롬프트 사전에서도 즉시 제외됩니다.`)) {
      return;
    }

    try {
      const res = await apiClient.delete(`/api/admin/tags/${tag.code}`);
      alert(res.data?.message || `[${tag.name}] 태그가 삭제되었습니다.`);
      await fetchTags();
    } catch (err: any) {
      alert(err.response?.data?.message || '태그 삭제 실패: 관리자 권한을 확인하세요.');
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TagIcon size={28} color="#38bdf8" />
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>AI 동적 태그 사전 & 도면 매핑 관리</h2>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              태그를 추가/삭제하면 백엔드 Gemini 2.5 Flash 프롬프트에 실시간 반영됩니다.
            </span>
          </div>
        </div>
        <button
          onClick={() => void fetchTags()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.8rem', backgroundColor: '#334155', color: '#38bdf8', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} className={listLoading ? 'spin' : ''} /> 사전 새로고침
        </button>
      </div>

      {msg && (
        <div style={{
          backgroundColor: msg.isError ? '#7f1d1d' : '#14532d',
          color: msg.isError ? '#fecaca' : '#bbf7d0',
          padding: '0.9rem 1.2rem',
          borderRadius: '8px',
          fontSize: '0.9rem',
          fontWeight: 600
        }}>
          {msg.text}
        </div>
      )}

      {/* 1. 신규 태그 등록 및 도면 매핑 폼 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#38bdf8' }}>
            새 커스텀 태그 정의 (AI 사전 등록)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>
                태그 고유 코드 (대문자/언더바)
              </label>
              <input
                type="text"
                placeholder="예: VIEW_TOKYO_TOWER, VIEW_OCEAN"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>
                화면 표시명 (UI용)
              </label>
              <input
                type="text"
                placeholder="예: 도쿄타워 전망, 오션뷰"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#38bdf8', marginBottom: '6px' }}>
              💡 Gemini AI 프롬프트 지침용 상세 설명 (인공지능이 고객 메모와 매칭할 핵심 기준)
            </label>
            <textarea
              rows={2}
              placeholder="예: 창문 밖으로 도쿄타워나 시티 야경이 조망되는 객실. 고객이 '도쿄타워', 'Tokyo Tower', '야경' 등을 원할 때 매칭."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', resize: 'vertical' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
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
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>엄격도</label>
              <select
                value={strictness}
                onChange={(e) => setStrictness(e.target.value as any)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
              >
                <option value="SOFT">취향 선호 (SOFT - 미충족 시 차선 배정)</option>
                <option value="HARD">필수 제약 (HARD - 미충족 시 알림 발생)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>가중치 점수</label>
              <input
                type="number"
                value={defaultWeight}
                onChange={(e) => setDefaultWeight(Number(e.target.value))}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
                required
              />
            </div>
          </div>
        </div>

        {/* 191실 클릭 그리드 */}
        <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="#38bdf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                이 태그를 부여할 객실 선택 ({selectedRooms.size}실 선택됨)
              </h3>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              방 버튼을 클릭하면 토글됩니다. 좌측 층수 버튼은 해당 층 전체를 선택합니다.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: 13 }, (_, i) => 15 - i).map((floor) => {
              const prefix = floor < 10 ? `0${floor}` : `${floor}`;
              const floorRooms = ALL_ROOMS.filter((r) => r.startsWith(prefix));

              return (
                <div key={floor} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => selectFloor(floor)}
                    style={{
                      width: '60px', padding: '6px', backgroundColor: '#334155', color: '#94a3b8',
                      border: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {floor}F
                  </button>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {floorRooms.map((roomNo) => {
                      const isSelected = selectedRooms.has(roomNo);
                      return (
                        <button
                          key={roomNo}
                          type="button"
                          onClick={() => toggleRoom(roomNo)}
                          style={{
                            padding: '6px 10px', borderRadius: '4px',
                            border: isSelected ? '1px solid #38bdf8' : '1px solid #475569',
                            backgroundColor: isSelected ? '#0284c7' : '#0f172a',
                            color: isSelected ? '#ffffff' : '#94a3b8',
                            fontSize: '0.8rem', fontWeight: isSelected ? 700 : 500, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          {isSelected && <Check size={12} />}
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

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '1rem', backgroundColor: '#0284c7', color: '#fff', border: 'none',
            borderRadius: '8px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          <PlusCircle size={20} />
          {submitting ? '등록 중...' : `새 커스텀 태그 등록 & ${selectedRooms.size}개 객실 일괄 매핑`}
        </button>
      </form>

      {/* 2. 현재 등록된 태그 사전 카탈로그 테이블 */}
      <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#34d399" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              현재 등록된 태그 사전 카탈로그 ({tagList.length}개)
            </h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            * 기본 태그는 도면 규격 보호를 위해 삭제가 불가합니다.
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '0.75rem 1rem' }}>구분</th>
                <th style={{ padding: '0.75rem 1rem' }}>태그 코드</th>
                <th style={{ padding: '0.75rem 1rem' }}>화면 표시명</th>
                <th style={{ padding: '0.75rem 1rem' }}>분류</th>
                <th style={{ padding: '0.75rem 1rem' }}>엄격도</th>
                <th style={{ padding: '0.75rem 1rem' }}>AI 지침 상세 설명</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {tagList.map((tag) => {
                const defaultTag = isDefaultTag(tag);
                return (
                  <tr key={tag.code} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {defaultTag ? (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#334155', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                          기본 태그
                        </span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#1e3a8a', color: '#93c5fd', fontSize: '0.75rem', fontWeight: 600 }}>
                          커스텀
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#38bdf8' }}>{tag.code}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{tag.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{tag.category}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ color: tag.strictness === 'HARD' ? '#f87171' : '#fbbf24', fontWeight: 600 }}>
                        {tag.strictness}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', maxWidth: '360px' }}>
                      {tag.description}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {defaultTag ? (
                        <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
                          삭제 불가
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteTag(tag)}
                          style={{
                            padding: '4px 8px', backgroundColor: '#7f1d1d', color: '#fecaca',
                            border: '1px solid #b91c1c', borderRadius: '4px', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem',
                          }}
                        >
                          <Trash2 size={13} /> 삭제
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
    </div>
  );
}