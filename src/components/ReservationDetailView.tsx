import { useState } from 'react';
import type { SubmitEvent } from 'react';
import type { ReservationDetailDto } from '../api/pmsService';
import { pmsService } from '../api/pmsService';
import {
  ArrowLeft, CheckCircle2, ArrowRightLeft, FileCode, User, Calendar, ShieldCheck
} from 'lucide-react';

interface Props {
  reservation: ReservationDetailDto;
  businessDate: string; // 호텔 공식 영업 일자
  onBack: () => void;
  onUpdated: () => void;
}

export default function ReservationDetailView({ reservation, businessDate, onBack, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'ACTION' | 'RAW_DATA'>('ACTION');
  const [targetRoom, setTargetRoom] = useState('');
  const [reason, setReason] = useState('고객 시설 불편으로 인한 업그레이드');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 체크인 실행
  const handleCheckIn = async () => {
    if (!confirm(`[${reservation.guestName}] 고객님을 체크인 처리하시겠습니까?`)) return;
    setLoading(true);
    try {
      await pmsService.checkIn(reservation.reservationId);
      alert('체크인이 정상 완료되었습니다.');
      onUpdated();
      onBack();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || '체크인 처리 실패');
      } else {
        alert('체크인 처리 중 통신 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 룸 체인지 실행 (업그레이드/다운그레이드 포함)
  const handleRoomMove = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!targetRoom.trim()) {
      alert('이동할 호실 번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      // 영업일자(businessDate) 기준으로 당일 잔여 박수 분할 이동 실행
      await pmsService.changeRoom(reservation.reservationId, targetRoom.trim(), reason, businessDate);
      alert(`[룸 체인지 완료] ${reservation.assignedRoomNumber || '미배정'}호 -> ${targetRoom}호로 성공적으로 이전되었습니다.`);
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

  // OTA 원본 XML 데이터 (불변 감사 원장)
  const rawXmlView = `<?xml version="1.0" encoding="UTF-8"?>
<!-- TL-Lincoln & OTA Inbound Payload (Audit Trail) -->
<ReservationData>
  <BookingIdentifier>
    <PmsReservationId>${reservation.reservationId}</PmsReservationId>
    <ChannelReservationNo>${reservation.channelInfo?.channelReservationNo || 'TLX-OTA-DIRECT'}</ChannelReservationNo>
    <ChannelType>${reservation.channelInfo?.channelType || 'DIRECT'}</ChannelType>
  </BookingIdentifier>
  <GuestProfile>
    <GuestName>${reservation.guestName}</GuestName>
    <ContractRoomType>${reservation.roomType || reservation.bookedRoomType || 'MODERATE_DOUBLE'}</ContractRoomType>
  </GuestProfile>
  <StaySchedule>
    <CheckInDate>${reservation.checkInDate}</CheckInDate>
    <StayNights>${reservation.stayNights}</StayNights>
    <SpecialNotes>${reservation.rawRequestText || reservation.specialRequests || 'None'}</SpecialNotes>
  </StaySchedule>
  <RatePlanInfo>
    <PlanName>${reservation.channelInfo?.planName || 'Standard Hotel Plan'}</PlanName>
  </RatePlanInfo>
</ReservationData>`;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 상단 네비게이션 & 타이틀 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.9rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            <ArrowLeft size={16} /> 목록으로 돌아가기
          </button>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>고객 상세 및 룸체인지 관리</h2>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>예약번호: {reservation.reservationId}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('ACTION')}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'ACTION' ? '#0284c7' : '#1e293b', color: '#fff', fontWeight: 600 }}
          >
            프론트 운영 조작
          </button>
          <button
            onClick={() => setActiveTab('RAW_DATA')}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'RAW_DATA' ? '#0284c7' : '#1e293b', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileCode size={16} /> OTA 원본 전문 (TLX)
          </button>
        </div>
      </div>

      {/* 탭 1: 운영 조작 워크스페이스 */}
      {activeTab === 'ACTION' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* 좌측: 고객 계약 및 현재 투숙 정보 카드 */}
          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} /> 투숙객 계약 원장 정보
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
              <div>고객명: <b>{reservation.guestName}</b></div>
              <div>현재 상태: <b style={{ color: reservation.status === 'CHECKED_IN' ? '#f87171' : '#38bdf8' }}>{reservation.status === 'CHECKED_IN' ? '재실 투숙중 (In-House)' : reservation.status}</b></div>
              <div>계약 객실 타입: <b>{reservation.roomType || reservation.bookedRoomType}</b></div>
              <div>현재 배정 객실: <b style={{ color: '#34d399', fontSize: '1.1rem' }}>{reservation.assignedRoomNumber ? `${reservation.assignedRoomNumber}호` : '미배정'}</b></div>
              <div>체류 일정: {reservation.checkInDate} ({reservation.stayNights}박)</div>
              <div style={{ color: '#cbd5e1', marginTop: '6px', borderTop: '1px solid #334155', paddingTop: '6px' }}>
                인입 요청 메모: {reservation.rawRequestText || reservation.specialRequests || '(특이사항 없음)'}
              </div>
            </div>

            {/* 체크인 대기 건 입실 버튼 */}
            {reservation.status === 'ASSIGNED' && (
              <div style={{ backgroundColor: '#064e3b', padding: '1rem', borderRadius: '8px', border: '1px solid #059669' }}>
                <p style={{ fontSize: '0.85rem', margin: '0 0 10px 0' }}>고객이 프론트에 도착했습니다. 키를 교부하고 입실 처리합니다.</p>
                <button
                  onClick={handleCheckIn}
                  disabled={loading}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={18} /> 당일 체크인 완료 처리
                </button>
              </div>
            )}
          </div>

          {/* 우측: 룸 체인지 실행 콘솔 (타입 업그레이드/다운그레이드 지원) */}
          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={18} /> 룸 체인지 센터 (Room Move)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
              동급 객실 이동뿐만 아니라 <b>상위/하위 룸타입(업그레이드/다운그레이드)으로의 이동도 전면 허용</b>됩니다. 계약 룸타입 원본은 보존되며 실물 룸 랙 스케줄만 오늘 영업일자({businessDate}) 기준으로 안전하게 분할 이전됩니다.
            </p>

            {msg && (
              <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {msg}
              </div>
            )}

            {reservation.status === 'CHECKED_IN' ? (
              <form onSubmit={handleRoomMove} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    이전할 새 객실 번호 (공실 VACANT 상태의 4자리 호실)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 1404 (이그제큐티브 업그레이드), 0502 등"
                    value={targetRoom}
                    onChange={(e) => setTargetRoom(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    변경 사유 (사유 기록 및 감사 추적)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '0.85rem', borderRadius: '6px', backgroundColor: '#d97706', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <ArrowRightLeft size={18} /> {loading ? '처리 중...' : `오늘(${businessDate}) 기준 룸 체인지 실행`}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                현재 투숙 중(CHECKED_IN)인 고객만 룸 체인지가 가능합니다. 체크인 전 고객은 룸 인디케이터에서 재배정해 주세요.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 탭 2: 원본 전문 뷰어 (TLX 불변 원장) */}
      {activeTab === 'RAW_DATA' && (
        <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: '#38bdf8' }}>
            <ShieldCheck size={20} />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>외부 채널 매니저(CMS) 원천 수신 전문</h3>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
            객실 변경이나 프론트 조작과 무관하게 계약 당시 인입된 불변 원본 XML 전문입니다. 회계 및 감사 시 원형 그대로 열람됩니다.
          </p>
          <pre style={{
            backgroundColor: '#090d16', padding: '1.2rem', borderRadius: '8px',
            fontFamily: 'monospace', fontSize: '0.85rem', color: '#38bdf8', overflowX: 'auto',
            border: '1px solid #334155', lineHeight: '1.5'
          }}>
            {rawXmlView}
          </pre>
        </div>
      )}
    </div>
  );
}