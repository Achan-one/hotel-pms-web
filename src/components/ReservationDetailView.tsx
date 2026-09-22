import { useState } from 'react';
import type { SubmitEvent } from 'react';
import type { ReservationDetailDto } from '../api/pmsService';
import { pmsService } from '../api/pmsService';
import {
  ArrowLeft, CheckCircle2, ArrowRightLeft, FileCode, User, ShieldAlert, KeyRound, Lock
} from 'lucide-react';

interface Props {
  reservation: ReservationDetailDto;
  businessDate: string;
  onBack: () => void;
  onUpdated: () => void;
}

export default function ReservationDetailView({ reservation, businessDate, onBack, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'OVERRIDE' | 'RAW_XML'>('OVERRIDE');

  // 현장 운영 수정 폼 상태
  const [opGuestName, setOpGuestName] = useState(reservation.operationalGuestName || reservation.guestName);
  const [opCheckIn, setOpCheckIn] = useState(reservation.operationalCheckInDate || reservation.checkInDate);
  const [opNights, setOpNights] = useState(reservation.operationalStayNights || reservation.stayNights);
  const [staffMemo, setStaffMemo] = useState(reservation.internalStaffMemo || reservation.rawRequestText || '');

  // 객실 제어
  const [assignRoom, setAssignRoom] = useState(reservation.assignedRoomNumber || '');
  const [moveRoom, setMoveRoom] = useState('');
  const [moveReason, setMoveReason] = useState('고객 요청 업그레이드');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 1. 현장 운영 오버라이드 저장 (원본 계약은 절대 건드리지 않음)
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
      alert('PMS 현장 운영 정보가 갱신되었습니다. (OTA 원천 계약은 안전하게 보존됩니다)');
      onUpdated();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string }; status?: number } };
        const serverMsg = axiosErr.response?.data?.message || `서버 오류 (HTTP ${axiosErr.response?.status})`;
        setMsg(serverMsg);
        alert(serverMsg);
      } else {
        const fallbackMsg = '통신 중 네트워크 오류가 발생했습니다.';
        setMsg(fallbackMsg);
        alert(fallbackMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. 입실 전 수동 호실 지정 (업그레이드 가능)
  const handleManualAssign = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!assignRoom.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.manualAssign(reservation.reservationId, assignRoom.trim());
      alert(`성공적으로 [${assignRoom}]호로 객실이 지정되었습니다.`);
      onUpdated();
      onBack();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '객실 배정 실패');
      } else {
        setMsg('객실 배정 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. 재실 중 룸체인지
  const handleRoomMove = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!moveRoom.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.changeRoom(reservation.reservationId, moveRoom.trim(), moveReason, businessDate);
      alert(`[룸 체인지 완료] ${reservation.assignedRoomNumber}호 -> ${moveRoom}호로 이전되었습니다.`);
      onUpdated();
      onBack();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '룸 체인지 실패');
      } else {
        setMsg('룸 체인지 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* 상단 네비게이션 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.9rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              <ArrowLeft size={16} /> 예약 검색 목록
            </button>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>예약 관리 마스터: {reservation.guestName}</h2>
              <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>예약번호: {reservation.reservationId} (상태: {reservation.status})</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setActiveTab('OVERRIDE')} style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'OVERRIDE' ? '#0284c7' : '#1e293b', color: '#fff', fontWeight: 600 }}>
              운영 & 배정 콘솔
            </button>
            <button onClick={() => setActiveTab('RAW_XML')} style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'RAW_XML' ? '#0284c7' : '#1e293b', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileCode size={16} /> TLX 인입 원본 전문
            </button>
          </div>
        </div>

        {msg && (
            <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.9rem' }}>
              {msg}
            </div>
        )}

        {activeTab === 'OVERRIDE' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* 좌측: [불변] OTA 원천 계약 원장 */}
              <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
                  <Lock size={18} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>OTA 원천 계약 (수정 불가 불변 원장)</h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                  TL-Lincoln 등 외부 채널에서 인입된 정산용 불변 데이터입니다. 현장 조작으로 절대 훼손되지 않습니다.
                </p>

                <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  <div>원 계약자명: <b>{reservation.originalGuestName || reservation.guestName}</b></div>
                  <div>계약 객실타입: <b style={{ color: '#38bdf8' }}>{reservation.bookedRoomType || reservation.roomType}</b></div>
                  <div>계약 체크인: <b>{reservation.contractCheckInDate || reservation.checkInDate}</b></div>
                  <div>계약 숙박일수: <b>{reservation.contractStayNights || reservation.stayNights}박</b></div>
                  <div style={{ borderTop: '1px solid #334155', paddingTop: '6px', color: '#cbd5e1' }}>
                    인입 요청 메모: {reservation.rawRequestText || '(없음)'}
                  </div>
                </div>

                {/* 입실 대기(ASSIGNED) 건 즉시 체크인 버튼 */}
                {reservation.status === 'ASSIGNED' && (
                    <div style={{ backgroundColor: '#064e3b', padding: '1rem', borderRadius: '8px', border: '1px solid #059669', marginTop: 'auto' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem' }}>배정된 {reservation.assignedRoomNumber}호로 입실 처리합니다.</p>
                      <button
                          onClick={async () => {
                            if (!confirm('체크인 처리하시겠습니까?')) return;
                            await pmsService.checkIn(reservation.reservationId);
                            alert('체크인 완료');
                            onUpdated();
                            onBack();
                          }}
                          style={{ width: '100%', padding: '0.7rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <CheckCircle2 size={16} /> 당일 체크인 완료
                      </button>
                    </div>
                )}
              </div>

              {/* 우측: [가변] PMS 현장 운영 오버라이드 & 객실 변경 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                {/* 1. 운영 정보 오버라이드 폼 */}
                <form onSubmit={handleSaveOperational} style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                    <User size={18} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>PMS 현장 운영 상태 (오버라이드)</h3>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 6px 0' }}>
                    실제 현장 투숙객명 정정, 숙박 연장, 프론트 인계사항을 등록합니다.
                  </p>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '2px' }}>현장 실투숙자명</label>
                    <input type="text" value={opGuestName} onChange={(e) => setOpGuestName(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '2px' }}>실제 체크인 일자</label>
                      <input type="date" value={opCheckIn} onChange={(e) => setOpCheckIn(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '2px' }}>실제 숙박 박수</label>
                      <input type="number" min="1" value={opNights} onChange={(e) => setOpNights(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '2px' }}>프론트 내부 인계 메모</label>
                    <textarea value={staffMemo} onChange={(e) => setStaffMemo(e.target.value)} rows={2} placeholder="예: 현장 얼리 체크인 승인 건" style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} />
                  </div>

                  <button type="submit" disabled={loading} style={{ padding: '0.65rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                    현장 운영 정보 저장 (계약 원본 보존)
                  </button>
                </form>

                {/* 2. 객실 제어 콘솔 (수동 배정 or 재실 룸체인지) */}
                <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155' }}>
                  {reservation.status !== 'CHECKED_IN' ? (
                      <form onSubmit={handleManualAssign} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
                          <KeyRound size={18} />
                          <h4 style={{ margin: 0, fontSize: '1rem' }}>입실 전 수동 호실 지정 (업그레이드 가능)</h4>
                        </div>
                        <input type="text" placeholder="배정 호실 (예: 1404)" value={assignRoom} onChange={(e) => setAssignRoom(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                        <button type="submit" disabled={loading} style={{ padding: '0.6rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                          {reservation.assignedRoomNumber ? '배정 객실 변경(재배정)' : '신규 객실 확정 배정'}
                        </button>
                      </form>
                  ) : (
                      <form onSubmit={handleRoomMove} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                          <ArrowRightLeft size={18} />
                          <h4 style={{ margin: 0, fontSize: '1rem' }}>재실 고객 룸 체인지 (이종 타입 이전 가능)</h4>
                        </div>
                        <input type="text" placeholder="이전할 새 호실 (예: 1502)" value={moveRoom} onChange={(e) => setMoveRoom(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                        <input type="text" placeholder="변경 사유" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} />
                        <button type="submit" disabled={loading} style={{ padding: '0.6rem', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                          오늘({businessDate}) 기준 룸 체인지 실행
                        </button>
                      </form>
                  )}
                </div>
              </div>
            </div>
        )}

        {/* 탭 2: 원본 XML 뷰어 */}
        {activeTab === 'RAW_XML' && (
            <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', marginBottom: '0.5rem' }}>
                <ShieldAlert size={20} />
                <h3 style={{ margin: 0 }}>외부 CMS(린칸/ONDA) 수신 원천 XML 전문</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                계약 시점에 전송된 불변 원장 전문입니다. 현장에서 이름이나 일정을 수정하더라도 이 전문은 절대로 바뀌지 않습니다.
              </p>
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
        )}
      </div>
  );
}