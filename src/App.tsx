import { useState, useEffect, useCallback, useRef } from 'react';
import type { SubmitEvent } from 'react';
import { pmsService } from './api/pmsService';
import type { ReservationDetailDto } from './api/pmsService';
import type { FloorMapResponseDto, LoginResponse, RoomMatrixItemDto } from './types/pms';
import Sidebar, { type TabType } from './components/Sidebar';
import ReservationDetailView from './components/ReservationDetailView';
import TagManagementView from './components/TagManagementView';
import {
  LogIn, RefreshCw, Hotel, Sparkles, Search, Settings, Clock, Plus, Trash2, ListChecks, CheckCircle2, AlertCircle
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

  // 🔮 AI 일괄 배정 백그라운드 태스크 및 결과 알림 상태
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignToast, setAssignToast] = useState<{ message: string; isError?: boolean } | null>(null);

  // 🧪 테스트 케이스 커스텀 요구사항 목록
  const [customRequirementInput, setCustomRequirementInput] = useState('');
  const [customRequirements, setCustomRequirements] = useState<string[]>([
    '오션뷰나 바다 전망이 보이는 방으로 주세요.',
    '휠체어 이용 예정입니다. 배리어프리 방 필수입니다.',
    '고층에 엘리베이터에서 멀리 떨어진 조용한 방 희망',
  ]);

  const isNavigatingRef = useRef(false);

  const navigateTo = useCallback((tab: TabType, detail: ReservationDetailDto | null = null) => {
    setActiveTab(tab);
    setActiveDetailReservation(detail);
    if (!isNavigatingRef.current) {
      window.history.pushState({ tab, hasDetail: Boolean(detail) }, '', '');
    }
  }, []);

  // 뒤로 가기 / 앞으로 가기 핸들러
  useEffect(() => {
    if (!currentUser) return;

    window.history.replaceState({ tab: activeTab, hasDetail: Boolean(activeDetailReservation) }, '', '');

    const handlePopState = (event: PopStateEvent) => {
      isNavigatingRef.current = true;
      if (activeDetailReservation) {
        setActiveDetailReservation(null);
      } else if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('INDICATOR');
        window.history.pushState({ tab: 'INDICATOR', hasDetail: false }, '', '');
      }
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, activeDetailReservation, activeTab]);

  const handleLogin = async (e: SubmitEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const data = await pmsService.login(staffId, password);
      localStorage.setItem('hotel_pms_token', data.token);
      localStorage.setItem('hotel_pms_user', JSON.stringify(data));
      setCurrentUser(data);
      navigateTo('INDICATOR', null);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setLoginError(axiosErr.response?.data?.message || '로그인에 실패했습니다.');
      }
    }
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('hotel_pms_token');
    localStorage.removeItem('hotel_pms_user');
    setCurrentUser(null);
    setIndicatorData(null);
    setActiveDetailReservation(null);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      handleLogout();
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, [handleLogout]);

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
      gName = searchGuestName,
      rId = searchReservationId,
      cDate = searchCheckInDate,
      sDate = searchStayingDate,
      stat = searchStatus
  ) => {
    if (!currentUser) return;
    try {
      const list = await pmsService.getReservations({
        guestName: gName.trim() || undefined,
        reservationId: rId.trim() || undefined,
        checkInDate: cDate || undefined,
        stayingDate: sDate || undefined,
        status: stat || undefined,
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

  // 🔮 논블로킹 비동기 일괄 배정 핸들러 (사용자가 다른 탭으로 이동해도 백그라운드에서 계속 진행)
  const handleBatchAssign = async () => {
    if (!confirm(`${businessDate} 일자의 미배정 예약을 규칙 기반으로 일괄 자동 배정하시겠습니까?`)) return;

    setIsAssigning(true);
    setAssignToast(null);

    try {
      const res: any = await pmsService.runBatchAssign(businessDate);
      const summaryMsg = res?.data?.successfulAssignments?.length !== undefined
          ? `AI 일괄 배정 완료: 성공 ${res.data.successfulAssignments.length}건, 실패 ${res.data.failedAssignments?.length || 0}건`
          : `AI 일괄 배정이 완료되었습니다! (${businessDate})`;

      setAssignToast({ message: summaryMsg });
      void fetchIndicator();
      void executeSearch();
    } catch (err: unknown) {
      let errMsg = '일괄 배정 실패';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        errMsg = axiosErr.response?.data?.message || errMsg;
      }
      setAssignToast({ message: errMsg, isError: true });
    } finally {
      setIsAssigning(false);
      setTimeout(() => {
        setAssignToast(null);
      }, 5000);
    }
  };

  useEffect(() => {
    if (currentUser && activeTab === 'INDICATOR') {
      void fetchIndicator();
    }
  }, [currentUser, activeTab, fetchIndicator]);

  const addCustomRequirement = () => {
    if (!customRequirementInput.trim()) return;
    setCustomRequirements((prev) => [...prev, customRequirementInput.trim()]);
    setCustomRequirementInput('');
  };

  const removeCustomRequirement = (index: number) => {
    setCustomRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  const getStatusColor = (status: RoomMatrixItemDto['status']) => {
    switch (status) {
      case 'OCCUPIED': return { backgroundColor: '#450a0a', borderColor: '#ef4444', text: '#fca5a5' };
      case 'ASSIGNED': return { backgroundColor: '#172554', borderColor: '#3b82f6', text: '#93c5fd' };
      case 'OUT': return { backgroundColor: '#451a03', borderColor: '#f59e0b', text: '#fcd34d' };
      case 'CLEANING': return { backgroundColor: '#083344', borderColor: '#06b6d4', text: '#67e8f9' };
      case 'BREAK': return { backgroundColor: '#27272a', borderColor: '#71717a', text: '#d4d4d8' };
      case 'BLOCKED': return { backgroundColor: '#3b0764', borderColor: '#a855f7', text: '#d8b4fe' };
      case 'VACANT':
      default: return { backgroundColor: '#064e3b', borderColor: '#10b981', text: '#6ee7b7' };
    }
  };

  if (!currentUser) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
          <form onSubmit={handleLogin} style={{ backgroundColor: '#1e293b', padding: '2.5rem', borderRadius: '12px', width: '380px', color: '#f8fafc', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
              <Hotel size={32} color="#38bdf8" />
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>HOTEL PMS</h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>프론트 데스크 운영 시스템 로그인</p>
            {loginError && <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid #b91c1c' }}>{loginError}</div>}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>직원 ID</label>
              <input type="text" value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="예: admin" style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="hotel1234" style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }} required />
            </div>
            <button type="submit" style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 10px rgba(2, 132, 199, 0.3)' }}>
              <LogIn size={18} /> 로그인
            </button>
          </form>
        </div>
    );
  }

  return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#0b1329', color: '#f1f5f9', overflow: 'hidden', position: 'relative' }}>
        
        {/* 🔮 우측 상단 플로팅 백그라운드 태스크 위젯 (어느 탭에 있든 항시 표시) */}
        {(isAssigning || assignToast) && (
            <div style={{
              position: 'fixed',
              top: '12px',
              right: '24px',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '0.65rem 1.15rem',
              borderRadius: '8px',
              backgroundColor: isAssigning ? '#1e1b4b' : (assignToast?.isError ? '#450a0a' : '#064e3b'),
              border: `1px solid ${isAssigning ? '#a855f7' : (assignToast?.isError ? '#ef4444' : '#10b981')}`,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 16px rgba(168, 85, 247, 0.25)',
              color: '#f8fafc',
              fontSize: '0.85rem',
              fontWeight: 600,
              pointerEvents: 'none'
            }}>
              {isAssigning ? (
                  <>
                    <Sparkles size={18} color="#c084fc" className="spin" />
                    <div>
                      <div style={{ color: '#c084fc', fontWeight: 700, fontSize: '0.85rem' }}>AI 일괄 배정 엔진 연산 중...</div>
                      <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>다른 화면으로 이동하셔도 백그라운드에서 완료됩니다</div>
                    </div>
                  </>
              ) : (
                  <>
                    {assignToast?.isError ? (
                        <AlertCircle size={18} color="#f87171" />
                    ) : (
                        <CheckCircle2 size={18} color="#34d399" />
                    )}
                    <span style={{ fontSize: '0.85rem' }}>{assignToast?.message}</span>
                  </>
              )}
            </div>
        )}

        {/* 사이드바 고정 폭 (화면 축소 방지) */}
        <div style={{ flexShrink: 0, width: '240px', height: '100vh' }}>
          <Sidebar
              currentUser={currentUser}
              activeTab={activeTab}
              onSelectTab={(tab) => navigateTo(tab, null)}
              onLogout={handleLogout}
          />
        </div>

        {/* 메인 뷰포트 영역 (상단 헤더 + 가변 콘텐츠) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0, overflow: 'hidden' }}>
          {/* 상단 영업일자 헤더 */}
          <header style={{
            backgroundColor: '#0f172a',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0.75rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={16} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>호텔 시스템 영업일자:</span>
              <input
                  type="date" value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.4)', backgroundColor: '#1e293b', color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>모든 체크인, 룸체인지, 배정의 기준일자</span>
            </div>
          </header>

          {/* 메인 워크스페이스 (INDICATOR는 화면 꽉 채움, 나머지는 내부 독립 스크롤) */}
          <main style={{
            flex: 1,
            padding: '1.25rem 2rem',
            overflowY: activeTab === 'INDICATOR' ? 'hidden' : 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0
          }}>
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
                  {/* 1. 191실 룸 인디케이터 탭 */}
                  {activeTab === 'INDICATOR' && (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: 0, width: '100%', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>191실 룸 인디케이터</h2>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>기준 영업일자: {businessDate}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#10b981' }} /> 공실
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6' }} /> 배정완료
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#ef4444' }} /> 재실(투숙중)
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#06b6d4' }} /> 청소중
                            </span>
                            <button onClick={() => void fetchIndicator()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.35rem 0.75rem', borderRadius: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)' }}>
                              <RefreshCw size={14} className={indicatorLoading ? 'spin' : ''} /> 새로고침
                            </button>
                          </div>
                        </div>

                        {indicatorData && (
                            <div style={{ display: 'flex', gap: '1.8rem', fontSize: '0.85rem', backgroundColor: '#131d36', padding: '0.55rem 1.4rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', flexShrink: 0 }}>
                              <span>총 객실: <b>{indicatorData.totalRooms}실</b></span>
                              <span style={{ color: '#f87171' }}>점유: <b>{indicatorData.occupiedRooms}실</b></span>
                              <span style={{ color: '#34d399' }}>공실: <b>{indicatorData.vacantRooms}실</b></span>
                              <span style={{ color: '#38bdf8' }}>점유율: <b>{indicatorData.occupancyRatePercent}%</b></span>
                            </div>
                        )}

                        {indicatorData && (
                            <div style={{
                              flex: 1, minHeight: 0, backgroundColor: '#131d36', padding: '0.8rem',
                              borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '5px',
                              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
                            }}>
                              {Object.entries(indicatorData.floorRooms)
                                  .sort(([a], [b]) => Number(b) - Number(a))
                                  .map(([floorStr, rooms]) => {
                                    const floor = Number(floorStr);
                                    const prefix = floor < 10 ? `0${floor}` : `${floor}`;
                                    const roomMap = new Map(rooms.map((r) => [r.roomNumber, r]));

                                    return (
                                        <div key={floor} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: '6px' }}>
                                          <div style={{
                                            width: '44px', minWidth: '44px', height: '100%', backgroundColor: '#0b1329', color: '#38bdf8',
                                            border: '1px solid #293548', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.78rem', fontWeight: 800, userSelect: 'none'
                                          }}>
                                            {floor}F
                                          </div>

                                          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '5px' }}>
                                            {Array.from({ length: 16 }, (_, rIdx) => rIdx + 1).map((r) => {
                                              const padRoom = r < 10 ? `0${r}` : `${r}`;
                                              const roomNo = `${prefix}${padRoom}`;

                                              if (r === 13) {
                                                return (
                                                    <div
                                                        key={r}
                                                        title="13호 결번"
                                                        style={{
                                                          height: '100%', borderRadius: '4px', border: '1px dashed #293548',
                                                          backgroundColor: 'rgba(11, 19, 41, 0.4)', display: 'flex',
                                                          alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.75rem', userSelect: 'none'
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
                                                        title="설비/공조실 결번"
                                                        style={{
                                                          height: '100%', borderRadius: '4px', border: '1px dashed #334155',
                                                          backgroundColor: 'rgba(19, 29, 54, 0.4)', display: 'flex',
                                                          alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.7rem', userSelect: 'none'
                                                        }}
                                                    >
                                                      설비
                                                    </div>
                                                );
                                              }

                                              const room = roomMap.get(roomNo);
                                              if (!room) return <div key={roomNo} style={{ height: '100%' }} />;

                                              const c = getStatusColor(room.status);
                                              const tooltipText = `[${room.roomNumber}호] ${room.roomTypeName}\n상태: ${room.status}${room.guestName ? `\n투숙객: ${room.guestName}` : ''}`;

                                              return (
                                                  <div
                                                      key={room.roomNumber}
                                                      title={tooltipText}
                                                      style={{
                                                        height: '100%', borderRadius: '4px',
                                                        border: `1px solid ${c.borderColor}`, backgroundColor: c.backgroundColor,
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'default', transition: 'all 0.15s ease', userSelect: 'none', padding: '2px 4px', boxSizing: 'border-box'
                                                      }}
                                                  >
                                                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                                                      {room.roomNumber}
                                                    </span>
                                                    {room.guestName && (
                                                        <span style={{ fontSize: '0.62rem', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: 1.1, marginTop: '2px' }}>
                                                          {room.guestName}
                                                        </span>
                                                    )}
                                                  </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                    );
                                  })}
                            </div>
                        )}
                      </div>
                  )}

                  {/* 2. 예약 검색 및 통합 관리 탭 (width: 100% 풀 확장형) */}
                  {activeTab === 'RESERVATIONS' && (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', width: '100%' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                                예약 원장 및 실시간 고객 관리
                              </h2>
                              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', fontWeight: 600 }}>
                                Live Sync
                              </span>
                            </div>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                              타이핑 시 0초 즉시 실시간 필터링 • 영업일자({businessDate}) 기준 인하우스 매칭
                            </p>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchGuestName(''); setSearchReservationId('');
                                setSearchCheckInDate(''); setSearchStayingDate(''); setSearchStatus('');
                                void executeSearch('', '', '', '', '');
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.12)', backgroundColor: 'rgba(255, 255, 255, 0.03)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                            >
                              <RefreshCw size={13} /> 조건 초기화
                            </button>
                          </div>
                        </div>

                        {/* 현대적 세그먼트 퀵 필터 바 */}
                        <div style={{ display: 'flex', gap: '6px', padding: '4px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)', width: 'fit-content' }}>
                          {[
                            { label: '전체 보기', active: !searchCheckInDate && !searchStayingDate && !searchStatus, onClick: () => { setSearchCheckInDate(''); setSearchStayingDate(''); setSearchStatus(''); void executeSearch(searchGuestName, searchReservationId, '', '', ''); } },
                            { label: '당일 도착 (Arrivals)', active: searchCheckInDate === businessDate, dotColor: '#10b981', onClick: () => { const newCI = searchCheckInDate === businessDate ? '' : businessDate; setSearchCheckInDate(newCI); setSearchStayingDate(''); setSearchStatus(''); void executeSearch(searchGuestName, searchReservationId, newCI, '', ''); } },
                            { label: '현재 재실 (In-House)', active: searchStatus === 'CHECKED_IN', dotColor: '#ef4444', onClick: () => { const newStay = searchStayingDate === businessDate ? '' : businessDate; const newStat = searchStatus === 'CHECKED_IN' ? '' : 'CHECKED_IN'; setSearchStayingDate(newStay); setSearchCheckInDate(''); setSearchStatus(newStat); void executeSearch(searchGuestName, searchReservationId, '', newStay, newStat); } },
                            { label: '배정 완료 (미입실)', active: searchStatus === 'ASSIGNED', dotColor: '#3b82f6', onClick: () => { const newStat = searchStatus === 'ASSIGNED' ? '' : 'ASSIGNED'; setSearchStatus(newStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', newStat); } },
                            { label: '미배정 (PENDING)', active: searchStatus === 'PENDING', dotColor: '#f59e0b', onClick: () => { const newStat = searchStatus === 'PENDING' ? '' : 'PENDING'; setSearchStatus(newStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', newStat); } },
                            { label: '취소 (Cancelled)', active: searchStatus === 'CANCELLED', dotColor: '#64748b', onClick: () => { const newStat = searchStatus === 'CANCELLED' ? '' : 'CANCELLED'; setSearchStatus(newStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', newStat); } },
                          ].map((chip, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={chip.onClick}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '7px', padding: '0.45rem 0.9rem', borderRadius: '6px', border: 'none',
                                backgroundColor: chip.active ? '#1e293b' : 'transparent',
                                color: chip.active ? '#f8fafc' : '#94a3b8',
                                boxShadow: chip.active ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                                borderBottom: chip.active ? '2px solid #38bdf8' : '2px solid transparent',
                                fontSize: '0.8rem', fontWeight: chip.active ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s ease'
                              }}
                            >
                              {chip.dotColor && <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: chip.dotColor }} />}
                              {chip.label}
                            </button>
                          ))}
                        </div>

                        {/* 정밀 검색 필터 카드 */}
                        <div style={{ width: '100%', backgroundColor: '#131d36', padding: '1.25rem 1.5rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)', boxSizing: 'border-box' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
                            <div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                                <Search size={12} color="#38bdf8" /> 예약자 성명
                              </label>
                              <input
                                  type="text"
                                  placeholder="성명 실시간 검색..."
                                  value={searchGuestName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchGuestName(val);
                                    void executeSearch(val, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus);
                                  }}
                                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                                <Search size={12} color="#38bdf8" /> 예약 식별 번호 (ID)
                              </label>
                              <input
                                  type="text"
                                  placeholder="예: RSV-2026..."
                                  value={searchReservationId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchReservationId(val);
                                    void executeSearch(searchGuestName, val, searchCheckInDate, searchStayingDate, searchStatus);
                                  }}
                                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#f8fafc', fontSize: '0.85rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>상태 필터</label>
                              <select
                                  value={searchStatus}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchStatus(val);
                                    void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, val);
                                  }}
                                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
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
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>체크인 일자</label>
                              <input
                                  type="date"
                                  value={searchCheckInDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchCheckInDate(val);
                                    void executeSearch(searchGuestName, searchReservationId, val, searchStayingDate, searchStatus);
                                  }}
                                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>재실 체류일자</label>
                              <input
                                  type="date"
                                  value={searchStayingDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchStayingDate(val);
                                    void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, val, searchStatus);
                                  }}
                                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#f8fafc', fontSize: '0.85rem', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 검색 결과 목록 & Empty State */}
                        {reservationList.length === 0 ? (
                            <div style={{ width: '100%', textAlign: 'center', padding: '5rem 2rem', backgroundColor: '#131d36', borderRadius: '10px', border: '1px dashed #293548', color: '#64748b', boxSizing: 'border-box' }}>
                              <Search size={38} style={{ margin: '0 auto 12px auto', display: 'block', opacity: 0.35, color: '#38bdf8' }} />
                              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>일치하는 예약 내역이 없습니다</div>
                              <p style={{ fontSize: '0.85rem', margin: 0, color: '#64748b' }}>
                                다른 검색 조건을 입력하시거나, 좌측 [OTA/린칸 테스트 랩]에서 샘플 데이터를 인입해 보세요.
                              </p>
                            </div>
                        ) : (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', fontSize: '0.85rem', color: '#94a3b8' }}>
                                <span>조회 결과 총 <b style={{ color: '#38bdf8' }}>{reservationList.length}</b>건</span>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>영업일 기준 체크인/체크아웃 정렬</span>
                              </div>
                              {reservationList.map((res) => (
                                  <div key={res.reservationId} style={{ width: '100%', backgroundColor: '#131d36', padding: '1.1rem 1.5rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>{res.operationalGuestName || res.guestName}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#0b1329', border: '1px solid #293548', color: '#38bdf8', fontFamily: 'monospace' }}>{res.reservationId}</span>
                                        <span style={{
                                          fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 700,
                                          backgroundColor: res.status === 'CHECKED_IN' ? 'rgba(239, 68, 68, 0.15)' : res.status === 'ASSIGNED' ? 'rgba(59, 130, 246, 0.15)' : res.status === 'PENDING' ? 'rgba(245, 158, 11, 0.15)' : '#1e293b',
                                          color: res.status === 'CHECKED_IN' ? '#f87171' : res.status === 'ASSIGNED' ? '#60a5fa' : res.status === 'PENDING' ? '#fbbf24' : '#94a3b8',
                                          border: `1px solid ${res.status === 'CHECKED_IN' ? 'rgba(239, 68, 68, 0.3)' : res.status === 'ASSIGNED' ? 'rgba(59, 130, 246, 0.3)' : 'transparent'}`
                                        }}>
                                          {res.status === 'CHECKED_IN' ? '투숙중 (In-House)' : res.status}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                        {res.roomType || res.bookedRoomType} <span style={{ color: '#475569' }}>•</span> 체크인: <b>{res.checkInDate}</b> ({res.stayNights}박) <span style={{ color: '#475569' }}>•</span> 배정호실: <b style={{ color: res.assignedRoomNumber ? '#34d399' : '#f87171' }}>{res.assignedRoomNumber ? `${res.assignedRoomNumber}호` : '미배정'}</b>
                                      </div>
                                    </div>
                                    <div>
                                      <button
                                          onClick={() => navigateTo('RESERVATIONS', res)}
                                          style={{ padding: '0.55rem 1.05rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 10px rgba(2, 132, 199, 0.3)' }}
                                      >
                                        <Settings size={15} /> 상세 및 배정 관리
                                      </button>
                                    </div>
                                  </div>
                              ))}
                            </div>
                        )}
                      </div>
                  )}

                  {/* 3. 규칙 기반 AI 일괄 배정 탭 */}
                  {activeTab === 'BATCH_ASSIGN' && (
                      <div style={{ maxWidth: '600px', backgroundColor: '#131d36', padding: '2rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                          <Sparkles size={28} color="#c084fc" />
                          <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#f8fafc' }}>규칙 기반 AI 일괄 배정</h2>
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                          호텔 공식 영업일자({businessDate}) 기준 미배정 예약 전체를 대상으로 선호도 및 연박 보호 규칙을 계산하여 빈 객실을 일괄 자동 배정합니다.
                        </p>
                        <button
                            onClick={handleBatchAssign}
                            disabled={isAssigning}
                            style={{
                              width: '100%', padding: '0.85rem', borderRadius: '6px',
                              backgroundColor: isAssigning ? '#4c1d95' : '#7c3aed',
                              color: '#fff', border: 'none', fontWeight: 700,
                              cursor: isAssigning ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
                            }}
                        >
                          <Sparkles size={18} className={isAssigning ? 'spin' : ''} />
                          {isAssigning ? 'Gemini 2.5 Flash 일괄 분석 & 배정 진행 중...' : `${businessDate} 미배정 예약 일괄 배정 실행`}
                        </button>
                      </div>
                  )}

                  {/* 4. 태그 사전 관리 탭 */}
                  {activeTab === 'TAGS' && <TagManagementView />}

                  {/* 5. OTA/린칸 테스트 랩 탭 */}
                  {activeTab === 'SIMULATION' && (
                      <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ backgroundColor: '#131d36', padding: '2rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
                          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
                            🧪 OTA & 채널 매니저(CMS) 연동 테스트 랩
                          </h2>
                          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                            가상 채널 인입 전문과 대량 예약 생성 시나리오를 실행하여 배정 로직과 Gemini 태그 파싱을 검증합니다.
                          </p>
                        </div>

                        {/* 테스트 케이스 커스텀 요구사항 인입 콘솔 */}
                        <div style={{ backgroundColor: '#131d36', padding: '1.8rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '0.5rem' }}>
                            <ListChecks size={22} />
                            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>테스트 케이스 요구사항 인입 콘솔 (50건 순환 주입 풀)</h3>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.2rem' }}>
                            테스트하고 싶은 고객 요청사항(특정 태그 유도 문구 등)을 아래에 추가하세요.
                            <br />
                            <b>[기본 6건 + 사용자 정의 {customRequirements.length}건 = 총 {6 + customRequirements.length}건]</b>의 풀이 구성되며,
                            신규 50건을 생성할 때 이 풀을 순환하여 50건 전체에 빈틈없이 반복 채워집니다.
                          </p>

                          <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem' }}>
                            <input
                                type="text"
                                placeholder="예: 결혼기념일이라 도쿄타워가 보이는 최고층 방 희망합니다."
                                value={customRequirementInput}
                                onChange={(e) => setCustomRequirementInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addCustomRequirement();
                                  }
                                }}
                                style={{ flex: 1, padding: '0.7rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }}
                            />
                            <button
                                type="button"
                                onClick={addCustomRequirement}
                                style={{ padding: '0.7rem 1.2rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)' }}
                            >
                              <Plus size={16} /> 추가
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#0b1329', padding: '0.8rem', borderRadius: '8px', border: '1px solid #293548' }}>
                            {customRequirements.length === 0 ? (
                                <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                                  사용자 추가 요구사항이 없습니다. (기본 6개 메모만 50건에 순환 반복됩니다)
                                </div>
                            ) : (
                                customRequirements.map((reqText, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#131d36', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                      <span style={{ color: '#cbd5e1' }}>
                                        <b style={{ color: '#38bdf8', marginRight: '6px' }}>#{idx + 1}</b>
                                        {reqText}
                                      </span>
                                      <button
                                          type="button"
                                          onClick={() => removeCustomRequirement(idx)}
                                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                                          title="삭제"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                ))
                            )}
                          </div>
                        </div>

                        {/* 시나리오 실행 버튼 목록 */}
                        <div style={{ backgroundColor: '#131d36', padding: '1.8rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '1.2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0b1329', borderRadius: '8px', border: '1px solid #293548' }}>
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
                                style={{ padding: '0.6rem 1rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)' }}
                            >
                              데이터 주입
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0b1329', borderRadius: '8px', border: '1px solid #293548' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#c084fc' }}>
                                2. 신규 예약 50건 (요구사항 순환 주입) + 재실 30건 대량 인입
                              </h4>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                위에서 정의한 {6 + customRequirements.length}개 요구사항 풀을 순환하여 50건의 예약 메모를 생성하고 적재합니다.
                              </span>
                            </div>
                            <button
                                onClick={async () => {
                                  const res: any = await pmsService.bulkSimulate50And30(customRequirements);
                                  alert(res.message || '대량 데이터 인입 완료!');
                                  void fetchIndicator();
                                  void executeSearch();
                                }}
                                style={{ padding: '0.6rem 1rem', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}
                            >
                              대량 인입 실행
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0b1329', borderRadius: '8px', border: '1px solid #293548' }}>
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
                                style={{ padding: '0.6rem 1rem', backgroundColor: '#b91c1c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 8px rgba(185, 28, 28, 0.3)' }}
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