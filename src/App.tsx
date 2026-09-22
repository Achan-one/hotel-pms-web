import { useState, useEffect } from 'react';
import type { SubmitEvent } from 'react';
import { pmsService } from './api/pmsService';
import type { ReservationDetailDto } from './api/pmsService';
import type { FloorMapResponseDto, LoginResponse, RoomMatrixItemDto } from './types/pms';
import Sidebar, { type TabType } from './components/Sidebar';
import {
  LogIn, RefreshCw, Calendar, CheckCircle2, DoorClosed, Hotel, Sparkles
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<LoginResponse | null>(() => {
    const saved = localStorage.getItem('hotel_pms_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<TabType>('INDICATOR');
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // 룸 인디케이터 상태
  const [indicatorData, setIndicatorData] = useState<FloorMapResponseDto | null>(null);
  const [indicatorLoading, setIndicatorLoading] = useState(false);
  const [targetDate, setTargetDate] = useState('2026-09-20');

  // 예약 검색 상태
  const [searchGuestName, setSearchGuestName] = useState('');
  const [reservationList, setReservationList] = useState<ReservationDetailDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // 룸 체인지 상태
  const [moveReservationId, setMoveReservationId] = useState('');
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [moveMessage, setMoveMessage] = useState('');

  // 1. 로그인
  const handleLogin = async (e: SubmitEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const data = await pmsService.login(staffId, password);
      localStorage.setItem('hotel_pms_token', data.token);
      localStorage.setItem('hotel_pms_user', JSON.stringify(data));
      setCurrentUser(data);
      setActiveTab('INDICATOR');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setLoginError(axiosErr.response?.data?.message || '로그인에 실패했습니다.');
      } else {
        setLoginError('로그인 통신 중 오류가 발생했습니다.');
      }
    }
  };

  // 2. 로그아웃
  const handleLogout = () => {
    localStorage.removeItem('hotel_pms_token');
    localStorage.removeItem('hotel_pms_user');
    setCurrentUser(null);
    setIndicatorData(null);
  };

  // 3. 인디케이터 로드
  const fetchIndicator = async () => {
    if (!currentUser) return;
    setIndicatorLoading(true);
    try {
      const data = await pmsService.getRoomIndicator(targetDate);
      setIndicatorData(data);
    } catch (err) {
      console.error('인디케이터 로드 실패:', err);
    } finally {
      setIndicatorLoading(false);
    }
  };

  // 4. 예약 검색
  const handleSearchReservations = async () => {
    setSearchLoading(true);
    try {
      const list = await pmsService.getReservations({
        guestName: searchGuestName || undefined,
        targetDate: targetDate || undefined
      });
      setReservationList(list);
    } catch (err) {
      console.error('예약 검색 실패:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // 5. 체크인
  const handleCheckIn = async (resId: string) => {
    if (!confirm(`예약번호 [${resId}]를 체크인 처리하시겠습니까?`)) return;
    try {
      await pmsService.checkIn(resId);
      alert('체크인이 정상 완료되었습니다.');
      await handleSearchReservations();
      if (indicatorData) void fetchIndicator();
    } catch (err: any) {
      alert(err.response?.data?.message || '체크인 실패');
    }
  };

  // 6. 룸 체인지
  const handleRoomMoveSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setMoveMessage('');
    try {
      await pmsService.changeRoom(moveReservationId, newRoomNumber, moveReason);
      setMoveMessage(`✅ 객실 변경 성공: ${moveReservationId} -> ${newRoomNumber}호 이전 완료`);
      setMoveReservationId('');
      setNewRoomNumber('');
      setMoveReason('');
      if (indicatorData) void fetchIndicator();
    } catch (err: any) {
      setMoveMessage(`❌ 객실 변경 실패: ${err.response?.data?.message || '오류 발생'}`);
    }
  };

  // 7. 자동 일괄 배정
  const handleBatchAssign = async () => {
    if (!confirm(`${targetDate} 일자의 미배정 예약을 규칙 기반으로 일괄 자동 배정하시겠습니까?`)) return;
    try {
      await pmsService.runBatchAssign(targetDate);
      alert('자동 일괄 배정이 완료되었습니다.');
      void fetchIndicator();
    } catch (err: any) {
      alert(err.response?.data?.message || '일괄 배정 실패');
    }
  };

  useEffect(() => {
    if (currentUser && activeTab === 'INDICATOR') {
      void fetchIndicator();
    }
    if (currentUser && activeTab === 'RESERVATIONS') {
      void handleSearchReservations();
    }
  }, [currentUser, activeTab, targetDate]);

  const getStatusColor = (status: RoomMatrixItemDto['status']) => {
    switch (status) {
      case 'OCCUPIED': return { backgroundColor: '#450a0a', borderColor: '#b91c1c', badge: '#ef4444' };
      case 'ASSIGNED': return { backgroundColor: '#172554', borderColor: '#1d4ed8', badge: '#3b82f6' };
      case 'OUT': return { backgroundColor: '#451a03', borderColor: '#d97706', badge: '#f59e0b' };
      case 'CLEANING': return { backgroundColor: '#083344', borderColor: '#0891b2', badge: '#06b6d4' };
      case 'BREAK': return { backgroundColor: '#27272a', borderColor: '#71717a', badge: '#a1a1aa' };
      case 'BLOCKED': return { backgroundColor: '#3b0764', borderColor: '#9333ea', badge: '#a855f7' };
      case 'VACANT':
      default: return { backgroundColor: '#064e3b', borderColor: '#059669', badge: '#10b981' };
    }
  };

  // 로그인 화면
  if (!currentUser) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
          <form onSubmit={handleLogin} style={{ backgroundColor: '#1e293b', padding: '2.5rem', borderRadius: '12px', width: '380px', color: '#f8fafc', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
              <Hotel size={32} color="#38bdf8" />
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>HOTEL PMS</h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>프론트 데스크 운영 시스템 로그인</p>
            {loginError && <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>{loginError}</div>}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>직원 ID</label>
              <input type="text" value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="예: staff" style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="hotel1234" style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
            </div>
            <button type="submit" style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <LogIn size={18} /> 로그인
            </button>
          </form>
        </div>
    );
  }

  // 좌측 사이드바 + 우측 조작 화면
  return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b1329', color: '#f1f5f9' }}>
        {/* 1. 좌측 사이드바 */}
        <Sidebar
            currentUser={currentUser}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onLogout={handleLogout}
        />

        {/* 2. 우측 메인 조작 워크스페이스 */}
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          {/* 탭 1: 룸 인디케이터 */}
          {activeTab === 'INDICATOR' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 4px 0' }}>191실 룸 인디케이터</h2>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>층별 객실 현황 매트릭스 및 실시간 점유율</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Calendar size={18} color="#38bdf8" />
                    <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }} />
                    <button onClick={() => void fetchIndicator()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.8rem', borderRadius: '6px', backgroundColor: '#0369a1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      <RefreshCw size={16} className={indicatorLoading ? 'spin' : ''} /> 새로고침
                    </button>
                  </div>
                </div>

                {indicatorData && (
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', backgroundColor: '#1e293b', padding: '0.8rem 1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #334155' }}>
                      <span>총 객실: <b>{indicatorData.totalRooms}실</b></span>
                      <span style={{ color: '#f87171' }}>점유: <b>{indicatorData.occupiedRooms}실</b></span>
                      <span style={{ color: '#34d399' }}>공실: <b>{indicatorData.vacantRooms}실</b></span>
                      <span style={{ color: '#38bdf8' }}>점유율: <b>{indicatorData.occupancyRatePercent}%</b></span>
                    </div>
                )}

                {indicatorData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {Object.entries(indicatorData.floorRooms).sort(([a], [b]) => Number(b) - Number(a)).map(([floor, rooms]) => (
                          <div key={floor} style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#94a3b8' }}>{floor}F ({rooms.length}실)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                              {rooms.map((room) => {
                                const c = getStatusColor(room.status);
                                return (
                                    <div key={room.roomNumber} style={{ padding: '0.6rem', borderRadius: '6px', border: `1px solid ${c.borderColor}`, backgroundColor: c.backgroundColor, minHeight: '75px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{room.roomNumber}</span>
                                        <span style={{ fontSize: '0.6rem', padding: '2px 4px', borderRadius: '4px', backgroundColor: '#0f172a', color: c.badge }}>{room.status}</span>
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>{room.roomTypeName}</div>
                                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.guestName || '-'}</div>
                                    </div>
                                );
                              })}
                            </div>
                          </div>
                      ))}
                    </div>
                )}
              </div>
          )}

          {/* 탭 2: 예약 관리 & 체크인 */}
          {activeTab === 'RESERVATIONS' && (
              <div style={{ maxWidth: '900px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>예약 조회 & 체크인 관리</h2>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                  <input type="text" placeholder="투숙객명 검색 (예: Tanaka, Kim)" value={searchGuestName} onChange={(e) => setSearchGuestName(e.target.value)} style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }} />
                  <button onClick={handleSearchReservations} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                    {searchLoading ? '조회 중...' : '검색'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {reservationList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', backgroundColor: '#1e293b', borderRadius: '8px' }}>
                        해당 일자 및 검색 조건의 예약 내역이 없습니다.
                      </div>
                  ) : (
                      reservationList.map((res) => (
                          <div key={res.reservationId} style={{ backgroundColor: '#1e293b', padding: '1rem 1.5rem', borderRadius: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{res.guestName}</span>
                                <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#334155', color: '#38bdf8' }}>{res.reservationId}</span>
                                <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#0f172a' }}>{res.status}</span>
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                {res.roomTypeName} | 체크인: {res.checkInDate} ({res.stayNights}박) | 배정호실: <b style={{ color: '#fff' }}>{res.assignedRoomNumber ? `${res.assignedRoomNumber}호` : '미배정'}</b>
                              </div>
                            </div>
                            <div>
                              {res.status === 'ASSIGNED' && (
                                  <button onClick={() => handleCheckIn(res.reservationId)} style={{ padding: '0.5rem 1rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CheckCircle2 size={16} /> 체크인
                                  </button>
                              )}
                            </div>
                          </div>
                      ))
                  )}
                </div>
              </div>
          )}

          {/* 탭 3: 룸 체인지 */}
          {activeTab === 'ROOM_MOVE' && (
              <div style={{ maxWidth: '540px', backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                  <DoorClosed size={28} color="#fbbf24" />
                  <h2 style={{ margin: 0, fontSize: '1.3rem' }}>재실 고객 룸 체인지 (Room Move)</h2>
                </div>

                {moveMessage && (
                    <div style={{ padding: '0.8rem', borderRadius: '6px', marginBottom: '1.5rem', backgroundColor: moveMessage.includes('성공') ? '#064e3b' : '#7f1d1d', color: '#fff', fontSize: '0.9rem' }}>
                      {moveMessage}
                    </div>
                )}

                <form onSubmit={handleRoomMoveSubmit}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>예약 번호</label>
                    <input type="text" placeholder="예: RSV-IND-01" value={moveReservationId} onChange={(e) => setMoveReservationId(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>새 배정 호실</label>
                    <input type="text" placeholder="예: 0502" value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>변경 사유</label>
                    <textarea placeholder="예: 에어컨 소음 민원으로 인한 이전" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} rows={3} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
                  </div>

                  <button type="submit" style={{ width: '100%', padding: '0.85rem', borderRadius: '6px', backgroundColor: '#d97706', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                    룸 체인지 실행
                  </button>
                </form>
              </div>
          )}

          {/* 탭 4: AI 당일 일괄 배정 */}
          {activeTab === 'BATCH_ASSIGN' && (
              <div style={{ maxWidth: '600px', backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                  <Sparkles size={28} color="#c084fc" />
                  <h2 style={{ margin: 0, fontSize: '1.3rem' }}>규칙 기반 AI 일괄 배정</h2>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  선택한 체크인 일자의 미배정 예약 전체를 대상으로 고층 선호, 엘리베이터 인접 선호 등 고객 태그 가중치와 연박 보호 규칙을 계산하여 빈 객실을 최적 배정합니다.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>대상 체크인 일자:</label>
                  <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }} />
                </div>
                <button onClick={handleBatchAssign} style={{ width: '100%', padding: '0.85rem', borderRadius: '6px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Sparkles size={18} /> {targetDate} 미배정 예약 일괄 배정 실행
                </button>
              </div>
          )}
        </main>
      </div>
  );
}