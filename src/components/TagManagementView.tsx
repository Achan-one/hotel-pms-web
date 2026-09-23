import React, { useState, useEffect, useCallback } from 'react';
import { Tag as TagIcon, PlusCircle, Check, Layers, Trash2, ShieldCheck, RefreshCw, AlertTriangle, X, Info } from 'lucide-react';
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

  // 모달 팝업 열림 상태
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 등록 폼 상태
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

  const clearSelectedRooms = () => {
    setSelectedRooms(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !description.trim()) {
      alert('태그 코드, 이름, AI 지침 설명을 모두 입력해 주세요.');
      return;
    }

    if (selectedRooms.size === 0) {
      if (!confirm('부여할 객실이 0실로 선택되어 있습니다. 객실 지정 없이 AI 사전 정의만 우선 등록하시겠습니까?')) {
        return;
      }
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

      setMsg({
        text: `[${name}] 태그가 등록되었습니다! AI 동적 사전 및 선택한 ${selectedRooms.size}개 객실에 주입되었습니다.`,
        isError: false,
      });

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
      alert(`[${tag.name}] 태그는 시스템 기본 물리 태그이므로 삭제할 수 없습니다.`);
      return;
    }

    if (!confirm(`정말 [${tag.name}] 태그를 삭제하시겠습니까?\n객실에서 해당 태그가 제거되며 AI 프롬프트 사전에서도 즉시 제외됩니다.`)) {
      return;
    }

    try {
      const encodedCode = encodeURIComponent(tag.code.trim());
      const res = await apiClient.delete(`/api/admin/tags/${encodedCode}`);
      alert(res.data?.message || `[${tag.name}] 태그가 삭제되었습니다.`);
      await fetchTags();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || '태그 삭제 실패: 관리자 권한을 확인하세요.');
      }
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#f8fafc', boxSizing: 'border-box' }}>
      
      {/* 1. 상단 타이틀 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', width: '100%' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <TagIcon size={24} color="#38bdf8" />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              AI 동적 태그 사전 & 도면 매핑 관리
            </h2>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', fontWeight: 600 }}>
              Gemini 2.5 Flash Sync
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
            사전 변경 시 AI 시스템 프롬프트에 0초 즉시 실시간 동기화됩니다. 기본 태그는 도면 규격 보호를 위해 삭제 불가합니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => void fetchTags()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.85rem', backgroundColor: '#131d36', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s' }}
          >
            <RefreshCw size={14} className={listLoading ? 'spin' : ''} /> 새로고침
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1.1rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, boxShadow: '0 2px 10px rgba(2, 132, 199, 0.35)' }}
          >
            <PlusCircle size={16} /> 새 태그 등록
          </button>
        </div>
      </div>

      {msg && (
        <div style={{
          backgroundColor: msg.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          color: msg.isError ? '#fca5a5' : '#6ee7b7',
          border: `1px solid ${msg.isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          padding: '0.85rem 1.2rem', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600
        }}>
          {msg.text}
        </div>
      )}

      {/* 2. 등록된 태그 사전 카탈로그 테이블 */}
      <div style={{ width: '100%', backgroundColor: '#131d36', padding: '1.25rem 1.5rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#34d399" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              등록된 태그 사전 카탈로그 <span style={{ color: '#38bdf8', fontSize: '0.9rem' }}>({tagList.length}개)</span>
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            * 커스텀 태그는 삭제 시 객실 및 AI 프롬프트에서 즉시 배제됩니다.
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#0b1329', color: '#94a3b8', borderBottom: '1px solid #293548' }}>
                <th style={{ padding: '0.75rem 1rem' }}>구분</th>
                <th style={{ padding: '0.75rem 1rem' }}>태그 코드</th>
                <th style={{ padding: '0.75rem 1rem' }}>표시명</th>
                <th style={{ padding: '0.75rem 1rem' }}>분류</th>
                <th style={{ padding: '0.75rem 1rem' }}>엄격도</th>
                <th style={{ padding: '0.75rem 1rem' }}>가중치</th>
                <th style={{ padding: '0.75rem 1rem' }}>AI 지침 상세 매칭 설명</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {tagList.map((tag) => {
                const defaultTag = isDefaultTag(tag);
                return (
                  <tr key={tag.code} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '0.7rem 1rem' }}>
                      {defaultTag ? (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #334155' }}>
                          기본 물리 태그
                        </span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                          커스텀
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.7rem 1rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>{tag.code}</td>
                    <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#e2e8f0' }}>{tag.name}</td>
                    <td style={{ padding: '0.7rem 1rem', color: '#94a3b8' }}>{tag.category}</td>
                    <td style={{ padding: '0.7rem 1rem' }}>
                      <span style={{ color: tag.strictness === 'HARD' ? '#f87171' : '#fbbf24', fontWeight: 700 }}>
                        {tag.strictness}
                      </span>
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: '#cbd5e1', fontWeight: 600 }}>{tag.defaultWeight ?? 25}점</td>
                    <td style={{ padding: '0.7rem 1rem', color: '#94a3b8', maxWidth: '420px', lineHeight: 1.4 }}>
                      {tag.description}
                    </td>
                    <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
                      {defaultTag ? (
                        <span style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 500 }}>
                          삭제 불가
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteTag(tag)}
                          style={{
                            padding: '4px 8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5',
                            border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600
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

      {/* 3. [모달 팝업] 독립 세로 스크롤이 완벽히 적용된 창 */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '2rem', boxSizing: 'border-box'
        }}>
          <div style={{
            width: '1050px',
            maxHeight: '90vh',
            backgroundColor: '#131d36',
            borderRadius: '12px',
            border: '1px solid #38bdf8',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden' // 헤더와 푸터를 밖으로 밀어내지 못하게 차단
          }}>
            {/* 고정 모달 헤더 */}
            <div style={{
              padding: '1.1rem 1.5rem', backgroundColor: '#0f172a', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  새 커스텀 태그 정의 및 객실 도면 매핑
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* 🔥 독립 세로 스크롤 영역 (flex: 1, minHeight: 0, overflowY: auto) */}
            <form
              id="tagRegisterForm"
              onSubmit={handleSubmit}
              style={{
                flex: 1,
                minHeight: 0, // Flex 컨테이너 내 스크롤 생성을 위한 필수 선언
                overflowY: 'auto', // 내부 스크롤 강제 활성화
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                boxSizing: 'border-box'
              }}
            >
              {/* 기존 등록 태그 프리뷰 바 */}
              <div style={{ backgroundColor: '#0b1329', padding: '0.85rem 1.1rem', borderRadius: '8px', border: '1px solid #293548', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700, marginBottom: '6px' }}>
                  <Info size={14} /> 현재 운영 중인 태그 목록 (중복 방지용 참조)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tagList.map((t) => (
                    <span
                      key={t.code}
                      style={{
                        fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px',
                        backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <b style={{ color: t.isSystemDefault || t.systemDefault ? '#94a3b8' : '#38bdf8' }}>{t.name}</b>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>({t.code})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* 입력 인풋 그리드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flexShrink: 0 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '5px' }}>
                    태그 고유 코드 (대문자/언더바)
                  </label>
                  <input
                    type="text"
                    placeholder="예: VIEW_OCEAN, AMENITY_BATH"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '5px' }}>
                    화면 표시명 (UI용)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 오션뷰, 편백나무 욕조"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>

              <div style={{ flexShrink: 0 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600, marginBottom: '5px' }}>
                  💡 Gemini AI 프롬프트 지침용 상세 설명 (고객 예약 메모와 매칭할 핵심 기준)
                </label>
                <textarea
                  rows={2}
                  placeholder="예: 창문 밖으로 바다 전망이 보이는 객실. 고객이 '오션뷰', '바다', 'Ocean' 등을 원할 때 매칭."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', resize: 'vertical', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', flexShrink: 0 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '5px' }}>카테고리</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as unknown as 'VIEW' | 'FLOOR' | 'LOCATION' | 'AMENITY' | 'NOISE' | 'ETC')}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }}
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
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '5px' }}>엄격도</label>
                  <select
                    value={strictness}
                    onChange={(e) => setStrictness(e.target.value as unknown as 'SOFT' | 'HARD')}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  >
                    <option value="SOFT">취향 선호 (SOFT - 미충족 시 차선 배정)</option>
                    <option value="HARD">필수 제약 (HARD - 미충족 시 알림 발생)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginBottom: '5px' }}>매칭 가중치</label>
                  <input
                    type="number"
                    value={defaultWeight}
                    onChange={(e) => setDefaultWeight(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>

              {/* 191실 매트릭스 도면 */}
              <div style={{ border: `1px solid ${selectedRooms.size === 0 ? 'rgba(239, 68, 68, 0.5)' : '#293548'}`, borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{
                  padding: '0.75rem 1.1rem', backgroundColor: '#0f172a', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={17} color="#38bdf8" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                      이 태그를 부여할 객실 선택
                    </span>

                    {selectedRooms.size === 0 ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem',
                        padding: '2px 8px', borderRadius: '4px',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.5)', fontWeight: 700
                      }}>
                        <AlertTriangle size={12} color="#f87171" />
                        선택된 객실 없음 (0실) — 방을 클릭하세요
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#0284c7', color: '#fff', fontWeight: 700 }}>
                        {selectedRooms.size}실 선택됨
                      </span>
                    )}
                  </div>

                  {selectedRooms.size > 0 && (
                    <button
                      type="button"
                      onClick={clearSelectedRooms}
                      style={{ padding: '2px 8px', fontSize: '0.72rem', backgroundColor: 'transparent', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      선택 초기화
                    </button>
                  )}
                </div>

                <div style={{ padding: '0.85rem', backgroundColor: '#0b1329', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {Array.from({ length: 13 }, (_, i) => 15 - i).map((floor) => {
                    const prefix = floor < 10 ? `0${floor}` : `${floor}`;

                    return (
                      <div key={floor} style={{ display: 'flex', alignItems: 'stretch', gap: '5px', height: '28px' }}>
                        <button
                          type="button"
                          onClick={() => selectFloor(floor)}
                          title={`${floor}층 전체 선택/해제`}
                          style={{
                            width: '40px', minWidth: '40px', height: '100%', backgroundColor: '#0f172a', color: '#38bdf8',
                            border: '1px solid #293548', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none'
                          }}
                        >
                          {floor}F
                        </button>

                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '4px' }}>
                          {Array.from({ length: 16 }, (_, rIdx) => rIdx + 1).map((r) => {
                            const padRoom = r < 10 ? `0${r}` : `${r}`;
                            const roomNo = `${prefix}${padRoom}`;

                            if (r === 13) {
                              return (
                                <div
                                  key={r}
                                  title="13호 결번"
                                  style={{
                                    height: '100%', borderRadius: '3px', border: '1px dashed #293548',
                                    backgroundColor: 'rgba(11, 19, 41, 0.4)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.7rem', userSelect: 'none'
                                  }}
                                >
                                  -
                                </div>
                              );
                            }

                            if (floor >= 14 && (r === 3 || r === 7)) {
                              return (
                                <div
                                  key={r}
                                  title="설비실 결번"
                                  style={{
                                    height: '100%', borderRadius: '3px', border: '1px dashed #334155',
                                    backgroundColor: 'rgba(19, 29, 54, 0.4)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.65rem', userSelect: 'none'
                                  }}
                                >
                                  설비
                                </div>
                              );
                            }

                            const isSelected = selectedRooms.has(roomNo);

                            return (
                              <button
                                key={roomNo}
                                type="button"
                                onClick={() => toggleRoom(roomNo)}
                                title={`${roomNo}호 선택`}
                                style={{
                                  height: '100%', padding: 0, borderRadius: '3px',
                                  border: isSelected ? '1px solid #38bdf8' : '1px solid #293548',
                                  backgroundColor: isSelected ? '#0284c7' : '#131d36',
                                  color: isSelected ? '#ffffff' : '#94a3b8',
                                  fontSize: '0.75rem', fontWeight: isSelected ? 800 : 500, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px',
                                  transition: 'all 0.12s ease', userSelect: 'none',
                                  boxShadow: isSelected ? '0 0 6px rgba(56, 189, 248, 0.4)' : 'none'
                                }}
                              >
                                {isSelected && <Check size={10} strokeWidth={3} />}
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

            {/* 고정 모달 푸터 (스크롤과 무관하게 하단 고정) */}
            <div style={{
              padding: '1rem 1.5rem', backgroundColor: '#0f172a', borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0
            }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '0.65rem 1.2rem', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                취소
              </button>
              <button
                type="submit"
                form="tagRegisterForm"
                disabled={submitting}
                style={{
                  padding: '0.65rem 1.4rem', backgroundColor: '#0284c7', color: '#fff', border: 'none',
                  borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 10px rgba(2, 132, 199, 0.35)'
                }}
              >
                <PlusCircle size={16} />
                {submitting ? '등록 중...' : `새 커스텀 태그 등록 (${selectedRooms.size}실 매핑)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}