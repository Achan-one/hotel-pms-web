import { useState, useEffect, useCallback } from 'react';
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

  const [businessDate, setBusinessDate] = useState('2026-09-20');

  const [indicatorData, setIndicatorData] = useState<FloorMapResponseDto | null>(null);
  const [indicatorLoading, setIndicatorLoading] = useState(false);

  const [searchGuestName, setSearchGuestName] = useState('');
  const [searchReservationId, setSearchReservationId] = useState('');
  const [searchCheckInDate, setSearchCheckInDate] = useState('');
  const [searchStayingDate, setSearchStayingDate] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [reservationList, setReservationList] = useState<ReservationDetailDto[]>([]);

  const [activeDetailReservation, setActiveDetailReservation] = useState<ReservationDetailDto | null>(null);

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
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hotel_pms_token');
    localStorage.removeItem('hotel_pms_user');
    setCurrentUser(null);
    setIndicatorData(null);
    setActiveDetailReservation(null);
  };

  const fetchIndicator = useCallback(async () => {
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
  }, [currentUser, businessDate]);

  const executeSearch = useCallback(async (
      guestName = searchGuestName,
      rsvId = searchReservationId,
      checkIn = searchCheckInDate,
      staying = searchStayingDate,
      status = searchStatus
  ) => {
    if (!currentUser) return;
    try {
      const list = await pmsService.getReservations({
        guestName: guestName.trim() || undefined,
        reservationId: rsvId.trim() || undefined,
        checkInDate: checkIn || undefined,
        stayingDate: staying || undefined,
        status: status || undefined,
      });
      setReservationList(list);
    } catch (err) {
      console.error('실시간 검색 오류:', err);
    }
  }, [currentUser, searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus]);

  useEffect(() => {
    if (activeTab === 'RESERVATIONS' && currentUser) {
      void executeSearch();
    }
  }, [activeTab, currentUser, executeSearch]);

  const handleBatchAssign = async () => {
    if (!confirm(`${businessDate} 일자의 미배정 예약을 규칙 기반으로 일괄 자동 배정하시겠습니까?`)) return;
    try {
      await pmsService.runBatchAssign(businessDate);
      alert('자동 일괄 배정이 완료되었습니다.');
      void fetchIndicator();
      void executeSearch();
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
  }, [currentUser, activeTab, fetchIndicator]);

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
          <div style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', padding: '0.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={16} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>호텔 공식 시스템 영업일자:</span>
              <input
                  type="date" value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  style={{ padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid #38bdf8', backgroundColor: '#1e293b', color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem' }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>모든 체크인, 룸체인지, 배정의 기준일자</span>
          </div>

          <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            {activeDetailReservation ? (
                <ReservationDetailView
                    reservation={activeDetailReservation}
                    businessDate={businessDate}
                    onBack={() => {
                      setActiveDetailReservation(null);
                      void executeSearch();
                      void fetchIndicator();
                    }}
                    onUpdated={() => {
                      void executeSearch();
                      void fetchIndicator();
                    }}
                />
            ) : (
                <>
                  {activeTab === 'INDICATOR' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
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

                  {activeTab === 'RESERVATIONS' && (
                      <div style={{ maxWidth: '1050px' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>예약 검색 및 고객 통합 관리</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
                          문자를 타이핑하는 즉시 실시간으로 필터링됩니다.
                        </p>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchCheckInDate(businessDate); setSearchStayingDate(''); setSearchStatus('');
                                void executeSearch(searchGuestName, searchReservationId, businessDate, '', '');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #059669', backgroundColor: searchCheckInDate === businessDate ? '#059669' : '#064e3b', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🟢 당일 도착(Arrivals)
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchStayingDate(businessDate); setSearchCheckInDate(''); setSearchStatus('CHECKED_IN');
                                void executeSearch(searchGuestName, searchReservationId, '', businessDate, 'CHECKED_IN');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #b91c1c', backgroundColor: searchStatus === 'CHECKED_IN' ? '#b91c1c' : '#450a0a', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🔴 현재 재실(In-House)
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchStatus('ASSIGNED'); setSearchCheckInDate(''); setSearchStayingDate('');
                                void executeSearch(searchGuestName, searchReservationId, '', '', 'ASSIGNED');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #1d4ed8', backgroundColor: searchStatus === 'ASSIGNED' ? '#1d4ed8' : '#172554', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🔵 배정 완료(미입실)
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchStatus('PENDING'); setSearchCheckInDate(''); setSearchStayingDate('');
                                void executeSearch(searchGuestName, searchReservationId, '', '', 'PENDING');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #d97706', backgroundColor: searchStatus === 'PENDING' ? '#d97706' : '#451a03', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            🟡 미배정(PENDING)
                          </button>
                          <button
                              type="button"
                              onClick={() => {
                                setSearchStatus('CANCELLED'); setSearchCheckInDate(''); setSearchStayingDate('');
                                void executeSearch(searchGuestName, searchReservationId, '', '', 'CANCELLED');
                              }}
                              style={{ padding: '0.45rem 0.85rem', borderRadius: '20px', border: '1px solid #475569', backgroundColor: searchStatus === 'CANCELLED' ? '#475569' : '#1e293b', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            ⚪ 취소 목록
                          </button>
                        </div>

                        <div style={{ backgroundColor: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', marginBottom: '4px' }}>예약자 성명 (타이핑 즉시 반영)</label>
                              <input
                                  type="text"
                                  placeholder="성명 입력 즉시 필터..."
                                  value={searchGuestName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchGuestName(val);
                                    void executeSearch(val, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus);
                                  }}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', marginBottom: '4px' }}>예약 번호 (타이핑 즉시 반영)</label>
                              <input
                                  type="text"
                                  placeholder="예약ID 입력 즉시 필터..."
                                  value={searchReservationId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchReservationId(val);
                                    void executeSearch(searchGuestName, val, searchCheckInDate, searchStayingDate, searchStatus);
                                  }}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>예약 상태</label>
                              <select
                                  value={searchStatus}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchStatus(val);
                                    void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, val);
                                  }}
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
                                  type="date"
                                  value={searchCheckInDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchCheckInDate(val);
                                    void executeSearch(searchGuestName, searchReservationId, val, searchStayingDate, searchStatus);
                                  }}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.8rem', color: '#fbbf24', marginBottom: '4px' }}>재실 체류일자</label>
                              <input
                                  type="date"
                                  value={searchStayingDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchStayingDate(val);
                                    void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, val, searchStatus);
                                  }}
                                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d97706', backgroundColor: '#0f172a', color: '#fff' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => {
                                  setSearchGuestName(''); setSearchReservationId('');
                                  setSearchCheckInDate(''); setSearchStayingDate(''); setSearchStatus('');
                                  void executeSearch('', '', '', '', '');
                                }}
                                style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              필터 전체 초기화
                            </button>
                          </div>
                        </div>

                        {reservationList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', color: '#94a3b8' }}>
                              <Search size={28} style={{ margin: '0 auto 10px auto', display: 'block', opacity: 0.5 }} />
                              일치하는 예약 내역이 없습니다.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '2px' }}>
                                검색 결과: <b>{reservationList.length}</b>건
                              </div>
                              {reservationList.map((res) => (
                                  <div key={res.reservationId} style={{ backgroundColor: '#1e293b', padding: '1.2rem 1.5rem', borderRadius: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{res.operationalGuestName || res.guestName}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#334155', color: '#38bdf8' }}>{res.reservationId}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: res.status === 'CHECKED_IN' ? '#7f1d1d' : '#0f172a', color: res.status === 'CHECKED_IN' ? '#fecaca' : '#fff' }}>
                                {res.status === 'CHECKED_IN' ? '투숙중 (In-House)' : res.status}
                              </span>
                                      </div>
                                      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                        {res.roomType || res.bookedRoomType} | 체크인: {res.checkInDate} ({res.stayNights}박) | 배정호실: <b style={{ color: '#34d399' }}>{res.assignedRoomNumber ? `${res.assignedRoomNumber}호` : '미배정'}</b>
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

                  {activeTab === 'SIMULATION' && (
                      <div style={{ maxWidth: '800px', backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', border: '1px solid #334155' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>🧪 OTA & 채널 매니저(CMS) 연동 테스트 랩</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#38bdf8' }}>1. 기본 시나리오 샘플 데이터 세팅</h4>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          영업일자({businessDate}) 기준 [배정완료 1건, 재실 1건(Sato Yuki, 0302호), 미배정 3건] 주입
                        </span>
                            </div>
                            <button
                                onClick={async () => {
                                  await pmsService.seedSampleReservations();
                                  alert('샘플 데이터 주입 완료! 예약 검색 탭에서 확인해 보세요.');
                                  void fetchIndicator();
                                  void executeSearch();
                                }}
                                style={{ padding: '0.6rem 1rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              데이터 주입
                            </button>
                          </div>

                          {/* [신규] 50건 신규 + 30건 재실 대량 인입 버튼 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#c084fc' }}>2. 신규 예약 50건 + 재실 고객 30건 대량 인입</h4>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          재실 투숙객 30명을 실물 룸 랙에 미리 점유시키고, AI가 분석할 신규 예약 50건을 한 번에 적재합니다.
                        </span>
                            </div>
                            <button
                                onClick={async () => {
                                  const res: any = await pmsService.bulkSimulate50And30();
                                  alert(res.message || '대량 데이터 인입 완료!');
                                  void fetchIndicator();
                                  void executeSearch();
                                }}
                                style={{ padding: '0.6rem 1rem', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              대량 인입 실행
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#f87171' }}>3. 전체 데이터 초기화</h4>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>모든 예약과 191실 객실 상태를 완전한 공실(VACANT)로 리셋합니다.</span>
                            </div>
                            <button
                                onClick={async () => {
                                  if (!confirm('정말 모든 데이터를 초기화하시겠습니까?')) return;
                                  await pmsService.clearReservations();
                                  setReservationList([]);
                                  void fetchIndicator();
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