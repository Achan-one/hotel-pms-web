import { useState, useEffect, useCallback } from 'react';
import type { SubmitEvent } from 'react';
import type { ReservationDetailDto } from '../api/pmsService';
import { pmsService } from '../api/pmsService';
import apiClient from '../api/client';
import {
  ArrowLeft, CheckCircle2, ArrowRightLeft, FileCode, User, KeyRound, UserX, Sparkles, Tag, Plus, Minus
} from 'lucide-react';

interface Props {
  reservation: ReservationDetailDto;
  businessDate: string;
  onBack: () => void;
  onUpdated: () => void;
}

const formatRoomNumber = (val: string) => {
  const trimmed = val.trim();
  if (trimmed.length === 3 && !isNaN(Number(trimmed))) {
    return '0' + trimmed;
  }
  return trimmed;
};

export default function ReservationDetailView({ reservation: initialReservation, businessDate, onBack, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'OPERATIONAL' | 'CONTRACT_AUDIT'>('OPERATIONAL');
  const [reservation, setReservation] = useState<ReservationDetailDto>(initialReservation);

  const [opGuestName, setOpGuestName] = useState('');
  const [opCheckIn, setOpCheckIn] = useState('');
  const [opNights, setOpNights] = useState(1);
  const [staffMemo, setStaffMemo] = useState('');

  // 🏷️ 현장 운영 태그 편집 상태
  const [allTags, setAllTags] = useState<Array<{ code: string; name: string }>>([]);
  const [editPreferredTags, setEditPreferredTags] = useState<Set<string>>(new Set());
  const [editAvoidTags, setEditAvoidTags] = useState<Set<string>>(new Set());
  const [tagSaving, setTagSaving] = useState(false);

  const [assignRoom, setAssignRoom] = useState('');
  const [moveRoom, setMoveRoom] = useState('');
  const [moveReason, setMoveReason] = useState('고객 시설 보상 업그레이드');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 전체 태그 카탈로그 로드
  useEffect(() => {
    apiClient.get('/api/admin/tags')
      .then((res) => {
        const list = res.data?.data || [];
        setAllTags(list.map((t: any) => ({ code: t.code, name: t.name })));
      })
      .catch(() => console.error('태그 목록 로드 실패'));
  }, []);

  const syncFormState = useCallback((data: ReservationDetailDto) => {
    setReservation(data);
    setOpGuestName(data.operationalGuestName || data.guestName || '');
    setOpCheckIn(data.operationalCheckInDate || data.checkInDate || '');
    setOpNights(data.operationalStayNights || data.stayNights || 1);
    setStaffMemo(data.internalStaffMemo || data.rawRequestText || '');
    setAssignRoom(data.assignedRoomNumber ? data.assignedRoomNumber.replace(/^0/, '') : '');
    setMoveRoom('');

    // 태그 상태 동기화
    setEditPreferredTags(new Set(data.tagPreference?.preferredTags || []));
    setEditAvoidTags(new Set(data.tagPreference?.avoidTags || []));
  }, []);

  useEffect(() => {
    syncFormState(initialReservation);
  }, [initialReservation, syncFormState]);

  const reloadCurrentReservation = async () => {
    try {
      const refreshed = await pmsService.getReservationDetail(reservation.reservationId);
      syncFormState(refreshed);
      onUpdated();
    } catch {
      console.error('현재 예약 상세 재동기화 실패');
    }
  };

  // 태그 상태 토글 (미선택 -> 선호(+) -> 기피(-) -> 미선택)
  const cycleTagState = (tagCode: string) => {
    if (editPreferredTags.has(tagCode)) {
      setEditPreferredTags((prev) => {
        const next = new Set(prev);
        next.delete(tagCode);
        return next;
      });
      setEditAvoidTags((prev) => new Set(prev).add(tagCode));
    } else if (editAvoidTags.has(tagCode)) {
      setEditAvoidTags((prev) => {
        const next = new Set(prev);
        next.delete(tagCode);
        return next;
      });
    } else {
      setEditPreferredTags((prev) => new Set(prev).add(tagCode));
    }
  };

  // 현장 태그 저장 핸들러
  const handleSaveOperationalTags = async () => {
    setTagSaving(true);
    setMsg('');
    try {
      await pmsService.updateOperationalTags(reservation.reservationId, {
        preferredTags: Array.from(editPreferredTags),
        avoidTags: Array.from(editAvoidTags),
      });
      alert('현장 운영 태그가 성공적으로 저장되었습니다.\n(원본 계약 원장과 요청 원문은 안전하게 보존됩니다)');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '태그 갱신 실패');
      }
    } finally {
      setTagSaving(false);
    }
  };

  const handleSaveOperational = async (e: SubmitEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      await pmsService.updateOperationalOverride(reservation.reservationId, {
        operationalGuestName: opGuestName,
        operationalCheckInDate: opCheckIn,
        operationalStayNights: Number(opNights),
        internalStaffMemo: staffMemo,
      });
      alert('PMS 현장 투숙 정보가 수정되었습니다.');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '운영 정보 저장 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualAssign = async (e: SubmitEvent) => {
    e.preventDefault();
    const formatted = formatRoomNumber(assignRoom);
    if (!formatted) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.manualAssign(reservation.reservationId, formatted);
      alert(`[${formatted}호] 객실 배정이 완료되었습니다.`);
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '객실 배정 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (!confirm(`[${reservation.assignedRoomNumber}호] 배정을 취소하고 미배정 상태로 되돌리시겠습니까?`)) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.unassignRoom(reservation.reservationId);
      alert('객실 배정이 취소되어 미배정 상태로 변경되었습니다.');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '배정 취소 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoomMove = async (e: SubmitEvent) => {
    e.preventDefault();
    const formatted = formatRoomNumber(moveRoom);
    if (!formatted) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.changeRoom(reservation.reservationId, formatted, moveReason, businessDate);
      alert(`[룸 체인지 완료] ${reservation.assignedRoomNumber}호 -> ${formatted}호로 이전되었습니다.`);
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '룸 체인지 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!confirm(`[${reservation.assignedRoomNumber}호] 체크인(입실) 처리하시겠습니까?`)) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.checkIn(reservation.reservationId);
      alert('체크인이 완료되어 투숙중(In-House) 상태로 전환되었습니다.');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '체크인 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        {/* 상단 네비게이션 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.9rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.12)', backgroundColor: '#1e293b', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              <ArrowLeft size={16} /> 예약 목록으로
            </button>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                {reservation.operationalGuestName || reservation.guestName} 고객 예약 마스터
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontFamily: 'monospace' }}>예약번호: {reservation.reservationId}</span>
                <span style={{
                  fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700,
                  backgroundColor: reservation.status === 'CHECKED_IN' ? 'rgba(239, 68, 68, 0.2)' : reservation.status === 'ASSIGNED' ? 'rgba(59, 130, 246, 0.2)' : '#1e293b',
                  color: reservation.status === 'CHECKED_IN' ? '#f87171' : reservation.status === 'ASSIGNED' ? '#60a5fa' : '#94a3b8',
                  border: `1px solid ${reservation.status === 'CHECKED_IN' ? 'rgba(239, 68, 68, 0.4)' : reservation.status === 'ASSIGNED' ? 'rgba(59, 130, 246, 0.4)' : 'transparent'}`
                }}>
                  {reservation.status === 'CHECKED_IN' ? '투숙중 (In-House)' : reservation.status}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setActiveTab('OPERATIONAL')} style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'OPERATIONAL' ? '#0284c7' : '#1e293b', color: '#fff', fontWeight: 600 }}>
              현장 운영 & 객실 제어
            </button>
            <button onClick={() => setActiveTab('CONTRACT_AUDIT')} style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'CONTRACT_AUDIT' ? '#0284c7' : '#1e293b', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileCode size={16} /> OTA 원천 계약 & 감사 원장
            </button>
          </div>
        </div>

        {msg && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '0.75rem 1.2rem', borderRadius: '6px', fontSize: '0.88rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              {msg}
            </div>
        )}

        {activeTab === 'OPERATIONAL' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
              
              {/* 좌측: 현장 정보 + 태그 편집기 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* 🏷️ 현장 운영 태그 커스텀 편집 카드 (원천 계약 보존) */}
                <div style={{ backgroundColor: '#131d36', padding: '1.4rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                      <Tag size={18} />
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>현장 운영 배정 태그 오버라이드</h4>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>클릭하여 선호(+)/기피(-)/해제 전환</span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 12px 0' }}>
                    고객 유선 요청 등으로 배정 조건을 수정할 때 사용합니다. OTA 원문 요청사항은 보존됩니다.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1rem' }}>
                    {allTags.map((t) => {
                      const isPref = editPreferredTags.has(t.code);
                      const isAvoid = editAvoidTags.has(t.code);

                      let bg = '#0b1329';
                      let color = '#94a3b8';
                      let border = '1px solid #293548';
                      let icon = null;

                      if (isPref) {
                        bg = 'rgba(16, 185, 129, 0.2)';
                        color = '#34d399';
                        border = '1px solid #10b981';
                        icon = <Plus size={11} strokeWidth={3} />;
                      } else if (isAvoid) {
                        bg = 'rgba(239, 68, 68, 0.2)';
                        color = '#f87171';
                        border = '1px solid #ef4444';
                        icon = <Minus size={11} strokeWidth={3} />;
                      }

                      return (
                        <button
                          key={t.code}
                          type="button"
                          onClick={() => cycleTagState(t.code)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 9px', borderRadius: '6px', backgroundColor: bg, color: color,
                            border: border, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s ease', userSelect: 'none'
                          }}
                        >
                          {icon}
                          {t.name}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      선호: <b style={{ color: '#34d399' }}>{editPreferredTags.size}</b>개 / 기피: <b style={{ color: '#f87171' }}>{editAvoidTags.size}</b>개
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveOperationalTags}
                      disabled={tagSaving}
                      style={{ padding: '0.45rem 1rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {tagSaving ? '저장 중...' : '운영 태그 저장 (AI 배정 기준 즉시 반영)'}
                    </button>
                  </div>
                </div>

                {/* Gemini AI 파싱 원본 참조 카드 */}
                <div style={{ backgroundColor: '#131d36', padding: '1.2rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c084fc', marginBottom: '8px' }}>
                    <Sparkles size={16} />
                    <h4 style={{ margin: 0, fontSize: '0.92rem' }}>Gemini AI 원문 메모 파싱 분석 결과</h4>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '8px', fontStyle: 'italic', backgroundColor: '#0b1329', padding: '8px 12px', borderRadius: '6px' }}>
                    &quot;{reservation.rawRequestText || '(고객 요청 메모 없음)'}&quot;
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    * OTA에서 최초 인입될 때 AI가 분석했던 원본 상태입니다.
                  </div>
                </div>

                {/* 현장 투숙 정보 오버라이드 폼 */}
                <form onSubmit={handleSaveOperational} style={{ backgroundColor: '#131d36', padding: '1.4rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                    <User size={18} />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>현장 투숙 정보 관리</h3>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>실투숙자 성명</label>
                    <input type="text" value={opGuestName} onChange={(e) => setOpGuestName(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }} required />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>실제 체크인 일자</label>
                      <input type="date" value={opCheckIn} onChange={(e) => setOpCheckIn(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>실제 투숙 박수</label>
                      <input type="number" min="1" value={opNights} onChange={(e) => setOpNights(Number(e.target.value))} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }} required />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>프론트 직원 인계 메모</label>
                    <textarea value={staffMemo} onChange={(e) => setStaffMemo(e.target.value)} rows={2} placeholder="특이사항 및 인계 메모 입력" style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }} />
                  </div>

                  <button type="submit" disabled={loading} style={{ padding: '0.75rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', marginTop: '4px', fontSize: '0.85rem' }}>
                    현장 정보 저장 (원장에 즉시 반영)
                  </button>
                </form>
              </div>

              {/* 우측: 객실 배정 및 상태 제어 콘솔 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '8px', border: '1px solid #293548' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>현재 배정 객실:</span>
                    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: reservation.assignedRoomNumber ? '#34d399' : '#f87171' }}>
                      {reservation.assignedRoomNumber ? `${reservation.assignedRoomNumber}호` : '미배정'}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    계약 룸타입: <b>{reservation.bookedRoomType || reservation.roomType}</b>
                  </div>
                </div>

                {reservation.status !== 'CHECKED_IN' && reservation.status !== 'CHECKED_OUT' && reservation.status !== 'CANCELLED' && (
                    <div style={{ backgroundColor: '#131d36', padding: '1.4rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <form onSubmit={handleManualAssign} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                          <KeyRound size={18} />
                          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>수동 호실 지정 (3자리/4자리)</h4>
                        </div>
                        <input
                            type="text"
                            placeholder="예: 501 또는 0501"
                            value={assignRoom}
                            onChange={(e) => setAssignRoom(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }}
                            required
                        />
                        <button type="submit" disabled={loading} style={{ padding: '0.65rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                          {reservation.assignedRoomNumber ? '호실 재배정' : '신규 배정 확정'}
                        </button>
                      </form>

                      {reservation.assignedRoomNumber && (
                          <button
                              type="button"
                              onClick={handleUnassign}
                              disabled={loading}
                              style={{ padding: '0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
                          >
                            <UserX size={16} /> 배정 취소 (방 빼기)
                          </button>
                      )}

                      {reservation.status === 'ASSIGNED' && (
                          <button
                              type="button"
                              onClick={handleCheckIn}
                              disabled={loading}
                              style={{ padding: '0.75rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.9rem' }}
                          >
                            <CheckCircle2 size={16} /> 당일 체크인 완료
                          </button>
                      )}
                    </div>
                )}

                {reservation.status === 'CHECKED_IN' && (
                    <form onSubmit={handleRoomMove} style={{ backgroundColor: '#131d36', padding: '1.4rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                        <ArrowRightLeft size={18} />
                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>재실 고객 룸 체인지</h4>
                      </div>
                      <input type="text" placeholder="이전할 새 호실 (예: 1404, 502)" value={moveRoom} onChange={(e) => setMoveRoom(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }} required />
                      <input type="text" placeholder="변경 사유 (예: 업그레이드, 시설 불편)" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }} />
                      <button type="submit" disabled={loading} style={{ padding: '0.65rem', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                        오늘({businessDate}) 기준 룸 체인지 실행
                      </button>
                    </form>
                )}
              </div>
            </div>
        )}

        {/* 계약 원장 및 감사 스냅샷 탭 (불변 원본 증명) */}
        {activeTab === 'CONTRACT_AUDIT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ backgroundColor: '#131d36', padding: '1.5rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', color: '#f59e0b' }}>🔒 OTA 원천 계약 스냅샷 (Audit Ledger)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '0.9rem', backgroundColor: '#0b1329', padding: '1.2rem', borderRadius: '8px', border: '1px solid #293548' }}>
                  <div>원 계약자명: <b style={{ color: '#f8fafc' }}>{reservation.originalGuestName || reservation.guestName}</b></div>
                  <div>계약 룸타입: <b style={{ color: '#38bdf8' }}>{reservation.bookedRoomType || reservation.roomType}</b></div>
                  <div>계약 체크인: <b>{reservation.contractCheckInDate || reservation.checkInDate}</b></div>
                  <div>계약 숙박일수: <b>{reservation.contractStayNights || reservation.stayNights}박</b></div>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}