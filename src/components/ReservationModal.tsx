import { useState } from 'react';
import type { SubmitEvent } from 'react';
import type { ReservationDetailDto } from '../api/pmsService';
import { pmsService } from '../api/pmsService';
import { X, CheckCircle2, ArrowRightLeft, FileCode } from 'lucide-react';

interface Props {
    reservation: ReservationDetailDto;
    onClose: () => void;
    onUpdated: () => void;
}

export default function ReservationModal({ reservation, onClose, onUpdated }: Props) {
    const [activeSubTab, setActiveSubTab] = useState<'ACTION' | 'RAW_DATA'>('ACTION');
    const [targetRoom, setTargetRoom] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    // 체크인 실행
    const handleCheckIn = async () => {
        if (!confirm(`[${reservation.guestName}] 고객님을 체크인 처리하시겠습니까?`)) return;
        setLoading(true);
        try {
            await pmsService.checkIn(reservation.reservationId);
            alert('체크인이 완료되었습니다.');
            onUpdated();
            onClose();
        } catch (err: unknown) {
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosErr = err as { response?: { data?: { message?: string } } };
                alert(axiosErr.response?.data?.message || '체크인 처리 실패');
            } else {
                alert('체크인 처리 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    // 룸 체인지 실행
    const handleRoomMove = async (e: SubmitEvent) => {
        e.preventDefault();
        if (!targetRoom.trim()) {
            alert('이동할 호실 번호를 입력해주세요.');
            return;
        }
        setLoading(true);
        setMsg('');
        try {
            await pmsService.changeRoom(reservation.reservationId, targetRoom.trim(), reason || '프론트 데스크 요청');
            alert(`성공적으로 ${targetRoom}호로 룸 체인지 되었습니다.`);
            onUpdated();
            onClose();
        } catch (err: unknown) {
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosErr = err as { response?: { data?: { message?: string } } };
                setMsg(axiosErr.response?.data?.message || '룸 체인지 실패');
            } else {
                setMsg('룸 체인지 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    // OTA/린칸 가상 원본 전문 (실제 PMS 감사용)
    const rawXmlView = `<!-- TL-Lincoln Raw Inbound Payload -->
<Reservation>
  <ReservationId>${reservation.reservationId}</ReservationId>
  <GuestName>${reservation.guestName}</GuestName>
  <BookedType>${reservation.roomType || reservation.bookedRoomType || 'MODERATE_DOUBLE'}</BookedType>
  <CheckInDate>${reservation.checkInDate}</CheckInDate>
  <StayNights>${reservation.stayNights}</StayNights>
  <SpecialRequest>${reservation.rawRequestText || reservation.specialRequests || 'None'}</SpecialRequest>
  <ChannelPlan>${reservation.channelInfo?.planName || 'Standard OTA Plan'}</ChannelPlan>
</Reservation>`;

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#1e293b', width: '650px', maxHeight: '90vh', borderRadius: '12px',
                border: '1px solid #334155', padding: '1.5rem', display: 'flex', flexDirection: 'column', color: '#f8fafc'
            }}>
                {/* 모달 상단 헤더 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
                    <div>
                        <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>{reservation.reservationId}</span>
                        <h3 style={{ margin: '4px 0 0 0', fontSize: '1.3rem' }}>{reservation.guestName} 고객 관리</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={22} />
                    </button>
                </div>

                {/* 서브 탭: 운영 조작 vs 원본 TLX 전문 */}
                <div style={{ display: 'flex', gap: '8px', margin: '1rem 0' }}>
                    <button
                        onClick={() => setActiveSubTab('ACTION')}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            backgroundColor: activeSubTab === 'ACTION' ? '#0284c7' : '#0f172a', color: '#fff', fontWeight: 600
                        }}
                    >
                        프론트 운영 조작
                    </button>
                    <button
                        onClick={() => setActiveSubTab('RAW_DATA')}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            backgroundColor: activeSubTab === 'RAW_DATA' ? '#0284c7' : '#0f172a', color: '#fff', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <FileCode size={15} /> 인입 전문 원본 (TLX/OTA)
                    </button>
                </div>

                {/* 탭 1: 운영 조작 */}
                {activeSubTab === 'ACTION' && (
                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* 기본 예약 요약 카드 */}
                        <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', fontSize: '0.9rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>상태: <b style={{ color: '#38bdf8' }}>{reservation.status}</b></div>
                                <div>배정 객실: <b style={{ color: '#34d399' }}>{reservation.assignedRoomNumber ? `${reservation.assignedRoomNumber}호` : '미배정'}</b></div>
                                <div>객실 타입: {reservation.roomType || reservation.bookedRoomType}</div>
                                <div>체크인: {reservation.checkInDate} ({reservation.stayNights}박)</div>
                            </div>
                            <div style={{ marginTop: '8px', color: '#cbd5e1' }}>
                                고객 요청사항: {reservation.rawRequestText || reservation.specialRequests || '(없음)'}
                            </div>
                        </div>

                        {/* 체크인 버튼 (ASSIGNED 상태일 때) */}
                        {reservation.status === 'ASSIGNED' && (
                            <div style={{ padding: '1rem', backgroundColor: '#064e3b', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>배정된 객실({reservation.assignedRoomNumber}호)에 입실 처리합니다.</span>
                                <button
                                    onClick={handleCheckIn}
                                    disabled={loading}
                                    style={{ padding: '0.6rem 1.2rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <CheckCircle2 size={18} /> 즉시 체크인
                                </button>
                            </div>
                        )}

                        {/* 룸 체인지 폼 (CHECKED_IN 재실 상태일 때) */}
                        {reservation.status === 'CHECKED_IN' && (
                            <form onSubmit={handleRoomMove} style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                                <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
                                    <ArrowRightLeft size={18} /> 재실 고객 룸 체인지 (Room Move)
                                </h4>
                                {msg && <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '8px' }}>{msg}</div>}
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>새 배정 호실</label>
                                    <input
                                        type="text"
                                        placeholder="예: 0502 (4자리)"
                                        value={targetRoom}
                                        onChange={(e) => setTargetRoom(e.target.value)}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
                                        required
                                    />
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>변경 사유</label>
                                    <input
                                        type="text"
                                        placeholder="예: 에어컨 소음 민원"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{ width: '100%', padding: '0.7rem', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    {loading ? '처리 중...' : '룸 체인지 실행'}
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* 탭 2: 원본 전문 뷰어 */}
                {activeSubTab === 'RAW_DATA' && (
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 8px 0' }}>
                            OTA(린칸) 인입 시 전송된 불변 원천 데이터입니다. (감사용)
                        </p>
                        <pre style={{
                            backgroundColor: '#090d16', padding: '1rem', borderRadius: '6px',
                            fontFamily: 'monospace', fontSize: '0.85rem', color: '#38bdf8', overflowX: 'auto',
                            border: '1px solid #334155'
                        }}>
              {rawXmlView}
            </pre>
                    </div>
                )}
            </div>
        </div>
    );
}