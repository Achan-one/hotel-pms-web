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
  LogIn, RefreshCw, Hotel, Sparkles, Clock, Plus, Trash2, ListChecks, CheckCircle2, AlertCircle, Moon, Dices
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

  // 1. 공식 영업일자 State (서버 DB와 실시간 동기화)
  const [businessDate, setBusinessDate] = useState('2026-09-20');

  const [indicatorData, setIndicatorData] = useState<FloorMapResponseDto | null>(null);
  const [indicatorLoading, setIndicatorLoading] = useState(false);

  const [activeDetailReservation, setActiveDetailReservation] = useState<ReservationDetailDto | null>(null);

  const [isAssigning, setIsAssigning] = useState(false);
  const [isNightAuditing, setIsNightAuditing] = useState(false);
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

  // 2. 로그인 시 서버 DB의 공식 영업일자 조회하여 단일 진실 공급원 동기화
  useEffect(() => {
    if (!currentUser) return;
    pmsService.getSystemBusinessDate()
      .then((serverDate) => {
        if (serverDate) setBusinessDate(serverDate);
      })
      .catch((err) => console.error('시스템 영업일자 조회 실패:', err));
  }, [currentUser]);

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

  // 3. 헤더 인풋에서 영업일자를 변경할 때 서버 DB에도 즉시 동기화
  const handleBusinessDateChange = async (newDate: string) => {
    setBusinessDate(newDate);
    try {
      await pmsService.setSystemBusinessDate(newDate);
    } catch (err) {
      console.error('영업일자 서버 DB 동기화 실패:', err);
    }
  };

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

  // 4. 나이트 오딧 실행 핸들러 (서버 DB가 이미 익일 롤오버 처리함)
  const handleRunNightAudit = async () => {
    if (!confirm(`[주의] ${businessDate} 기준 나이트 오딧을 실행하시겠습니까?\n\n1. 미체크인 당일 도착건: 노쇼 취소 및 방 반납\n2. 재실 고객: 1박 객실료 자동 청구\n3. 영업일자: 익일로 자동 변경`)) return;

    setIsNightAuditing(true);
    try {
      const res = await pmsService.runNightAudit(businessDate);
      const audit = res.data;
      alert(`🌙 [나이트 오딧 마감 완료]\n- 노쇼 취소: ${audit.noShowCount}건\n- 룸차지 포스팅: ${audit.roomChargePostedCount}실 (총 ¥${audit.totalRoomRevenuePosted.toLocaleString()})\n- 신규 영업일자: ${audit.newBusinessDate}`);
      setBusinessDate(audit.newBusinessDate);
      void fetchIndicator();
    } catch (err: any) {
      alert('나이트 오딧 실패: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsNightAuditing(false);
    }
  };

  const handleGenerateDynamic50 = async () => {
    if (!confirm(`현재 선택된 영업일자(${businessDate})를 기준으로 50명의 고유 실명 및 OTA(Agoda, Booking 등) 예약을 생성하시겠습니까?`)) return;
    try {
      const res = await pmsService.generateDynamicTestData(businessDate);
      alert(res.message || `${businessDate} 기준 50인 예약 생성 완료!`);
      void fetchIndicator();
    } catch (err: any) {
      alert('데이터 생성 실패: ' + (err.response?.data?.message || err.message));
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

  const getStatusClass = (status: RoomMatrixItemDto['status']) => {
    switch (status) {
      case 'OCCUPIED': return 'bg-[#450a0a] border-red-500 text-red-300';
      case 'ASSIGNED': return 'bg-[#172554] border-blue-500 text-blue-300';
      case 'OUT': return 'bg-[#451a03] border-amber-500 text-amber-300';
      case 'CLEANING': return 'bg-[#083344] border-cyan-500 text-cyan-300';
      case 'BREAK': return 'bg-zinc-800 border-zinc-500 text-zinc-300';
      case 'BLOCKED': return 'bg-purple-950 border-purple-500 text-purple-300';
      case 'VACANT':
      default: return 'bg-emerald-950 border-emerald-500 text-emerald-300';
    }
  };

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <form onSubmit={handleLogin} className="w-[380px] rounded-xl border border-white/10 bg-slate-800 p-10 text-slate-100 shadow-2xl">
          <div className="mb-6 flex items-center gap-2.5">
            <Hotel className="h-8 w-8 text-sky-400" />
            <h2 className="text-2xl font-bold">HOTEL PMS</h2>
          </div>
          <p className="mb-6 text-sm text-slate-400">프론트 데스크 운영 시스템 로그인</p>
          {loginError && (
            <div className="mb-4 rounded-md border border-red-700 bg-red-900/60 p-3 text-sm text-red-200">
              {loginError}
            </div>
          )}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-semibold text-slate-300">직원 ID</label>
            <input
              type="text"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="예: admin"
              className="w-full rounded-md border border-slate-600 bg-slate-900 p-3 text-sm text-white focus:border-sky-400"
              required
            />
          </div>
          <div className="mb-6">
            <label className="mb-2 block text-xs font-semibold text-slate-300">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="hotel1234"
              className="w-full rounded-md border border-slate-600 bg-slate-900 p-3 text-sm text-white focus:border-sky-400"
              required
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 p-3 font-semibold text-white transition hover:bg-sky-500"
          >
            <LogIn size={18} /> 로그인
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#0b1329] text-slate-100">
      
      {/* 🔮 우측 상단 플로팅 백그라운드 태스크 위젯 */}
      {(isAssigning || assignToast) && (
        <div className={`pointer-events-none fixed top-3 right-6 z-50 flex items-center gap-3 rounded-lg border px-4 py-2.5 text-xs font-semibold text-slate-100 shadow-2xl ${
          isAssigning ? 'border-purple-500 bg-[#1e1b4b]' : assignToast?.isError ? 'border-red-500 bg-[#450a0a]' : 'border-emerald-500 bg-[#064e3b]'
        }`}>
          {isAssigning ? (
            <>
              <Sparkles size={18} className="spin text-purple-400" />
              <div>
                <div className="font-bold text-purple-300">AI 일괄 배정 엔진 연산 중...</div>
                <div className="text-[11px] text-slate-300">다른 화면으로 이동하셔도 백그라운드에서 완료됩니다</div>
              </div>
            </>
          ) : (
            <>
              {assignToast?.isError ? <AlertCircle size={18} className="text-red-400" /> : <CheckCircle2 size={18} className="text-emerald-400" />}
              <span>{assignToast?.message}</span>
            </>
          )}
        </div>
      )}

      {/* 사이드바 */}
      <div className="h-screen w-[260px] shrink-0">
        <Sidebar currentUser={currentUser} activeTab={activeTab} onSelectTab={(tab) => navigateTo(tab, null)} onLogout={handleLogout} />
      </div>

      {/* 메인 뷰포트 영역 */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-900 px-8 py-3">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-sky-400" />
              <span className="text-xs font-semibold text-slate-400">호텔 공식 영업일자:</span>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => void handleBusinessDateChange(e.target.value)}
                className="rounded-md border border-sky-400/40 bg-slate-800 px-3 py-1 text-sm font-bold text-sky-400 focus:border-sky-400"
              />
            </div>

            {/* 🌙 나이트 오딧 실행 버튼 */}
            <button
              onClick={handleRunNightAudit}
              disabled={isNightAuditing}
              title="야간 일일 마감: 당일 노쇼 자동 취소, 재실 숙박료 정산, 영업일자 익일 롤오버"
              className={`flex items-center gap-1.5 rounded-md border border-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-md transition ${
                isNightAuditing ? 'cursor-not-allowed bg-red-900' : 'bg-red-800 hover:bg-red-700'
              }`}
            >
              <Moon size={14} className={isNightAuditing ? 'spin' : ''} />
              {isNightAuditing ? '마감 정산 중...' : '나이트 오딧 실행'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-slate-500">모든 체크인, 룸체인지, 배정의 기준일자</span>
          </div>
        </header>

        <main className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden p-5 px-8 ${activeTab === 'INDICATOR' ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
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
                <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2">
                  <div className="flex shrink-0 items-center justify-between">
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-lg font-bold text-slate-100">191실 룸 인디케이터</h2>
                      <span className="text-xs text-slate-400">기준 영업일자: {businessDate}</span>
                    </div>

                    <div className="flex items-center gap-3.5 text-xs">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" /> 공실</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs bg-blue-500" /> 배정완료</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs bg-red-500" /> 재실(투숙중)</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs bg-cyan-500" /> 청소중</span>
                      <button
                        onClick={() => void fetchIndicator()}
                        className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
                      >
                        <RefreshCw size={14} className={indicatorLoading ? 'spin' : ''} /> 새로고침
                      </button>
                    </div>
                  </div>

                  {indicatorData && (
                    <div className="flex shrink-0 gap-7 rounded-lg border border-white/10 bg-[#131d36] px-5 py-2 text-xs">
                      <span>총 객실: <b className="font-bold">{indicatorData.totalRooms}실</b></span>
                      <span className="text-red-400">점유: <b className="font-bold">{indicatorData.occupiedRooms}실</b></span>
                      <span className="text-emerald-400">공실: <b className="font-bold">{indicatorData.vacantRooms}실</b></span>
                      <span className="text-sky-400">점유율: <b className="font-bold">{indicatorData.occupancyRatePercent}%</b></span>
                    </div>
                  )}

                  {indicatorData && (
                    <div className="flex min-h-0 flex-1 flex-col gap-1 rounded-xl border border-white/10 bg-[#131d36] p-3">
                      {Object.entries(indicatorData.floorRooms)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .map(([floorStr, rooms]) => {
                          const floor = Number(floorStr);
                          const prefix = floor < 10 ? `0${floor}` : `${floor}`;
                          const roomMap = new Map(rooms.map((r) => [r.roomNumber, r]));

                          return (
                            <div key={floor} className="flex min-h-0 flex-1 items-stretch gap-1.5">
                              <div className="flex h-full w-11 min-w-[44px] select-none items-center justify-center rounded border border-[#293548] bg-[#0b1329] text-xs font-extrabold text-sky-400">
                                {floor}F
                              </div>

                              <div className="grid flex-1 grid-cols-16 gap-1">
                                {Array.from({ length: 16 }, (_, rIdx) => rIdx + 1).map((r) => {
                                  const padRoom = r < 10 ? `0${r}` : `${r}`;
                                  const roomNo = `${prefix}${padRoom}`;

                                  if (r === 13) {
                                    return (
                                      <div key={r} title="13호 결번" className="flex h-full select-none items-center justify-center rounded border border-dashed border-[#293548] bg-[#0b1329]/40 text-xs text-slate-600">
                                        -
                                      </div>
                                    );
                                  }

                                  if (floor >= 14 && (r === 3 || r === 7)) {
                                    return (
                                      <div key={r} title="설비/공조실 결번" className="flex h-full select-none items-center justify-center rounded border border-dashed border-slate-700 bg-[#131d36]/40 text-[11px] text-slate-500">
                                        설비
                                      </div>
                                    );
                                  }

                                  const room = roomMap.get(roomNo);
                                  if (!room) return <div key={roomNo} className="h-full min-w-0" />;

                                  const tooltipText = `[${room.roomNumber}호] ${room.roomTypeName}\n상태: ${room.status}${room.guestName ? `\n투숙객: ${room.guestName}` : ''}`;

                                  return (
                                    <div
                                      key={room.roomNumber}
                                      title={tooltipText}
                                      className={`flex h-full min-w-0 select-none flex-col items-center justify-center rounded border px-1 py-0.5 leading-tight ${getStatusClass(room.status)}`}
                                    >
                                      <span className="text-xs font-extrabold tracking-tight text-white">
                                        {room.roomNumber}
                                      </span>
                                      {room.guestName && (
                                        <span className="mt-0.5 block max-w-full truncate text-[10px] opacity-90">
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
                <div className="max-w-[600px] rounded-xl border border-white/10 bg-[#131d36] p-8">
                  <div className="mb-4 flex items-center gap-2.5">
                    <Sparkles className="h-7 w-7 text-purple-400" />
                    <h2 className="text-xl font-bold text-slate-100">규칙 기반 AI 일괄 배정</h2>
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-slate-400">
                    호텔 공식 영업일자({businessDate}) 기준 미배정 예약 전체를 대상으로 선호도 및 연박 보호 규칙을 계산하여 빈 객실을 일괄 자동 배정합니다.
                  </p>
                  <button
                    onClick={handleBatchAssign}
                    disabled={isAssigning}
                    className={`flex w-full items-center justify-center gap-2 rounded-md p-3.5 font-bold text-white transition ${
                      isAssigning ? 'cursor-not-allowed bg-purple-900' : 'bg-purple-600 hover:bg-purple-500'
                    }`}
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
                <div className="flex max-w-[900px] flex-col gap-6">
                  <div className="rounded-xl border border-white/10 bg-[#131d36] p-8">
                    <h2 className="mb-2 text-xl font-bold text-slate-100">
                      🧪 OTA & 채널 매니저(CMS) 연동 테스트 랩
                    </h2>
                    <p className="text-xs text-slate-400">
                      가상 채널 인입 전문과 대량 예약 생성 시나리오를 실행하여 배정 로직과 Gemini 태그 파싱을 검증합니다.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#131d36] p-7">
                    <div className="mb-2 flex items-center gap-2 text-sky-400">
                      <ListChecks size={22} />
                      <h3 className="text-base font-bold">테스트 케이스 요구사항 인입 콘솔 (50건 순환 주입 풀)</h3>
                    </div>
                    <p className="mb-5 text-xs leading-relaxed text-slate-400">
                      테스트하고 싶은 고객 요청사항을 아래에 추가하세요. (한글 조합 엔터 중복 방어 적용 완료)
                    </p>

                    <div className="mb-5 flex gap-2">
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
                        className="flex-1 rounded-md border border-[#293548] bg-[#0b1329] p-3 text-xs text-white focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={addCustomRequirement}
                        className="flex items-center gap-1.5 rounded-md bg-sky-600 px-5 py-3 text-xs font-semibold text-white hover:bg-sky-500"
                      >
                        <Plus size={16} /> 추가
                      </button>
                    </div>

                    <div className="flex max-h-[200px] flex-col gap-1.5 overflow-y-auto rounded-lg border border-[#293548] bg-[#0b1329] p-3">
                      {customRequirements.map((reqText, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-md bg-[#131d36] px-3.5 py-2 text-xs">
                          <span className="text-slate-300">
                            <b className="mr-2 text-sky-400">#{idx + 1}</b>
                            {reqText}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCustomRequirement(idx)}
                            className="p-1 text-red-400 transition hover:text-red-300"
                            title="삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 rounded-xl border border-white/10 bg-[#131d36] p-7">
                    
                    {/* 🚀 50인 동적 시드 생성 */}
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/50 bg-[#0b1329] p-5">
                      <div>
                        <h4 className="mb-1 text-sm font-bold text-emerald-400">0. 기준일자({businessDate}) 50인 고유 실명 & OTA 다변화 시드 생성</h4>
                        <span className="text-xs text-slate-400">
                          중복 없는 일본/다국적 50명 실명, OTA 6개사(Agoda 등), 당일/재실/미래 일정 자동 배분
                        </span>
                      </div>
                      <button
                        onClick={handleGenerateDynamic50}
                        className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500"
                      >
                        <Dices size={16} /> 50인 시드 생성
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-[#293548] bg-[#0b1329] p-5">
                      <div>
                        <h4 className="mb-1 text-sm font-bold text-sky-400">1. 기본 시나리오 샘플 데이터 세팅</h4>
                        <span className="text-xs text-slate-400">영업일자({businessDate}) 기준 샘플 5건 주입</span>
                      </div>
                      <button
                        onClick={async () => {
                          await pmsService.seedSampleReservations();
                          alert('샘플 데이터 주입 완료!');
                          void fetchIndicator();
                        }}
                        className="rounded-md bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-500"
                      >
                        데이터 주입
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-[#293548] bg-[#0b1329] p-5">
                      <div>
                        <h4 className="mb-1 text-sm font-bold text-purple-400">2. 신규 50건 (요구사항 순환 주입) + 재실 30건 대량 인입</h4>
                        <span className="text-xs text-slate-400">총 {6 + customRequirements.length}개 풀을 순환하여 50건 생성</span>
                      </div>
                      <button
                        onClick={async () => {
                          const res: any = await pmsService.bulkSimulate50And30(customRequirements);
                          alert(res.message || '대량 데이터 인입 완료!');
                          void fetchIndicator();
                        }}
                        className="rounded-md bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-purple-500"
                      >
                        대량 인입 실행
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-[#293548] bg-[#0b1329] p-5">
                      <div>
                        <h4 className="mb-1 text-sm font-bold text-red-400">3. 전체 데이터 초기화</h4>
                        <span className="text-xs text-slate-400">모든 예약과 191실 객실 상태를 완전한 공실(VACANT)로 리셋합니다.</span>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('정말 모든 데이터를 초기화하시겠습니까?')) return;
                          await pmsService.clearReservations();
                          void fetchIndicator();
                          alert('모든 데이터가 초기화되었습니다.');
                        }}
                        className="rounded-md bg-red-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-red-600"
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