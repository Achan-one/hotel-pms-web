import { useState, useEffect } from 'react';
import type { SubmitEvent } from 'react';
import { pmsService } from './api/pmsService';
import type { ReservationDetailDto } from './api/pmsService';
import type { FloorMapResponseDto, LoginResponse, RoomMatrixItemDto } from './types/pms';
import Sidebar, { type TabType } from './components/Sidebar';
import ReservationDetailView from './components/ReservationDetailView';
import {
  LogIn, RefreshCw, Hotel, Sparkles, Search, Settings, Clock
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

  // 호텔 공식 시스템 영업일자 (Business Date)
  const [businessDate, setBusinessDate] = useState('2026-09-20');

  // 191실 룸 인디케이터
  const [indicatorData, setIndicatorData] = useState<FloorMapResponseDto | null>(null);
  const [indicatorLoading, setIndicatorLoading] = useState(false);

  // PMS 다조건 검색 (Lazy Load)
  const [searchGuestName, setSearchGuestName] = useState('');
  const [searchReservationId, setSearchReservationId] = useState('');
  const [searchCheckInDate, setSearchCheckInDate] = useState('');
  const [searchStayingDate, setSearchStayingDate] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [reservationList, setReservationList] = useState<ReservationDetailDto[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // 고객 상세 화면으로 열릴 대상
  const [activeDetailReservation, setActiveDetailReservation] = useState<ReservationDetailDto | null>(null);

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
        setLoginError('로그인 중 오류가 발생했습니다.');
      }
    }
  };

  // 2. 로그아웃
  const handleLogout = () => {
    localStorage.removeItem('hotel_pms_token');
    localStorage.removeItem('hotel_pms_user');
    setCurrentUser(null);
    setIndicatorData(null);
    setActiveDetailReservation(null);
  };

  // 3. 인디케이터 로드
  const fetchIndicator = async () => {
    if (!currentUser) return;
    setIndicatorLoading(true);
    try {
      const data = await pmsService.getRoomIndicator(businessDate);
      setIndicatorData(data);
    } catch (err) {
      console.error('인디케이터 로드 실패:', err);
    } finally {
      setIndicatorLoading(false);
    }
  };

  // 4. 예약 검색 실행 (조건부 Lazy Load)
  const handleSearchReservations = async (e?: SubmitEvent) => {
    if (e) e.preventDefault();
    setSearchLoading(true);
    try {
      const list = await pmsService.getReservations({
        guestName: searchGuestName.trim() || undefined,
        reservationId: searchReservationId.trim() || undefined,
        checkInDate: searchCheckInDate || undefined,
        stayingDate: searchStayingDate || undefined,
        status: searchStatus || undefined,
      });
      setReservationList(list);
    } catch (err) {
      console.error('예약 검색 실패:', err);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  // 5. 당일 일괄 배정
  const handleBatchAssign = async () => {
    if (!confirm(`${businessDate} 일자의 미배정 예약을 규칙 기반으로 일괄 자동 배정하시겠습니까?`)) return;
    try {
      await pmsService.runBatchAssign(businessDate);
      alert('자동 일괄 배정이 완료되었습니다.');
      void fetchIndicator();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || '일괄 배정 실패');
      }
    }
  };

  useEffect(() => {
    if (currentUser && activeTab === 'INDICATOR') {
      void fetchIndicator();
    }
  }, [currentUser, activeTab, businessDate]);

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

  return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0b1329', color: '#f1f5f9' }}>
        <Sidebar
            currentUser={currentUser}
            activeTab={activeTab}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              setActiveDetailReservation(null);
            }}
            onLogout={handleLogout}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 시스템 상단 헤더: 호텔 비즈니스 영업일자 표시 바 */}
          <div style={{
            backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0.75rem 2rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={16} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>호텔 공식 시스템 영업일자 (Business Date):</span>
              <input
                  type="date"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  style={{
                    padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #38bdf8',
                    backgroundColor: '#1e293b', color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem'
                  }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>모든 체크인, 룸체인지, 배정의 기준일자로 사용됩니다.</span>
          </div>

          <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            {activeDetailReservation ? (
                <ReservationDetailView
                    reservation={activeDetailReservation}
                    businessDate={businessDate}
                    onBack={() => setActiveDetailReservation(null)}
                    onUpdated={() => {
                      void handleSearchReservations();
                      if (indicatorData) void fetchIndicator();
                    }}
                />
            ) : (
                <>
                  {/* 탭 1: 룸 인디케이터 */}
                  {activeTab === 'INDICATOR' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                          <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 4px 0' }}>191실 룸 인디케이터</h2>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>기준 영업일자: {businessDate}</span>
                          </div>
                          <button onClick={() => void fetchIndicator()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.8rem', borderRadius: '6px', backgroundColor: '#0369a1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                            <RefreshCw size={16} className={indicatorLoading ? 'spin' : ''} /> 새로고침
                          </button>
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

                  {/* 탭 2: 예약 검색 & 통합 관리 */}
                  {activeTab === 'RESERVATIONS' && (
                      <div style={{ maxWidth: '1050px' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>예약 검색 및 고객 통합 관리</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
                          실무 PMS처럼 상태 및 체류 기간별로 정밀 검색하고, 고객을 선택해 수동 배정 및 룸체인지를 진행합니다.
                        </p>

                        {/* 1. 실무 퀵 필터 칩 바 */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchCheckInDate(businessDate);
                                setSearchStayingDate('');
                                setSearchStatus('');
                                setSearchGuestName('');
                                setSearchReservationId('');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #059669', backgroundColor: '#064e3b', color: '#a7f3d0', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🟢 당일 도착(Arrivals: {businessDate})
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchStayingDate(businessDate);
                                setSearchCheckInDate('');
                                setSearchStatus('CHECKED_IN');
                                setSearchGuestName('');
                                setSearchReservationId('');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #b91c1c', backgroundColor: '#450a0a', color: '#fecaca', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🔴 현재 재실(In-House: {businessDate})
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchStatus('ASSIGNED');
                                setSearchCheckInDate('');
                                setSearchStayingDate('');
                                setSearchGuestName('');
                                setSearchReservationId('');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #1d4ed8', backgroundColor: '#172554', color: '#bfdbfe', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🔵 배정 완료(미입실)
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchStatus('PENDING');
                                setSearchCheckInDate('');
                                setSearchStayingDate('');
                                setSearchGuestName('');
                                setSearchReservationId('');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #d97706', backgroundColor: '#451a03', color: '#fde68a', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🟡 미배정(PENDING)
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchStatus('CANCELLED');
                                setSearchCheckInDate('');
                                setSearchStayingDate('');
                                setSearchGuestName('');
                                setSearchReservationId('');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            ⚪ 취소 예약 목록
                          </button>
                        </div>

                        {/* 2. 다조건 검색 폼 */}
                        <form onSubmit={handleSearchReservations} style={{ backgroundColor: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>예약자 성명</label>
                              <input
                                  type="text" placeholder="예: Tanaka, Kim, Sato" value={searchGuestName}
                                  onChange={(e) => setSearchGuestName(e.target.value)}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>예약 번호</label>
                              <input
                                  type="text" placeholder="예: RSV-TEST-02" value={searchReservationId}
                                  onChange={(e) => setSearchReservationId(e.target.value)}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>예약 상태 구분</label>
                              <select
                                  value={searchStatus}
                                  onChange={(e) => setSearchStatus(e.target.value)}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                              >
                                <option value="">(전체 상태)</option>
                                <option value="CHECKED_IN">투숙중 (CHECKED_IN)</option>
                                <option value="ASSIGNED">배정완료 (ASSIGNED)</option>
                                <option value="PENDING">접수 미배정 (PENDING)</option>
                                <option value="CHECKED_OUT">퇴실완료 (CHECKED_OUT)</option>
                                <option value="CANCELLED">예약취소 (CANCELLED)</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>체크인 일자</label>
                              <input
                                  type="date" value={searchCheckInDate}
                                  onChange={(e) => setSearchCheckInDate(e.target.value)}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: '#fbbf24', marginBottom: '4px' }}>재실 체류일자 (In-House)</label>
                              <input
                                  type="date" value={searchStayingDate}
                                  onChange={(e) => setSearchStayingDate(e.target.value)}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d97706', backgroundColor: '#0f172a', color: '#fff' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => {
                                  setSearchGuestName(''); setSearchReservationId('');
                                  setSearchCheckInDate(''); setSearchStayingDate(''); setSearchStatus('');
                                }}
                                style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                            >
                              필터 초기화
                            </button>
                            <button
                                type="submit"
                                style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Search size={16} /> {searchLoading ? '조회 중...' : '검색'}
                            </button>
                          </div>
                        </form>

                        {/* 3. 검색 결과 목록 */}
                        {reservationList === null ? (
                            <div style={{ textAlign: 'center', padding: '3.5rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', color: '#94a3b8' }}>
                              <Search size={32} style={{ margin: '0 auto 10px auto', display: 'block', opacity: 0.5 }} />
                              상단 퀵 필터 칩을 누르거나 검색 조건을 지정한 후 [검색]을 눌러주세요.
                            </div>
                        ) : reservationList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3.5rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', color: '#94a3b8' }}>
                              검색 조건과 일치하는 예약 및 재실 고객이 없습니다.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>
                                검색 결과: <b>{reservationList.length}</b>건
                              </div>
                              {reservationList.map((res) => (
                                  <div key={res.reservationId} style={{ backgroundColor: '#1e293b', padding: '1.2rem 1.5rem', borderRadius: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{res.guestName}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#334155', color: '#38bdf8' }}>{res.reservationId}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: res.status === 'CHECKED_IN' ? '#7f1d1d' : '#0f172a', color: res.status === 'CHECKED_IN' ? '#fecaca' : '#fff' }}>
                                {res.status === 'CHECKED_IN' ? '투숙중 (In-House)' : res.status}
                              </span>
                                      </div>
                                      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                        {res.roomType || res.bookedRoomType} | 체크인: {res.checkInDate} ({res.stayNights}박) | 배정호실: <b style={{ color: '#fff' }}>{res.assignedRoomNumber ? `${res.assignedRoomNumber}호` : '미배정'}</b>
                                      </div>
                                    </div>
                                    <div>
                                      <button
                                          onClick={() => setActiveDetailReservation(res)}
                                          style={{ padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                                      >
                                        <Settings size={16} /> 상세 / 변경 관리
                                      </button>
                                    </div>
                                  </div>
                              ))}
                            </div>
                        )}
                      </div>
                  )}

                  {/* 탭 3: AI 당일 일괄 배정 */}
                  {activeTab === 'BATCH_ASSIGN' && (
                      <div style={{ maxWidth: '600px', backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                          <Sparkles size={28} color="#c084fc" />
                          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>규칙 기반 AI 일괄 배정</h2>
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                          호텔 공식 영업일자({businessDate}) 기준 미배정 예약 전체를 대상으로 선호도 및 연박 보호 규칙을 계산하여 빈 객실을 일괄 자동 배정합니다.
                        </p>
                        <button onClick={handleBatchAssign} style={{ width: '100%', padding: '0.85rem', borderRadius: '6px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <Sparkles size={18} /> {businessDate} 미배정 예약 일괄 배정 실행
                        </button>
                      </div>
                  )}

                  {/* 탭 4: OTA / 린칸 테스트 랩 */}
                  {activeTab === 'SIMULATION' && (
                      <div style={{ maxWidth: '800px', backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', border: '1px solid #334155' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                          🧪 OTA & 채널 매니저(CMS) 연동 테스트 랩
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '2rem' }}>
                          현장 PMS 연동 상황을 모의 실험합니다. 버튼을 클릭하면 백엔드 도메인 엔진과 스케줄 매트릭스에 즉시 반영됩니다.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#38bdf8' }}>1. 기본 시나리오 샘플 데이터 세팅</h4>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          영업일자({businessDate}) 기준 [배정완료 1건, 재실 1건(Sato Yuki, 0302호), 미배정 3건]을 일괄 주입합니다.
                        </span>
                            </div>
                            <button
                                onClick={async () => {
                                  await pmsService.seedSampleReservations();
                                  alert('기본 샘플 데이터 주입 완료! 예약 검색 탭에서 확인해 보세요.');
                                }}
                                style={{ padding: '0.6rem 1rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              데이터 주입
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#34d399' }}>2. TL-Lincoln(린칸) XML 신규 예약 전문 수신 모의</h4>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          일본 OTA 채널 매니저인 TL-Lincoln의 XML 통지를 수신하여 미배정 예약으로 자동 등록합니다.
                        </span>
                            </div>
                            <button
                                onClick={async () => {
                                  await pmsService.simulateLincoln();
                                  alert('린칸 XML 전문이 파싱되어 신규 예약(Yamamoto Daiki)이 등록되었습니다!');
                                }}
                                style={{ padding: '0.6rem 1rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              XML 수신 트리거
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#f87171' }}>3. 전체 데이터 초기화</h4>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          인메모리에 등록된 모든 예약 및 191실 전체 객실 상태를 완전한 공실(VACANT)로 리셋합니다.
                        </span>
                            </div>
                            <button
                                onClick={async () => {
                                  if (!confirm('정말 모든 데이터를 초기화하시겠습니까?')) return;
                                  await pmsService.clearReservations();
                                  setReservationList(null);
                                  alert('모든 데이터가 초기화되었습니다.');
                                }}
                                style={{ padding: '0.6rem 1rem', backgroundColor: '#b91c1c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              전체 초기화
                            </button>
                          </div>
                        </div>
                      </div>
                  )}
                </>
            )}
          </main>
        </div>
      </div>
  );
}