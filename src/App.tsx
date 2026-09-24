import { useState, useEffect, useCallback, useRef } from 'react';
import type { SubmitEvent } from 'react';
import { pmsService } from './api/pmsService';
import type { ReservationDetailDto } from './api/pmsService';
import type { FloorMapResponseDto, LoginResponse, RoomMatrixItemDto } from './types/pms';
import Sidebar, { type TabType } from './components/Sidebar';
import ReservationDetailView from './components/ReservationDetailView';
import ReservationGridView from './components/ReservationGridView';
import TagManagementView from './components/TagManagementView';
import ExportReportView from './components/ExportReportView';
import StaffManagementView from './components/StaffManagementView';
import {
  LogIn, RefreshCw, Hotel, Sparkles, Clock, Plus, Trash2, ListChecks, CheckCircle2, AlertCircle
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

  const [activeDetailReservation, setActiveDetailReservation] = useState<ReservationDetailDto | null>(null);

  const [isAssigning, setIsAssigning] = useState(false);
  const [assignToast, setAssignToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const [customRequirementInput, setCustomRequirementInput] = useState('');
  const [customRequirements, setCustomRequirements] = useState<string[]>([
    '오션뷰나 바다 전망이 보이는 방으로 주세요.',
    '휠체어 이용 예정입니다. 배리어프리 방 필수입니다.',
    '고층에 엘리베이터에서 멀리 떨어진 조용한 방 희망',
    '어르신이 계셔서 이동하기 편한 낮은 층과 엘리베이터 근처 부탁드립니다.',
  ]);

  const isNavigatingRef = useRef(false);

  const navigateTo = useCallback((tab: TabType, detail: ReservationDetailDto | null = null) => {
    setActiveTab(tab);
    setActiveDetailReservation(detail);
    if (!isNavigatingRef.current) {
      window.history.pushState({ tab, hasDetail: Boolean(detail) }, '', '');
    }
  }, []);

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

  useEffect(() => {
    if (currentUser && activeTab === 'INDICATOR') {
      void fetchIndicator();
    }
  }, [currentUser, activeTab, fetchIndicator]);

  const handleBatchAssign = async () => {
    if (!confirm(`${businessDate} 일자의 미배정 예약을 규칙 기반으로 일괄 자동 배정하시겠습니까?`)) return;

    setIsAssigning(true);
    setAssignToast(null);

    try {
      const res: any = await pmsService.runBatchAssign(businessDate);
      const successCount = res?.data?.successfulAssignments?.length ?? 0;
      const failCount = res?.data?.failedAssignments?.length ?? 0;
      const summaryMsg = `AI 일괄 배정 완료: 성공 ${successCount}건 / 실패 ${failCount}건 (${businessDate})`;

      setAssignToast({ message: summaryMsg });
      void fetchIndicator();
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
          <button type="submit" style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <LogIn size={18} /> 로그인
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#0b1329', color: '#f1f5f9', overflow: 'hidden', position: 'relative' }}>
      
      {/* 🔮 우측 상단 플로팅 백그라운드 태스크 위젯 */}
      {(isAssigning || assignToast) && (
        <div style={{
          position: 'fixed', top: '12px', right: '24px', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px',
          padding: '0.65rem 1.15rem', borderRadius: '8px',
          backgroundColor: isAssigning ? '#1e1b4b' : (assignToast?.isError ? '#450a0a' : '#064e3b'),
          border: `1px solid ${isAssigning ? '#a855f7' : (assignToast?.isError ? '#ef4444' : '#10b981')}`,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 16px rgba(168, 85, 247, 0.25)',
          color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600, pointerEvents: 'none'
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
              {assignToast?.isError ? <AlertCircle size={18} color="#f87171" /> : <CheckCircle2 size={18} color="#34d399" />}
              <span style={{ fontSize: '0.85rem' }}>{assignToast?.message}</span>
            </>
          )}
        </div>
      )}

      {/* 사이드바 */}
      <div style={{ flexShrink: 0, width: '260px', height: '100vh' }}>
        <Sidebar currentUser={currentUser} activeTab={activeTab} onSelectTab={(tab) => navigateTo(tab, null)} onLogout={handleLogout} />
      </div>

      {/* 메인 뷰포트 영역 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0, overflow: 'hidden' }}>
        <header style={{
          backgroundColor: '#0f172a', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={16} color="#38bdf8" />
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>호텔 시스템 영업일자:</span>
            <input
              type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)}
              style={{ padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.4)', backgroundColor: '#1e293b', color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>모든 체크인, 룸체인지, 배정의 기준일자</span>
          </div>
        </header>

        <main style={{
          flex: 1, padding: '1.25rem 2rem', overflowY: activeTab === 'INDICATOR' ? 'hidden' : 'auto',
          overflowX: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0
        }}>
          {activeDetailReservation ? (
            <ReservationDetailView
              reservation={activeDetailReservation}
              businessDate={businessDate}
              onBack={() => { setActiveDetailReservation(null); void fetchIndicator(); }}
              onUpdated={() => { void fetchIndicator(); }}
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
                      <button onClick={() => void fetchIndicator()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.35rem 0.75rem', borderRadius: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
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
                      borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '5px'
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

                              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(16, minmax(0, 1fr))', gap: '5px' }}>
                                {Array.from({ length: 16 }, (_, rIdx) => rIdx + 1).map((r) => {
                                  const padRoom = r < 10 ? `0${r}` : `${r}`;
                                  const roomNo = `${prefix}${padRoom}`;

                                  if (r === 13) {
                                    return (
                                      <div key={r} title="13호 결번" style={{ height: '100%', borderRadius: '4px', border: '1px dashed #293548', backgroundColor: 'rgba(11, 19, 41, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.75rem', userSelect: 'none', minWidth: 0 }}>
                                        -
                                      </div>
                                    );
                                  }

                                  if (floor >= 14 && (r === 3 || r === 7)) {
                                    return (
                                      <div key={r} title="설비/공조실 결번" style={{ height: '100%', borderRadius: '4px', border: '1px dashed #334155', backgroundColor: 'rgba(19, 29, 54, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.7rem', userSelect: 'none', minWidth: 0 }}>
                                        설비
                                      </div>
                                    );
                                  }

                                  const room = roomMap.get(roomNo);
                                  if (!room) return <div key={roomNo} style={{ height: '100%', minWidth: 0 }} />;

                                  const c = getStatusColor(room.status);
                                  const tooltipText = `[${room.roomNumber}호] ${room.roomTypeName}\n상태: ${room.status}${room.guestName ? `\n투숙객: ${room.guestName}` : ''}`;

                                  return (
                                    <div
                                      key={room.roomNumber}
                                      title={tooltipText}
                                      style={{
                                        height: '100%', borderRadius: '4px', border: `1px solid ${c.borderColor}`, backgroundColor: c.backgroundColor,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        userSelect: 'none', padding: '2px 4px', boxSizing: 'border-box', minWidth: 0, overflow: 'hidden'
                                      }}
                                    >
                                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#ffffff', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                                        {room.roomNumber}
                                      </span>
                                      {room.guestName && (
                                        <span style={{ fontSize: '0.62rem', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: 1.1, marginTop: '2px', display: 'block' }}>
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

              {/* 2. 예약 그리드 탭 */}
              {activeTab === 'RESERVATIONS' && (
                <ReservationGridView
                  businessDate={businessDate}
                  onSelectReservation={(res) => navigateTo('RESERVATIONS', res)}
                />
              )}

              {/* 3. 규칙 기반 AI 일괄 배정 탭 */}
              {activeTab === 'BATCH_ASSIGN' && (
                <div style={{ maxWidth: '600px', backgroundColor: '#131d36', padding: '2rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
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
                      color: '#fff', border: 'none', fontWeight: 700, cursor: isAssigning ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <Sparkles size={18} className={isAssigning ? 'spin' : ''} />
                    {isAssigning ? 'Gemini 2.5 Flash 일괄 분석 & 배정 진행 중...' : `${businessDate} 미배정 예약 일괄 배정 실행`}
                  </button>
                </div>
              )}

              {/* 4. 태그 사전 관리 탭 */}
              {activeTab === 'TAGS' && <TagManagementView />}

              {/* 5. 신규 직원 계정 발급 탭 (ROLE_ADMIN 총지배인 전용) */}
              {activeTab === 'STAFF_MGMT' && <StaffManagementView />}

              {/* 6. 데이터 엑스포트(CSV) 탭 */}
              {activeTab === 'EXPORT' && <ExportReportView businessDate={businessDate} />}

              {/* 7. OTA/린칸 테스트 랩 탭 */}
              {activeTab === 'SIMULATION' && (
                <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ backgroundColor: '#131d36', padding: '2rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
                      🧪 OTA & 채널 매니저(CMS) 연동 테스트 랩
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                      가상 채널 인입 전문과 대량 예약 생성 시나리오를 실행하여 배정 로직과 Gemini 태그 파싱을 검증합니다.
                    </p>
                  </div>

                  <div style={{ backgroundColor: '#131d36', padding: '1.8rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '0.5rem' }}>
                      <ListChecks size={22} />
                      <h3 style={{ margin: 0, fontSize: '1.15rem' }}>테스트 케이스 요구사항 인입 콘솔 (50건 순환 주입 풀)</h3>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1.2rem' }}>
                      테스트하고 싶은 고객 요청사항을 아래에 추가하세요. (한글 조합 엔터 중복 방어 적용 완료)
                    </p>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem' }}>
                      <input
                        type="text"
                        placeholder="예: 롯데 월드타워 전망이 보이는 방으로 주세요."
                        value={customRequirementInput}
                        onChange={(e) => setCustomRequirementInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing) return;
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
                        style={{ padding: '0.7rem 1.2rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Plus size={16} /> 추가
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#0b1329', padding: '0.8rem', borderRadius: '8px', border: '1px solid #293548' }}>
                      {customRequirements.map((reqText, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#131d36', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}>
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
                      ))}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#131d36', padding: '1.8rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0b1329', borderRadius: '8px', border: '1px solid #293548' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#38bdf8' }}>1. 기본 시나리오 샘플 데이터 세팅</h4>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>영업일자({businessDate}) 기준 샘플 5건 주입</span>
                      </div>
                      <button
                        onClick={async () => {
                          await pmsService.seedSampleReservations();
                          alert('샘플 데이터 주입 완료!');
                          void fetchIndicator();
                        }}
                        style={{ padding: '0.6rem 1rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        데이터 주입
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem', backgroundColor: '#0b1329', borderRadius: '8px', border: '1px solid #293548' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#c084fc' }}>2. 신규 50건 (요구사항 순환 주입) + 재실 30건 대량 인입</h4>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>총 {6 + customRequirements.length}개 풀을 순환하여 50건 생성</span>
                      </div>
                      <button
                        onClick={async () => {
                          const res: any = await pmsService.bulkSimulate50And30(customRequirements);
                          alert(res.message || '대량 데이터 인입 완료!');
                          void fetchIndicator();
                        }}
                        style={{ padding: '0.6rem 1rem', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
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