import { useState, useEffect, useCallback } from 'react';
import type { SubmitEvent } from 'react';
import type { ReservationDetailDto } from '../api/pmsService';
import { pmsService } from '../api/pmsService';
import {
  ArrowLeft, CheckCircle2, ArrowRightLeft, FileCode, User, ShieldAlert, KeyRound, UserX
} from 'lucide-react';

interface Props {
  reservation: ReservationDetailDto;
  businessDate: string;
  onBack: () => void;
  onUpdated: () => void;
}

// 501 -> 0501 자동 변환 함수
const formatRoomNumber = (val: string) => {
  const trimmed = val.trim();
  if (trimmed.length === 3 && !isNaN(Number(trimmed))) {
    return '0' + trimmed;
  }
  return trimmed;
};

export default function ReservationDetailView({ reservation: initialReservation, businessDate, onBack, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'OPERATIONAL' | 'CONTRACT_AUDIT'>('OPERATIONAL');

  // 현재 상세 예약 실시간 상태
  const [reservation, setReservation] = useState<ReservationDetailDto>(initialReservation);

  // 현장 운영 수정 폼 상태
  const [opGuestName, setOpGuestName] = useState('');
  const [opCheckIn, setOpCheckIn] = useState('');
  const [opNights, setOpNights] = useState(1);
  const [staffMemo, setStaffMemo] = useState('');

  // 객실 제어 상태
  const [assignRoom, setAssignRoom] = useState('');
  const [moveRoom, setMoveRoom] = useState('');
  const [moveReason, setMoveReason] = useState('고객 시설 보상 업그레이드');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 예약 데이터가 갱신될 때마다 폼 상태 동기화
  const syncFormState = useCallback((data: ReservationDetailDto) => {
    setReservation(data);
    setOpGuestName(data.operationalGuestName || data.guestName || '');
    setOpCheckIn(data.operationalCheckInDate || data.checkInDate || '');
    setOpNights(data.operationalStayNights || data.stayNights || 1);
    setStaffMemo(data.internalStaffMemo || data.rawRequestText || '');
    setAssignRoom(data.assignedRoomNumber ? data.assignedRoomNumber.replace(/^0/, '') : '');
    setMoveRoom('');
  }, []);

  useEffect(() => {
    syncFormState(initialReservation);
  }, [initialReservation, syncFormState]);

  // [핵심] 조작 후 목록으로 튕기지 않고 현재 화면에서 서버 데이터를 즉각 새로고침
  const reloadCurrentReservation = async () => {
    try {
      const refreshed = await pmsService.getReservationDetail(reservation.reservationId);
      syncFormState(refreshed);
      onUpdated(); // 백그라운드 인디케이터 및 목록 동기화
    } catch {
      console.error('현재 예약 상세 재동기화 실패');
    }
  };

  // 1. 현장 운영 정보 저장 (화면 유지)
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
      alert('PMS 현장 정보가 수정되었습니다.');
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

  // 2. 입실 전 수동 호실 지정 (화면 유지)
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

  // 3. 배정 취소 (방 빼기 - 화면 유지)
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

  // 4. 재실 중 룸체인지 (화면 유지)
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

  // 5. 체크인 처리 (화면 유지)
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
      <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {/* 상단 네비게이션 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.9rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              <ArrowLeft size={16} /> 예약 목록으로
            </button>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
                {reservation.operationalGuestName || reservation.guestName} 고객 예약 마스터
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>예약번호: {reservation.reservationId}</span>
                <span style={{
                  fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700,
                  backgroundColor: reservation.status === 'CHECKED_IN' ? '#7f1d1d' : reservation.status === 'ASSIGNED' ? '#172554' : '#334155',
                  color: reservation.status === 'CHECKED_IN' ? '#fecaca' : reservation.status === 'ASSIGNED' ? '#93c5fd' : '#cbd5e1'
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
              <FileCode size={16} /> OTA 원천 계약 & 전문
            </button>
          </div>
        </div>

        {msg && (
            <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.9rem' }}>
              {msg}
            </div>
        )}

        {/* 탭 1: 현장 운영 및 객실 제어 (기본 작업 화면) */}
        {activeTab === 'OPERATIONAL' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.5rem' }}>
              {/* 좌측: 현장 투숙 정보 오버라이드 폼 */}
              <form onSubmit={handleSaveOperational} style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                  <User size={18} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>현장 투숙 정보 관리</h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                  실투숙자 성명, 일정, 메모를 수정합니다. 저장 즉시 상단 정보와 시스템에 반영됩니다.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px' }}>실투숙자 성명</label>
                  <input type="text" value={opGuestName} onChange={(e) => setOpGuestName(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px' }}>실제 체크인 일자</label>
                    <input type="date" value={opCheckIn} onChange={(e) => setOpCheckIn(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px' }}>실제 투숙 박수</label>
                    <input type="number" min="1" value={opNights} onChange={(e) => setOpNights(Number(e.target.value))} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px' }}>프론트 직원 인계 메모</label>
                  <textarea value={staffMemo} onChange={(e) => setStaffMemo(e.target.value)} rows={3} placeholder="특이사항 및 인계 메모 입력" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} />
                </div>

                <button type="submit" disabled={loading} style={{ padding: '0.75rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', marginTop: 'auto' }}>
                  현장 정보 저장 (즉시 반영)
                </button>
              </form>

              {/* 우측: 객실 배정 / 룸체인지 / 배정 취소 콘솔 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {/* 현재 객실 배정 현황 카드 */}
                <div style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: '#94a3b8' }}>현재 배정 객실:</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 700, color: reservation.assignedRoomNumber ? '#34d399' : '#f87171' }}>
                  {reservation.assignedRoomNumber ? `${reservation.assignedRoomNumber}호` : '미배정'}
                </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    계약 타입: <b>{reservation.bookedRoomType || reservation.roomType}</b>
                  </div>
                </div>

                {/* 입실 전 상태: 수동 배정 및 배정 취소 */}
                {reservation.status !== 'CHECKED_IN' && reservation.status !== 'CHECKED_OUT' && reservation.status !== 'CANCELLED' && (
                    <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <form onSubmit={handleManualAssign} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                          <KeyRound size={18} />
                          <h4 style={{ margin: 0, fontSize: '1rem' }}>수동 호실 지정 (3자리/4자리)</h4>
                        </div>
                        <input
                            type="text"
                            placeholder="예: 501 또는 0501"
                            value={assignRoom}
                            onChange={(e) => setAssignRoom(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
                            required
                        />
                        <button type="submit" disabled={loading} style={{ padding: '0.65rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                          {reservation.assignedRoomNumber ? '호실 재배정' : '신규 배정 확정'}
                        </button>
                      </form>

                      {/* 배정된 경우: 방 빼기(배정 취소) 버튼 */}
                      {reservation.assignedRoomNumber && (
                          <button
                              type="button"
                              onClick={handleUnassign}
                              disabled={loading}
                              style={{ padding: '0.6rem', backgroundColor: '#7f1d1d', color: '#fecaca', border: '1px solid #b91c1c', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            <UserX size={16} /> 배정 취소 (방 빼기)
                          </button>
                      )}

                      {/* 배정 완료 건 즉시 체크인 버튼 */}
                      {reservation.status === 'ASSIGNED' && (
                          <button
                              type="button"
                              onClick={handleCheckIn}
                              disabled={loading}
                              style={{ padding: '0.75rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            <CheckCircle2 size={16} /> 당일 체크인 완료
                          </button>
                      )}
                    </div>
                )}

                {/* 재실 상태: 룸 체인지 콘솔 */}
                {reservation.status === 'CHECKED_IN' && (
                    <form onSubmit={handleRoomMove} style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                        <ArrowRightLeft size={18} />
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>재실 고객 룸 체인지 (3자리/4자리)</h4>
                      </div>
                      <input type="text" placeholder="이전할 새 호실 (예: 1404, 502)" value={moveRoom} onChange={(e) => setMoveRoom(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                      <input type="text" placeholder="변경 사유 (예: 업그레이드, 시설 불편)" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} />
                      <button type="submit" disabled={loading} style={{ padding: '0.65rem', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                        오늘({businessDate}) 기준 룸 체인지 실행
                      </button>
                    </form>
                )}
              </div>
            </div>
        )}

        {/* 탭 2: OTA 원천 계약 및 전문 보기 */}
        {activeTab === 'CONTRACT_AUDIT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155' }}>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', color: '#f59e0b' }}>🔒 OTA 원천 계약 스냅샷 (Audit Ledger)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.9rem', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
                  <div>원 계약자명: <b>{reservation.originalGuestName || reservation.guestName}</b></div>
                  <div>계약 룸타입: <b style={{ color: '#38bdf8' }}>{reservation.bookedRoomType || reservation.roomType}</b></div>
                  <div>계약 체크인: <b>{reservation.contractCheckInDate || reservation.checkInDate}</b></div>
                  <div>계약 숙박일수: <b>{reservation.contractStayNights || reservation.stayNights}박</b></div>
                </div>
                <div style={{ marginTop: '10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  인입 원문 요청: {reservation.rawRequestText || '(없음)'}
                </div>
              </div>

              <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '0.5rem' }}>
                  <ShieldAlert size={20} />
                  <h4 style={{ margin: 0 }}>외부 CMS 수신 원본 XML 전문</h4>
                </div>
                <pre style={{ backgroundColor: '#090d16', padding: '1.2rem', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.85rem', color: '#38bdf8', overflowX: 'auto', border: '1px solid #334155' }}>
              {reservation.rawXmlPayload || `<!-- TL-Lincoln Inbound Payload (Audit Trail) -->
<Reservation>
  <ReservationId>${reservation.reservationId}</ReservationId>
  <OriginalGuestName>${reservation.originalGuestName || reservation.guestName}</OriginalGuestName>
  <ContractRoomType>${reservation.bookedRoomType || reservation.roomType}</ContractRoomType>
  <ContractCheckInDate>${reservation.contractCheckInDate || reservation.checkInDate}</ContractCheckInDate>
  <ContractStayNights>${reservation.contractStayNights || reservation.stayNights}</ContractStayNights>
  <SpecialRequest>${reservation.rawRequestText || 'None'}</SpecialRequest>
</Reservation>`}
            </pre>
              </div>
            </div>
        )}
      </div>
  );
}