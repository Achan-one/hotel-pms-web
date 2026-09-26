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
import CityLedgerView from './components/CityLedgerView';
import {
  LogIn, RefreshCw, Hotel, Clock, Plus, Trash2, ListChecks, CheckCircle2, AlertCircle
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<LoginResponse | null>(() => {
    const saved = sessionStorage.getItem('hotel_pms_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<TabType>('INDICATOR');
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [businessDate, setBusinessDate] = useState('2026-09-20');
  const [simulationTargetDate, setSimulationTargetDate] = useState('2026-09-20');

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
      sessionStorage.setItem('hotel_pms_token', data.token);
      sessionStorage.setItem('hotel_pms_user', JSON.stringify(data));
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
    sessionStorage.removeItem('hotel_pms_token');
    sessionStorage.removeItem('hotel_pms_user');
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

  useEffect(() => {
    if (!currentUser) return;
    pmsService.getSystemBusinessDate()
      .then((serverDate) => {
        if (serverDate) {
          setBusinessDate(serverDate);
          setSimulationTargetDate(serverDate);
        }
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

  const handleBusinessDateChange = async (newDate: string) => {
    setBusinessDate(newDate);
    setSimulationTargetDate(newDate);
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
      const summaryMsg = `일괄 배정 완료: 성공 ${successCount}건 / 실패 ${failCount}건 (${businessDate})`;

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

  // 🚀 나이트 오딧 사전 검증 및 미체크인 이월 파이프라인 (0박 보존 & 화면 자동 갱신)
  const handleRunNightAudit = async () => {
    setIsNightAuditing(true);
    try {
      // 1. 당일 미체크인 도착 예정 건수 사전 점검
      const checkResult = await pmsService.checkUncheckedArrivals(businessDate);

      if (checkResult.uncheckedCount > 0) {
        const confirmRollover = confirm(
          `[나이트 오딧 실행 보류 알림]\n\n` +
          `현재 영업일자(${businessDate})에 도착 예정이었으나 체크인되지 않은 예약이 ${checkResult.uncheckedCount}건 남아있습니다.\n\n` +
          `미체크인 예약을 [내일 체크인 / 1박 차감]으로 이월하시겠습니까?\n` +
          `* 1박 예약은 취소되지 않고 '0박 (새벽 도착 / 당일 오전 아웃)'으로 객실이 안전하게 보존됩니다.\n\n` +
          `[확인]을 누르면 이월 처리 후 나이트 오딧이 진행됩니다.`
        );

        if (!confirmRollover) {
          setIsNightAuditing(false);
          return;
        }

        const rolloverRes = await pmsService.rolloverUncheckedArrivals(businessDate);
        alert(`총 ${rolloverRes.processedCount}건의 미체크인 예약이 이월되었습니다. 나이트 오딧을 시작합니다.`);
      }

      // 2. 나이트 오딧 본 실행
      const res = await pmsService.runNightAudit(businessDate);
      const audit = res.data;
      alert(
        `[야간 마감 완료]\n` +
        `- 재실 룸차지 포스팅: ${audit.roomChargePostedCount}실 (총 ¥${audit.totalRoomRevenuePosted.toLocaleString()})\n` +
        `- 공식 영업일자 전진: ${audit.newBusinessDate}`
      );

      // 화면 즉시 동기화 (로그아웃하지 않고 현재 인디케이터 리로드)
      setBusinessDate(audit.newBusinessDate);
      setSimulationTargetDate(audit.newBusinessDate);
      setActiveDetailReservation(null);
      void fetchIndicator();
    } catch (err: any) {
      alert('나이트 오딧 차단/실패: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsNightAuditing(false);
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
      case 'OCCUPIED': return 'bg-[#ffe4e6] border-[#f43f5e] text-[#9f1239]';
      case 'ASSIGNED': return 'bg-[#e0f2fe] border-[#0284c7] text-[#0369a1]';
      case 'OUT': return 'bg-[#fef3c7] border-[#d97706] text-[#b45309]';
      case 'CLEANING': return 'bg-[#ccfbf1] border-[#0d9488] text-[#115e59]';
      case 'BREAK': return 'bg-[#e2e8f0] border-[#64748b] text-[#334155]';
      case 'BLOCKED': return 'bg-[#f3e8ff] border-[#9333ea] text-[#6b21a8]';
      case 'VACANT':
      default: return 'bg-[#ecfdf5] border-[#10b981] text-[#047857]';
    }
  };

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 font-sans text-slate-800">
        <form onSubmit={handleLogin} className="w-[360px] rounded border border-slate-300 bg-white p-8 shadow-sm">
          <div className="mb-5 flex items-center gap-2.5">
            <Hotel className="h-6 w-6 text-slate-800" />
            <h2 className="text-xl font-bold tracking-tight text-slate-900">HOTEL PMS</h2>
          </div>
          <p className="mb-5 text-xs text-slate-500">프론트 데스크 운영 시스템 로그인</p>
          {loginError && (
            <div className="mb-4 rounded border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-700">
              {loginError}
            </div>
          )}
          <div className="mb-3.5">
            <label className="mb-1 block text-xs font-semibold text-slate-700">사번 (ID)</label>
            <input
              type="text"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="예: admin"
              className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>
          <div className="mb-5">
            <label className="mb-1 block text-xs font-semibold text-slate-700">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded bg-slate-900 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            <LogIn size={15} /> 로그인
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#f1f5f9] font-sans text-slate-800">
      
      {/* 우측 상단 토스트 */}
      {(isAssigning || assignToast) && (
        <div className={`pointer-events-none fixed top-3 right-6 z-50 flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold shadow-md ${
          isAssigning ? 'border-sky-300 bg-white text-sky-800' : assignToast?.isError ? 'border-rose-300 bg-white text-rose-800' : 'border-emerald-300 bg-white text-emerald-800'
        }`}>
          {isAssigning ? (
            <>
              <RefreshCw size={13} className="animate-spin text-sky-600" />
              <span>일괄 자동 배정 처리 중...</span>
            </>
          ) : (
            <>
              {assignToast?.isError ? <AlertCircle size={14} className="text-rose-600" /> : <CheckCircle2 size={14} className="text-emerald-600" />}
              <span>{assignToast?.message}</span>
            </>
          )}
        </div>
      )}

      {/* 사이드바 */}
      <div className="h-screen w-[230px] shrink-0">
        <Sidebar currentUser={currentUser} activeTab={activeTab} onSelectTab={(tab) => navigateTo(tab, null)} onLogout={handleLogout} />
      </div>

      {/* 메인 뷰포트 영역 */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-[#f1f5f9]">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-500" />
              <span className="text-xs font-bold text-slate-700">공식 영업일자:</span>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => void handleBusinessDateChange(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <button
              onClick={handleRunNightAudit}
              disabled={isNightAuditing}
              title="야간 일일 마감: 미체크인 예약 익일 이월(0박/1박 차감) 후 재실 룸차지 포스팅 및 영업일자 전진"
              className={`flex items-center gap-1 rounded border border-rose-300 px-2.5 py-0.5 text-xs font-semibold transition ${
                isNightAuditing ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <RefreshCw size={12} className={isNightAuditing ? 'animate-spin' : ''} />
              {isNightAuditing ? '마감 정산 중...' : '나이트 오딧 실행'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>정상 운영 (Live)</span>
          </div>
        </header>

        <main className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden p-3.5 ${activeTab === 'INDICATOR' ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
          {activeDetailReservation ? (
            <ReservationDetailView
              reservation={activeDetailReservation}
              businessDate={businessDate}
              onBack={() => { setActiveDetailReservation(null); void fetchIndicator(); }}
              onUpdated={() => { void fetchIndicator(); }}
            />
          ) : (
            <>
              {/* 1. 191실 룸 매트릭스 탭 */}
              {activeTab === 'INDICATOR' && (
                <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2">
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-300 pb-2">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-bold text-slate-900">191실 객실 운영 매트릭스 (Room Rack)</h2>
                      {indicatorData && (
                        <div className="flex items-center gap-3 text-xs bg-white border border-slate-300 px-3 py-1 rounded shadow-2xs">
                          <span>총 객실 <b className="font-bold text-slate-900">{indicatorData.totalRooms}</b></span>
                          <span className="text-slate-300">|</span>
                          <span>재실 <b className="font-bold text-rose-600">{indicatorData.occupiedRooms}</b></span>
                          <span className="text-slate-300">|</span>
                          <span>공실 <b className="font-bold text-emerald-600">{indicatorData.vacantRooms}</b></span>
                          <span className="text-slate-300">|</span>
                          <span>점유율 <b className="font-bold text-blue-700">{indicatorData.occupancyRatePercent}%</b></span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-medium">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs border border-emerald-500 bg-emerald-50" /> 공실(VAC)</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs border border-blue-500 bg-blue-50" /> 배정(ASG)</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs border border-rose-500 bg-rose-50" /> 재실(OCC)</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs border border-teal-500 bg-teal-50" /> 청소(CLN)</span>
                      <button
                        onClick={() => void fetchIndicator()}
                        className="ml-2 flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                      >
                        <RefreshCw size={12} className={indicatorLoading ? 'animate-spin' : ''} /> 새로고침
                      </button>
                    </div>
                  </div>

                  {indicatorData && (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-slate-300 bg-slate-200/60 p-1.5 shadow-xs">
                      
                      {/* 가로 축 호수 헤더 */}
                      <div className="flex items-center gap-1 pb-1 border-b border-slate-300/80 mb-1">
                        <div className="w-10 min-w-[40px] text-center text-[10px] font-bold text-slate-500 uppercase">
                          층 / 호
                        </div>
                        <div className="grid flex-1 grid-cols-16 gap-1">
                          {Array.from({ length: 16 }, (_, i) => i + 1).map((r) => (
                            <div
                              key={r}
                              className={`text-center font-mono text-[10px] font-bold ${
                                r === 13 ? 'text-slate-400' : 'text-slate-600'
                              }`}
                            >
                              {r < 10 ? `0${r}` : `${r}`}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 층별 행 렌더링 */}
                      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1">
                        {Object.entries(indicatorData.floorRooms)
                          .sort(([a], [b]) => Number(b) - Number(a))
                          .map(([floorStr, rooms]) => {
                            const floor = Number(floorStr);
                            const prefix = floor < 10 ? `0${floor}` : `${floor}`;
                            const roomMap = new Map(rooms.map((r) => [r.roomNumber, r]));

                            return (
                              <div key={floor} className="flex min-h-0 flex-1 items-stretch gap-1">
                                <div className="flex w-10 min-w-[40px] select-none items-center justify-center rounded border border-slate-300 bg-slate-100 font-mono text-xs font-extrabold text-slate-700 shadow-2xs">
                                  {floor}F
                                </div>

                                <div className="grid flex-1 grid-cols-16 gap-1">
                                  {Array.from({ length: 16 }, (_, rIdx) => rIdx + 1).map((r) => {
                                    const padRoom = r < 10 ? `0${r}` : `${r}`;
                                    const roomNo = `${prefix}${padRoom}`;

                                    if (r === 13) {
                                      return (
                                        <div
                                          key={r}
                                          title="13호 서양권 금기 결번"
                                          className="flex h-full select-none items-center justify-center rounded border border-dashed border-slate-300 bg-slate-100/60 font-mono text-[10px] text-slate-400"
                                        >
                                          결번
                                        </div>
                                      );
                                    }

                                    if (floor >= 14 && (r === 3 || r === 7)) {
                                      return (
                                        <div
                                          key={r}
                                          title="공조/설비실 결번"
                                          className="flex h-full select-none items-center justify-center rounded border border-slate-300 bg-slate-200/80 font-mono text-[9px] font-semibold text-slate-500"
                                        >
                                          설비
                                        </div>
                                      );
                                    }

                                    const room = roomMap.get(roomNo);
                                    if (!room) return <div key={roomNo} className="h-full min-w-0" />;

                                    const typeCode =
                                      room.roomType === 'EXECUTIVE_DOUBLE' ? 'EXC' :
                                      room.roomType === 'SUPERIOR_TWIN' ? 'TWN' :
                                      room.roomType === 'RESIDENTIAL_DOUBLE' ? 'RSD' :
                                      room.roomType === 'SUPERIOR_DOUBLE' ? 'SDB' : 'MOD';

                                    return (
                                      <div
                                        key={room.roomNumber}
                                        title={`[${room.roomNumber}호] ${room.roomTypeName}\n상태: ${room.status}${room.guestName ? `\n고객명: ${room.guestName}` : ''}`}
                                        className={`flex h-full min-w-0 select-none flex-col justify-between rounded border px-1 py-0.5 shadow-2xs transition hover:brightness-95 ${getStatusClass(room.status)}`}
                                      >
                                        <div className="flex items-center justify-between border-b border-black/5 pb-0.5 leading-none">
                                          <span className="font-mono text-[11px] font-extrabold tracking-tight text-slate-900">
                                            {room.roomNumber}
                                          </span>
                                          <span className="font-mono text-[8px] font-bold opacity-60">
                                            {typeCode}
                                          </span>
                                        </div>

                                        <div className="truncate text-center text-[9px] font-semibold leading-none pt-0.5">
                                          {room.guestName ? (
                                            <span className="truncate">{room.guestName}</span>
                                          ) : (
                                            <span className="opacity-40">-</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
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

              {/* 3. 일괄 배정 탭 */}
              {activeTab === 'BATCH_ASSIGN' && (
                <div className="max-w-[560px] rounded border border-slate-300 bg-white p-6 shadow-xs">
                  <h2 className="mb-1.5 text-base font-bold text-slate-900">규칙 기반 일괄 자동 배정</h2>
                  <p className="mb-5 text-xs text-slate-600 leading-relaxed">
                    호텔 공식 영업일자({businessDate}) 기준 미배정 예약 전체를 대상으로 선호도 및 연박 보호 규칙을 계산하여 빈 객실을 자동 배정합니다.
                  </p>
                  <button
                    onClick={handleBatchAssign}
                    disabled={isAssigning}
                    className={`flex w-full items-center justify-center gap-2 rounded p-2.5 text-xs font-bold transition ${
                      isAssigning ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isAssigning ? '일괄 분석 및 배정 진행 중...' : `${businessDate} 미배정 예약 일괄 배정 실행`}
                  </button>
                </div>
              )}

              {/* 4. 태그 사전 관리 탭 */}
              {activeTab === 'TAGS' && <TagManagementView />}

              {/* 5. 직원 계정 발급 탭 */}
              {activeTab === 'STAFF_MGMT' && <StaffManagementView />}
              {activeTab === 'CITY_LEDGER' && <CityLedgerView />}
              
              {/* 6. 데이터 엑스포트 탭 */}
              {activeTab === 'EXPORT' && <ExportReportView businessDate={businessDate} />}

              {/* 7. Dev Mode (개발자 전용 테스트 랩) */}
              {activeTab === 'SIMULATION' && (
                <div className="flex w-full flex-col gap-3 font-sans text-slate-800">
                  <div className="flex items-center justify-between rounded border border-slate-300 bg-white p-4 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900">Dev Mode (개발 및 연동 검증 랩)</h2>
                        <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                          DEVELOPMENT ONLY
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        개발 및 테스트 목적으로 가상 예약을 인입하고, 대량 배치 파싱 및 초기화를 수행하는 개발자 전용 콘솔입니다.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {/* 좌측: 고객 요청사항 인입 풀 */}
                    <div className="flex flex-col gap-2.5 rounded border border-slate-300 bg-white p-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <ListChecks size={16} className="text-blue-700" />
                          <h3 className="text-xs font-bold text-slate-900">
                            고객 요청사항 인입 풀 (기본 6건 + 사용자 정의 {customRequirements.length}건)
                          </h3>
                        </div>
                        <span className="text-[11px] text-slate-400">대량 생성 시 순환 매핑</span>
                      </div>

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="새 요청사항 입력 (예: 롯데타워 전망 희망, 침대 가드 요청)"
                          value={customRequirementInput}
                          onChange={(e) => setCustomRequirementInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.nativeEvent.isComposing) return;
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomRequirement();
                            }
                          }}
                          className="flex-1 rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={addCustomRequirement}
                          className="flex items-center gap-1 rounded bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          <Plus size={13} /> 추가
                        </button>
                      </div>

                      <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto rounded border border-slate-200 bg-slate-50/70 p-2">
                        <div className="text-[10px] font-bold text-slate-400 px-1 pt-1">
                          [기본 탑재 시스템 메모 6건]
                        </div>
                        {[
                          "어머니 무릎이 안 좋으셔서 엘리베이터 가깝고 낮은 층으로 부탁드립니다.",
                          "High floor with a nice Tokyo Tower view please!",
                          "조용한 안쪽 방으로 주세요.",
                          "도쿄타워 보이는 방으로 꼭 부탁드립니다.",
                          "아기 동반이라 소음 없는 방 원합니다.",
                          "(요청사항 없음 - 일반 고객)"
                        ].map((baseNote, idx) => (
                          <div key={`base-${idx}`} className="flex items-center justify-between rounded border border-slate-200 bg-slate-100/60 px-2.5 py-1.5 text-xs text-slate-600">
                            <span className="truncate">
                              <span className="mr-1.5 font-mono text-[10px] text-slate-400">기본 #{idx + 1}</span>
                              {baseNote}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">고정</span>
                          </div>
                        ))}

                        {customRequirements.length > 0 && (
                          <>
                            <div className="text-[10px] font-bold text-blue-700 px-1 pt-2 border-t border-slate-200 mt-1">
                              [사용자 정의 추가 메모 {customRequirements.length}건]
                            </div>
                            {customRequirements.map((reqText, idx) => (
                              <div key={idx} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-2xs">
                                <span className="text-slate-800 font-medium truncate">
                                  <span className="mr-1.5 font-mono font-bold text-blue-700">커스텀 #{idx + 1}</span>
                                  {reqText}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeCustomRequirement(idx)}
                                  className="text-slate-400 hover:text-rose-600 p-0.5 shrink-0"
                                  title="삭제"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>

                    {/* 우측: 시나리오 제어 패널 */}
                    <div className="flex flex-col gap-2.5 rounded border border-slate-300 bg-white p-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="text-xs font-bold text-slate-900">시나리오 인입 및 초기화 제어</h3>
                        <span className="text-[11px] text-slate-400">DB 실시간 누적 반영</span>
                      </div>

                      {/* 시나리오 1: 5건 샘플 추가 */}
                      <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50/70 p-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">1. 기본 검증용 샘플 데이터 추가 주입 (5건)</h4>
                          <p className="text-[11px] text-slate-500">
                            영업일자({businessDate}) 기준 샘플 예약 5건을 기존 원장에 누적 추가합니다.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            await pmsService.seedSampleReservations(businessDate);
                            alert(`영업일자(${businessDate}) 기준 샘플 데이터 5건 추가 적재 완료`);
                            void fetchIndicator();
                          }}
                          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100"
                        >
                          + 5건 추가
                        </button>
                      </div>

                      {/* 시나리오 2: 날짜 선택 가능한 50건 누적 인입 */}
                      <div className="flex flex-col gap-2 rounded border border-blue-200 bg-blue-50/60 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-blue-900">2. 신규 예약 50건 대량 인입 (누적 추가)</h4>
                            <p className="text-[11px] text-blue-700">
                              이전 예약을 삭제하지 않고 지정한 체크인 일자로 50건을 누적 추가합니다.
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              const res: any = await pmsService.bulkSimulate50And30(customRequirements, simulationTargetDate);
                              alert(res.message || `${simulationTargetDate} 기준 50건 인입 완료`);
                              void fetchIndicator();
                            }}
                            className="rounded bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                          >
                            + 50건 인입 실행
                          </button>
                        </div>

                        {/* 인입 날짜 선택 인풋 */}
                        <div className="flex items-center gap-2 border-t border-blue-200/60 pt-2 text-xs">
                          <span className="font-semibold text-blue-950">인입 체크인 일자:</span>
                          <input
                            type="date"
                            value={simulationTargetDate}
                            onChange={(e) => setSimulationTargetDate(e.target.value)}
                            className="rounded border border-blue-300 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slate-900 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setSimulationTargetDate(businessDate)}
                            className="text-[11px] text-blue-700 underline hover:text-blue-900"
                          >
                            현재 영업일자로 맞춤
                          </button>
                        </div>
                      </div>

                      {/* 시나리오 3: 예약 원장만 초기화 */}
                      <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50/70 p-3 mt-1">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">3. 예약 원장 초기화</h4>
                          <p className="text-[11px] text-slate-500">모든 예약을 삭제하고 191실을 공실(VACANT)로 리셋합니다.</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm('정말 모든 예약 내역을 초기화하시겠습니까?')) return;
                            await pmsService.clearReservations();
                            void fetchIndicator();
                            alert('모든 예약 데이터가 초기화되었습니다.');
                          }}
                          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100"
                        >
                          예약만 초기화
                        </button>
                      </div>

                      {/* 시나리오 4: 모든 설정 완벽 초기화 */}
                      <div className="flex items-center justify-between rounded border border-rose-300 bg-rose-50/70 p-3 mt-1">
                        <div>
                          <h4 className="text-xs font-bold text-rose-800">4. 모든 설정 및 데이터 완벽 초기화 (Full Reset)</h4>
                          <p className="text-[11px] text-rose-600">
                            예약 전량 삭제 + 커스텀 태그 삭제 + 191실 공실화 + 영업일자(2026-09-20) 롤백
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm('⚠️ 주의: 모든 예약, 커스텀 태그가 영구 삭제되고 시스템 날짜가 2026-09-20으로 복원됩니다. 계속하시겠습니까?')) return;
                            const res = await pmsService.resetAllSettings();
                            alert(res.message);
                            setBusinessDate(res.businessDate);
                            setSimulationTargetDate(res.businessDate);
                            void fetchIndicator();
                          }}
                          className="rounded bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-rose-700"
                        >
                          전체 설정 리셋
                        </button>
                      </div>

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