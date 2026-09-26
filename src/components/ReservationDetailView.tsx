import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SubmitEvent } from 'react';
import type { ReservationDetailDto, FolioChargeCodeDto } from '../api/pmsService';
import { pmsService } from '../api/pmsService';
import apiClient from '../api/client';
import {
  ArrowLeft, CheckCircle2, ArrowRightLeft, FileCode, User, KeyRound, UserX, Tag, Plus, Minus, CreditCard, Lock, Eye, Receipt, PlusCircle, MinusCircle, Check, LogOut, AlertTriangle
} from 'lucide-react';

interface Props {
  reservation: ReservationDetailDto;
  businessDate: string;
  onBack: () => void;
  onUpdated: () => void;
}

const formatRoomNumber = (val: string) => {
  const trimmed = val.trim();
  if (trimmed.length === 3 && !isNaN(Number(trimmed))) {
    return '0' + trimmed;
  }
  return trimmed;
};

export default function ReservationDetailView({ reservation: initialReservation, businessDate, onBack, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'OPERATIONAL' | 'FOLIO_LEDGER' | 'CONTRACT_AUDIT'>('OPERATIONAL');
  const [reservation, setReservation] = useState<ReservationDetailDto>(initialReservation);

  const [isLockedByOther, setIsLockedByOther] = useState(false);
  const [lockHolderName, setLockHolderName] = useState('');

  const [opGuestName, setOpGuestName] = useState('');
  const [opCheckIn, setOpCheckIn] = useState('');
  const [opNights, setOpNights] = useState(1);
  const [staffMemo, setStaffMemo] = useState('');

  const [dailyRatesState, setDailyRatesState] = useState<Record<string, number>>({});
  const [isSavingRates, setIsSavingRates] = useState(false);

  const [allTags, setAllTags] = useState<Array<{ code: string; name: string }>>([]);
  const [editPreferredTags, setEditPreferredTags] = useState<Set<string>>(new Set());
  const [editAvoidTags, setEditAvoidTags] = useState<Set<string>>(new Set());
  const [tagSaving, setTagSaving] = useState(false);

  const [assignRoom, setAssignRoom] = useState('');
  const [moveRoom, setMoveRoom] = useState('');
  const [moveReason, setMoveReason] = useState('고객 시설 보상 업그레이드');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [chargeCodes, setChargeCodes] = useState<FolioChargeCodeDto[]>([]);

  // 🚀 모달 제어 상태 (이용 명세 등록 vs 수납 등록)
  const [folioModalMode, setFolioModalMode] = useState<'NONE' | 'CHARGE' | 'PAYMENT'>('NONE');
  const [folioAmount, setFolioAmount] = useState<number>(0);
  const [folioMemo, setFolioMemo] = useState('');
  const [selectedChargeCode, setSelectedChargeCode] = useState<string>('MINIBAR');
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'CASH'>('CREDIT_CARD');
  const [isPostingFolio, setIsPostingFolio] = useState(false);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('hotel_pms_user');
    const userObj = savedUser ? JSON.parse(savedUser) : null;
    const currentStaffId = userObj?.staffId || 'anonymous';
    const currentStaffName = userObj?.staffName || currentStaffId;

    pmsService.acquireLock(initialReservation.reservationId, currentStaffId, currentStaffName)
      .then((res) => {
        if (res.isLockedByOther) {
          setIsLockedByOther(true);
          setLockHolderName(res.lockedByStaffName);
        } else {
          setIsLockedByOther(false);
        }
      })
      .catch((e) => {
        console.error('락 획득 실패:', e);
      });

    return () => {
      void pmsService.releaseLock(initialReservation.reservationId, currentStaffId);
    };
  }, [initialReservation.reservationId]);

  useEffect(() => {
    apiClient.get('/api/admin/tags')
      .then((res) => {
        const list = res.data?.data || [];
        setAllTags(list.map((t: any) => ({ code: t.code, name: t.name })));
      })
      .catch(() => console.error('태그 목록 로드 실패'));

    pmsService.getChargeCodes()
      .then((codes) => {
        setChargeCodes(codes);
        if (codes.length > 0) {
          setSelectedChargeCode(codes[0].code);
        }
      })
      .catch(() => {
        const defaults = [
          { code: 'ROOM_CHARGE', name: '룸 차지', defaultAmount: 0, isSystemDefault: true },
          { code: 'EXTRA_BED', name: '엑스트라 베드', defaultAmount: 3000, isSystemDefault: true },
          { code: 'MINIBAR', name: '미니바', defaultAmount: 1000, isSystemDefault: true },
          { code: 'ROOM_CHANGE', name: '룸 체인지', defaultAmount: 0, isSystemDefault: true },
          { code: 'EARLY_CHECKIN', name: '얼리 체크인', defaultAmount: 2000, isSystemDefault: true },
          { code: 'LATE_CHECKOUT', name: '레이트 체크아웃', defaultAmount: 2000, isSystemDefault: true },
        ];
        setChargeCodes(defaults);
        setSelectedChargeCode('MINIBAR');
      });
  }, []);

  const syncFormState = useCallback((data: ReservationDetailDto) => {
    setReservation(data);
    setOpGuestName(data.operationalGuestName || data.guestName || '');
    const checkIn = data.operationalCheckInDate || data.checkInDate || '';
    setOpCheckIn(checkIn);
    
    const nights = data.operationalStayNights !== undefined ? data.operationalStayNights : (data.stayNights !== undefined ? data.stayNights : 1);
    setOpNights(nights);

    setStaffMemo(data.internalStaffMemo || data.rawRequestText || '');
    setAssignRoom(data.assignedRoomNumber ? data.assignedRoomNumber.replace(/^0/, '') : '');
    setMoveRoom('');

    setEditPreferredTags(new Set(data.tagPreference?.preferredTags || []));
    setEditAvoidTags(new Set(data.tagPreference?.avoidTags || []));

    if (data.dailyRates && Object.keys(data.dailyRates).length > 0) {
      setDailyRatesState(data.dailyRates);
    } else {
      const defaultRates: Record<string, number> = {};
      const baseRate = data.bookedRoomType === 'EXECUTIVE_DOUBLE' ? 28000 : 15000;
      if (checkIn && nights > 0) {
        for (let i = 0; i < nights; i++) {
          const d = new Date(checkIn);
          d.setDate(d.getDate() + i);
          const dateKey = d.toISOString().split('T')[0];
          defaultRates[dateKey] = baseRate;
        }
      }
      setDailyRatesState(defaultRates);
    }
  }, []);

  useEffect(() => {
    syncFormState(initialReservation);
  }, [initialReservation, syncFormState]);

  const reloadCurrentReservation = async () => {
    try {
      const refreshed = await pmsService.getReservationDetail(reservation.reservationId);
      syncFormState(refreshed);
      onUpdated();
    } catch {
      console.error('현재 예약 상세 재동기화 실패');
    }
  };

  const handleSaveDailyRates = async () => {
    if (isLockedByOther) return;
    setIsSavingRates(true);
    setMsg('');
    try {
      await pmsService.updateDailyRates(reservation.reservationId, dailyRatesState);
      alert('일자별 1박 객실료 스케줄이 성공적으로 갱신되었습니다.');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || '요금 스케줄 갱신 실패');
      }
    } finally {
      setIsSavingRates(false);
    }
  };

  const cycleTagState = (tagCode: string) => {
    if (isLockedByOther) return;
    if (editPreferredTags.has(tagCode)) {
      setEditPreferredTags((prev) => {
        const next = new Set(prev);
        next.delete(tagCode);
        return next;
      });
      setEditAvoidTags((prev) => new Set(prev).add(tagCode));
    } else if (editAvoidTags.has(tagCode)) {
      setEditAvoidTags((prev) => {
        const next = new Set(prev);
        next.delete(tagCode);
        return next;
      });
    } else {
      setEditPreferredTags((prev) => new Set(prev).add(tagCode));
    }
  };

  const handleSaveOperationalTags = async () => {
    if (isLockedByOther) return;
    setTagSaving(true);
    setMsg('');
    try {
      await pmsService.updateOperationalTags(reservation.reservationId, {
        preferredTags: Array.from(editPreferredTags),
        avoidTags: Array.from(editAvoidTags),
      });
      alert('현장 운영 태그가 저장되었습니다.');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '태그 갱신 실패');
      }
    } finally {
      setTagSaving(false);
    }
  };

  const handleSaveOperational = async (e: SubmitEvent) => {
    e.preventDefault();
    if (isLockedByOther) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.updateOperationalOverride(reservation.reservationId, {
        operationalGuestName: opGuestName,
        operationalCheckInDate: opCheckIn,
        operationalStayNights: Number(opNights),
        internalStaffMemo: staffMemo,
      });
      alert('PMS 현장 투숙 정보가 저장되었습니다.');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '운영 정보 저장 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualAssign = async (e: SubmitEvent) => {
    e.preventDefault();
    if (isLockedByOther) return;
    const formatted = formatRoomNumber(assignRoom);
    if (!formatted) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.manualAssign(reservation.reservationId, formatted);
      alert(`[${formatted}호] 객실 배정이 완료되었습니다.`);
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '객실 배정 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (isLockedByOther) return;
    if (!confirm(`[${reservation.assignedRoomNumber}호] 배정을 취소하시겠습니까?`)) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.unassignRoom(reservation.reservationId);
      alert('객실 배정이 취소되었습니다.');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '배정 취소 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoomMove = async (e: SubmitEvent) => {
    e.preventDefault();
    if (isLockedByOther) return;
    const formatted = formatRoomNumber(moveRoom);
    if (!formatted) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.changeRoom(reservation.reservationId, formatted, moveReason, businessDate);
      alert(`[룸 체인지 완료] ${reservation.assignedRoomNumber}호 -> ${formatted}호 이전`);
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '룸 체인지 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (isLockedByOther) return;
    if (!confirm(`[${reservation.assignedRoomNumber}호] 체크인 처리하시겠습니까?`)) return;
    setLoading(true);
    setMsg('');
    try {
      await pmsService.checkIn(reservation.reservationId);
      alert('체크인이 완료되었습니다.');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        alert(axiosErr.response?.data?.message || '체크인 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (isLockedByOther) return;

    if (balanceDue > 0) {
      alert(`[퇴실 차단] 미정산 잔액(¥${balanceDue.toLocaleString()})이 남아있어 체크아웃할 수 없습니다.\n[결제 및 정산 원장] 탭에서 잔액 수납을 완료해주세요.`);
      return;
    }

    if (!confirm(`[${reservation.assignedRoomNumber}호] 고객 [${reservation.operationalGuestName || reservation.guestName}]님의 체크아웃을 처리하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    setMsg('');
    try {
      await pmsService.checkOut(reservation.reservationId, businessDate);
      alert('체크아웃이 성공적으로 완료되었습니다. (객실이 청소 대기 상태로 전환되었습니다.)');
      await reloadCurrentReservation();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setMsg(axiosErr.response?.data?.message || '체크아웃 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  // 🚀 [1] 이용 명세 등록 (+)
  const handleSubmitCharge = async (e: SubmitEvent) => {
    e.preventDefault();
    if (folioAmount <= 0) {
      alert('청구할 금액을 1원 이상 입력해주세요.');
      return;
    }
    setIsPostingFolio(true);
    try {
      const matched = chargeCodes.find((c) => c.code === selectedChargeCode);
      const desc = folioMemo.trim() || (matched ? matched.name : selectedChargeCode);

      await pmsService.addFolioTransaction(reservation.reservationId, {
        type: 'CHARGE',
        category: selectedChargeCode,
        description: desc,
        amount: folioAmount,
      });

      alert(`[이용 명세 등록 (+)] ¥${folioAmount.toLocaleString()}이 장부에 청구되었습니다.`);
      setFolioModalMode('NONE');
      setFolioAmount(0);
      setFolioMemo('');
      await reloadCurrentReservation();
    } catch (err: any) {
      alert('이용 명세 등록 실패: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsPostingFolio(false);
    }
  };

  // 🚀 [2] 수납 등록 (-)
  const handleSubmitPayment = async (e: SubmitEvent) => {
    e.preventDefault();
    if (folioAmount <= 0) {
      alert('수납할 금액을 1원 이상 입력해주세요.');
      return;
    }
    setIsPostingFolio(true);
    try {
      const methodText = paymentMethod === 'CREDIT_CARD' ? '신용카드 승인' : '현금 지불 수납';
      const desc = folioMemo.trim() || methodText;

      await pmsService.addFolioTransaction(reservation.reservationId, {
        type: 'PAYMENT',
        paymentMethod: paymentMethod,
        category: paymentMethod,
        description: desc,
        amount: folioAmount,
      });

      alert(`[수납 등록 (-)] ¥${folioAmount.toLocaleString()}이 정상 수납 처리되었습니다.`);
      setFolioModalMode('NONE');
      setFolioAmount(0);
      setFolioMemo('');
      await reloadCurrentReservation();
    } catch (err: any) {
      alert('수납 등록 실패: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsPostingFolio(false);
    }
  };

  // 🚀 [해결 방법 2] checkOutDate 타입 에러 안전 도출 연산
  const derivedCheckOutDate = useMemo(() => {
    if ((reservation as any).checkOutDate) return String((reservation as any).checkOutDate);
    const ci = reservation.operationalCheckInDate || reservation.checkInDate;
    const nights = reservation.operationalStayNights ?? reservation.stayNights ?? 1;
    if (!ci) return '';
    const d = new Date(ci);
    d.setDate(d.getDate() + nights);
    return d.toISOString().split('T')[0];
  }, [reservation]);

  // 🚀 [원장 계산식]: 체크인 전/오딧 전에는 청구 0원. 오직 등록된 거래(Folio Transactions)만 정직하게 합산
  const transactions = useMemo(() => {
    const list = reservation.transactions || (reservation as any).paymentLedger?.transactions;
    return Array.isArray(list) ? list : [];
  }, [reservation]);

  const totalCharges = useMemo(() => {
    return transactions
      .filter((t: any) => t.type === 'CHARGE')
      .reduce((acc: number, t: any) => acc + t.amount, 0);
  }, [transactions]);

  const totalPayments = useMemo(() => {
    return transactions
      .filter((t: any) => t.type === 'PAYMENT')
      .reduce((acc: number, t: any) => acc + t.amount, 0);
  }, [transactions]);

  const balanceDue = totalCharges - totalPayments;
  const isCheckoutDue = reservation.status === 'CHECKED_IN' && derivedCheckOutDate <= businessDate;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3 font-sans text-slate-800">
      
      {/* 🔒 락 경고 배너 */}
      {isLockedByOther && (
        <div className="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-amber-700" />
            <span>
              현재 <b>[{lockHolderName}]</b> 스탭이 이 예약을 편집하고 있습니다. <b>읽기 전용 (미리보기 모드)</b>으로 열렸습니다.
            </span>
          </div>
          <span className="flex items-center gap-1 rounded bg-white/80 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            <Eye size={12} /> 미리보기 전용
          </span>
        </div>
      )}

      {/* 상단 헤더 바 */}
      <div className="flex items-center justify-between border-b border-slate-300 pb-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <ArrowLeft size={13} /> 목록으로
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {reservation.operationalGuestName || reservation.guestName}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-500">ID: {reservation.reservationId}</span>
              <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                {reservation.status}
              </span>
              <span className={`rounded border px-1.5 py-0.2 text-[10px] font-bold ${
                balanceDue > 0
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : balanceDue < 0
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-700'
              }`}>
                {balanceDue > 0
                  ? `미납: ¥${balanceDue.toLocaleString()}`
                  : balanceDue < 0
                  ? `초과수납: -¥${Math.abs(balanceDue).toLocaleString()}`
                  : '정산 완료 (¥0)'}
              </span>
            </div>
          </div>
        </div>

        {/* 3대 메인 탭 */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('OPERATIONAL')}
            className={`rounded px-3 py-1 text-xs font-semibold transition ${
              activeTab === 'OPERATIONAL'
                ? 'bg-blue-600 text-white font-bold'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {isLockedByOther ? '현장 운영 미리보기' : '현장 운영 & 객실 제어'}
          </button>
          <button
            onClick={() => setActiveTab('FOLIO_LEDGER')}
            className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition ${
              activeTab === 'FOLIO_LEDGER'
                ? 'bg-blue-600 text-white font-bold'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Receipt size={13} /> 결제 및 정산 원장 (Folio)
          </button>
          <button
            onClick={() => setActiveTab('CONTRACT_AUDIT')}
            className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition ${
              activeTab === 'CONTRACT_AUDIT'
                ? 'bg-blue-600 text-white font-bold'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileCode size={13} /> 원천 계약 감사
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded border border-rose-300 bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">
          {msg}
        </div>
      )}

      {/* ================= 탭 1: 현장 운영 & 객실 제어 ================= */}
      {activeTab === 'OPERATIONAL' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
          {/* [좌측 컬럼] 고객 정보, 요청 메모, 태그 */}
          <div className="flex flex-col gap-3">
            <form onSubmit={handleSaveOperational} className="flex flex-col gap-2.5 rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                <User size={14} className="text-blue-700" />
                <span>현장 투숙 정보 수정 {isLockedByOther && '(읽기 전용)'}</span>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">실투숙자 성명</label>
                <input
                  type="text"
                  disabled={isLockedByOther}
                  value={opGuestName}
                  onChange={(e) => setOpGuestName(e.target.value)}
                  className={`w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none ${isLockedByOther ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">체크인 일자</label>
                  <input
                    type="date"
                    disabled={isLockedByOther}
                    value={opCheckIn}
                    onChange={(e) => setOpCheckIn(e.target.value)}
                    className={`w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none ${isLockedByOther ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-600">투숙 박수</label>
                    {opNights === 0 && (
                      <span className="rounded bg-amber-100 border border-amber-300 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                        0박 (새벽 도착 당일 아웃)
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    disabled={isLockedByOther}
                    value={opNights}
                    onChange={(e) => setOpNights(Number(e.target.value))}
                    className={`w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none ${isLockedByOther ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">프론트 직원 인계 메모</label>
                <textarea
                  disabled={isLockedByOther}
                  value={staffMemo}
                  onChange={(e) => setStaffMemo(e.target.value)}
                  rows={2}
                  className={`w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none ${isLockedByOther ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
                />
              </div>

              {!isLockedByOther && (
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 rounded bg-slate-800 p-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  정보 수정 저장
                </button>
              )}
            </form>

            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <h4 className="mb-1 text-xs font-bold text-slate-800">OTA 인입 원문 요청사항</h4>
              <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 font-mono">
                {reservation.rawRequestText || '(고객 요청 메모 없음)'}
              </div>
            </div>

            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                  <Tag size={14} className="text-blue-700" />
                  <span>배정 태그 오버라이드</span>
                </div>
                {!isLockedByOther && <span className="text-[10px] text-slate-400">클릭: 선호(+) / 기피(-) / 해제</span>}
              </div>

              <div className="mb-3 flex flex-wrap gap-1">
                {allTags.map((t) => {
                  const isPref = editPreferredTags.has(t.code);
                  const isAvoid = editAvoidTags.has(t.code);

                  return (
                    <button
                      key={t.code}
                      type="button"
                      disabled={isLockedByOther}
                      onClick={() => cycleTagState(t.code)}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition ${
                        isPref
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
                          : isAvoid
                          ? 'border-rose-500 bg-rose-50 text-rose-800 font-bold'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      } ${isLockedByOther ? 'cursor-not-allowed opacity-80' : ''}`}
                    >
                      {isPref && <Plus size={10} strokeWidth={3} />}
                      {isAvoid && <Minus size={10} strokeWidth={3} />}
                      {t.name}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-[11px] text-slate-500">
                  선호 <b className="text-emerald-700">{editPreferredTags.size}</b> / 기피 <b className="text-rose-700">{editAvoidTags.size}</b>
                </span>
                {!isLockedByOther && (
                  <button
                    type="button"
                    onClick={handleSaveOperationalTags}
                    disabled={tagSaving}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    {tagSaving ? '저장 중...' : '태그 저장'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* [우측 컬럼] 객실 배정, 체크인/체크아웃 제어 & 일자별 요금 스케줄 에디터 */}
          <div className="flex flex-col gap-3">
            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">배정 객실:</span>
                <span className={`font-mono text-base font-bold ${reservation.assignedRoomNumber ? 'text-blue-700' : 'text-rose-600'}`}>
                  {reservation.assignedRoomNumber ? `${reservation.assignedRoomNumber}호` : '미배정'}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                계약 룸타입: <span className="font-bold text-slate-900">{reservation.bookedRoomType || reservation.roomType}</span>
              </div>
            </div>

            {isLockedByOther && (
              <div className="rounded border border-slate-300 bg-slate-100 p-4 text-center text-xs text-slate-500">
                <Lock size={20} className="mx-auto mb-1 text-slate-400" />
                <p className="font-semibold text-slate-700">객실 배정 및 제어 잠김</p>
                <p className="text-[11px] mt-1">다른 스탭이 편집 작업을 마칠 때까지 배정 및 체크인이 제한됩니다.</p>
              </div>
            )}

            {/* 수동 호실 지정 */}
            {!isLockedByOther && reservation.status !== 'CHECKED_IN' && reservation.status !== 'CHECKED_OUT' && reservation.status !== 'CANCELLED' && (
              <div className="flex flex-col gap-2.5 rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
                <form onSubmit={handleManualAssign} className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                    <KeyRound size={14} className="text-blue-700" />
                    <span>수동 호실 지정</span>
                  </div>
                  <input
                    type="text"
                    placeholder="예: 501 또는 0501"
                    value={assignRoom}
                    onChange={(e) => setAssignRoom(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded border border-slate-300 bg-white p-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                  >
                    {reservation.assignedRoomNumber ? '호실 재배정' : '신규 배정 확정'}
                  </button>
                </form>

                {reservation.assignedRoomNumber && (
                  <button
                    type="button"
                    onClick={handleUnassign}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 rounded border border-rose-300 bg-rose-50 p-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    <UserX size={13} /> 배정 취소
                  </button>
                )}

                {reservation.status === 'ASSIGNED' && (
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 rounded bg-emerald-600 p-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={15} /> 체크인 (키 교부 & 입실)
                  </button>
                )}
              </div>
            )}

            {/* 재실 상태(CHECKED_IN): 체크아웃 패널 */}
            {!isLockedByOther && reservation.status === 'CHECKED_IN' && (
              <div className="flex flex-col gap-3">
                <div className={`rounded border p-3.5 shadow-2xs ${
                  isCheckoutDue ? 'border-blue-300 bg-blue-50/70' : 'border-slate-300 bg-white'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      {isCheckoutDue ? '오늘 퇴실 예정 고객 (Due Out)' : '투숙 체류 중 (In-House)'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      예정 퇴실일: {derivedCheckOutDate}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={loading}
                    className={`flex w-full items-center justify-center gap-1.5 rounded p-2.5 text-xs font-bold text-white transition shadow-xs ${
                      balanceDue !== 0
                        ? 'bg-slate-400 hover:bg-slate-500'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    <LogOut size={14} />
                    {balanceDue > 0
                      ? `체크아웃 불가 (미정산 잔액: ¥${balanceDue.toLocaleString()})`
                      : balanceDue < 0
                      ? `체크아웃 불가 (초과 수납 ¥${Math.abs(balanceDue).toLocaleString()} 환불 필요)`
                      : '체크아웃 확정 (퇴실 처리)'}
                  </button>
                  
                  {balanceDue !== 0 && (
                    <p className="mt-1.5 text-center text-[11px] text-rose-600 font-semibold">
                      * [결제 및 정산 원장] 탭에서 잔액을 ¥0으로 정확히 맞춰야 퇴실이 승인됩니다.
                    </p>
                  )}
                </div>

                <form onSubmit={handleRoomMove} className="flex flex-col gap-2 rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                    <ArrowRightLeft size={14} />
                    <span>재실 고객 룸 체인지</span>
                  </div>
                  <input
                    type="text"
                    placeholder="새 호실 (예: 1404)"
                    value={moveRoom}
                    onChange={(e) => setMoveRoom(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="변경 사유"
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded border border-amber-300 bg-amber-50 p-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    룸 체인지 실행
                  </button>
                </form>
              </div>
            )}

            {/* 퇴실 완료 안내 */}
            {reservation.status === 'CHECKED_OUT' && (
              <div className="rounded border border-slate-300 bg-slate-100 p-3.5 text-center text-xs text-slate-600">
                <CheckCircle2 size={18} className="mx-auto mb-1 text-slate-500" />
                <span className="font-bold">체크아웃이 완료된 예약입니다.</span>
                <p className="text-[11px] mt-0.5 text-slate-400">객실 점유가 정상 해제되었습니다.</p>
              </div>
            )}

            {/* 일자별 1박 객실료 스케줄 그리드 */}
            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                  <CreditCard size={14} className="text-blue-700" />
                  <span>일자별 1박 객실료 스케줄 (나이트 오딧 청구 단가)</span>
                </div>
                {!isLockedByOther && opNights > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveDailyRates}
                    disabled={isSavingRates}
                    className="rounded bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 disabled:bg-slate-300"
                  >
                    {isSavingRates ? '저장 중...' : '요금 변경 저장'}
                  </button>
                )}
              </div>

              {opNights === 0 ? (
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
                  0박 투숙(새벽 도착/당일 퇴실) 건은 추가 야간 오딧 객실료가 부과되지 않습니다.
                </div>
              ) : (
                <div className="overflow-hidden rounded border border-slate-200 bg-slate-50">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-slate-600 font-semibold">
                        <th className="px-3 py-1.5 w-16">회차</th>
                        <th className="px-3 py-1.5 w-32">해당 일자</th>
                        <th className="px-3 py-1.5">1박 객실료 (¥)</th>
                        <th className="px-3 py-1.5 text-right w-28">적용 상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {Object.entries(dailyRatesState).map(([dateStr, rate], idx) => {
                        const isPast = dateStr < businessDate;
                        const isToday = dateStr === businessDate;

                        return (
                          <tr key={dateStr} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-mono text-slate-500">{idx + 1}박차</td>
                            <td className="px-3 py-1.5 font-mono font-semibold text-slate-800">
                              {dateStr} {isToday && <span className="text-[10px] text-blue-700 font-bold ml-1">(오늘)</span>}
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 font-mono">¥</span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  disabled={isLockedByOther || isPast}
                                  value={rate}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setDailyRatesState((prev) => ({ ...prev, [dateStr]: val }));
                                  }}
                                  className={`w-32 rounded border border-slate-300 p-1 font-mono text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none ${
                                    isPast ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                                  }`}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium">
                              {isPast ? (
                                <span className="text-slate-400 text-[11px]">오딧 완료</span>
                              ) : isToday ? (
                                <span className="text-blue-700 font-bold text-[11px]">오늘 밤 청구 예정</span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">청구 대기</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= 탭 2: 결제 및 정산 원장 (Folio / Bills) ================= */}
      {activeTab === 'FOLIO_LEDGER' && (
        <div className="flex flex-col gap-3 font-sans text-slate-800">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500">결제 구분</span>
              <div className="mt-1 font-bold text-sm text-slate-800">
                {reservation.paymentLedger?.paymentType === 'PREPAID' ? '사전 카드 결제 (OTA 후불 청구)' : '현장 프론트 결제'}
              </div>
            </div>

            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500">총 발생 청구액 (Charges, +)</span>
              <div className="mt-1 font-mono font-bold text-base text-slate-900">
                ¥{totalCharges.toLocaleString()}
              </div>
            </div>

            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500">총 수납 정산액 (Payments, -)</span>
              <div className="mt-1 font-mono font-bold text-base text-emerald-700">
                ¥{totalPayments.toLocaleString()}
              </div>
            </div>

            <div className={`rounded border p-3.5 shadow-2xs ${
              balanceDue > 0
                ? 'border-rose-300 bg-rose-50'
                : balanceDue < 0
                ? 'border-amber-300 bg-amber-50'
                : 'border-emerald-300 bg-emerald-50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">최종 미납 잔액 (Balance Due)</span>
                {balanceDue === 0 ? (
                  <Check size={14} className="text-emerald-700 font-bold" />
                ) : balanceDue < 0 ? (
                  <AlertTriangle size={14} className="text-amber-700 font-bold" />
                ) : null}
              </div>
              <div className={`mt-1 font-mono font-extrabold text-lg ${
                balanceDue > 0
                  ? 'text-rose-700'
                  : balanceDue < 0
                  ? 'text-amber-800'
                  : 'text-emerald-800'
              }`}>
                {balanceDue > 0
                  ? `¥${balanceDue.toLocaleString()}`
                  : balanceDue < 0
                  ? `-¥${Math.abs(balanceDue).toLocaleString()} (환불필요)`
                  : '¥0 (완납)'}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded border border-slate-300 bg-white shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-blue-700" />
                <h3 className="text-xs font-bold text-slate-900">원장 거래 및 정산 분개 내역 (Folio Transactions)</h3>
              </div>

              {!isLockedByOther && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFolioModalMode('CHARGE');
                      setFolioAmount(0);
                      setFolioMemo('');
                    }}
                    className="flex items-center gap-1.5 rounded bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 transition"
                  >
                    <PlusCircle size={13} /> 이용 명세 등록 (+)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFolioModalMode('PAYMENT');
                      setFolioAmount(balanceDue > 0 ? balanceDue : 0);
                      setFolioMemo('');
                    }}
                    className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                  >
                    <MinusCircle size={13} /> 수납 등록 (-)
                  </button>
                </div>
              )}
            </div>

            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-600 font-semibold">
                  <th className="px-4 py-2 w-28">식별 번호</th>
                  <th className="px-4 py-2 w-28">구분</th>
                  <th className="px-4 py-2 w-36">계정과목 / 결제수단</th>
                  <th className="px-4 py-2">상세 내역 (비고)</th>
                  <th className="px-4 py-2 text-right w-36">청구 금액 (+)</th>
                  <th className="px-4 py-2 text-right w-36">수납 금액 (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400">
                      등록된 원장 분개 내역이 없습니다. (상단의 이용 명세 등록 또는 수납 등록 버튼을 사용하세요)
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx: any, idx: number) => (
                    <tr key={tx.transactionId || idx} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-[11px] text-slate-400">{tx.transactionId}</td>
                      <td className="px-4 py-2">
                        {tx.type === 'CHARGE' ? (
                          <span className="rounded bg-rose-50 border border-rose-300 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                            청구 (+)
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            수납 (-)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-semibold text-slate-700 font-mono">{tx.category}</td>
                      <td className="px-4 py-2 text-slate-800">{tx.description}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-rose-700">
                        {tx.type === 'CHARGE' ? `+¥${tx.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-emerald-700">
                        {tx.type === 'PAYMENT' ? `-¥${tx.amount.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= 탭 3: 원천 계약 감사 탭 ================= */}
      {activeTab === 'CONTRACT_AUDIT' && (
        <div className="flex w-full flex-col gap-3 font-sans text-slate-800">
          <div className="flex items-center justify-between rounded border border-slate-300 bg-white p-4 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <FileCode size={18} className="text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">OTA 원천 계약 원장 & PMS 감사 추적 (Audit Trail)</h3>
                <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                  IMMUTABLE CONTRACT
                </span>
              </div>
            </div>
            <div className="text-right font-mono text-xs">
              <span className="text-slate-400">예약 ID:</span> <b className="text-blue-700">{reservation.reservationId}</b>
            </div>
          </div>
        </div>
      )}

      {/* ================= 모달 1: 이용 명세 등록 (+) ================= */}
      {folioModalMode === 'CHARGE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <form onSubmit={handleSubmitCharge} className="flex w-full max-w-[420px] flex-col gap-3 rounded border border-slate-300 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-sm text-rose-700">
                <PlusCircle size={16} />
                <span>이용 명세 등록 (청구 항목 추가, +)</span>
              </div>
              <button
                type="button"
                onClick={() => setFolioModalMode('NONE')}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                닫기
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">계정과목 선택</label>
              <select
                value={selectedChargeCode}
                onChange={(e) => {
                  setSelectedChargeCode(e.target.value);
                  const matched = chargeCodes.find((c) => c.code === e.target.value);
                  if (matched && matched.defaultAmount > 0) {
                    setFolioAmount(matched.defaultAmount);
                  }
                }}
                className="w-full rounded border border-slate-300 bg-white p-2 text-xs font-semibold text-slate-900 focus:border-rose-600 focus:outline-none"
              >
                {chargeCodes.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">청구 금액 (¥)</label>
              <input
                type="number"
                step="any"
                min="1"
                value={folioAmount || ''}
                placeholder="예: 3000"
                onChange={(e) => setFolioAmount(Number(e.target.value))}
                className="w-full rounded border border-slate-300 bg-white p-2 font-mono text-sm font-bold text-slate-900 focus:border-rose-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">상세 내용 (비고/메모)</label>
              <input
                type="text"
                placeholder="예: 미니바 맥주 2캔, 엑스트라 베드 1개 추가"
                value={folioMemo}
                onChange={(e) => setFolioMemo(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-rose-600 focus:outline-none"
              />
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolioModalMode('NONE')}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isPostingFolio}
                className="rounded bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
              >
                {isPostingFolio ? '등록 중...' : '청구 등록 확정 (+)'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= 모달 2: 수납 등록 (-) ================= */}
      {folioModalMode === 'PAYMENT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <form onSubmit={handleSubmitPayment} className="flex w-full max-w-[420px] flex-col gap-3 rounded border border-slate-300 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-sm text-emerald-700">
                <MinusCircle size={16} />
                <span>수납 등록 (결제 잔액 차감, -)</span>
              </div>
              <button
                type="button"
                onClick={() => setFolioModalMode('NONE')}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                닫기
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">결제 수단</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDIT_CARD')}
                  className={`rounded border p-2 text-xs font-bold transition ${
                    paymentMethod === 'CREDIT_CARD'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  신용카드 승인
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`rounded border p-2 text-xs font-bold transition ${
                    paymentMethod === 'CASH'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  현금 지불 수납
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">수납 금액 (¥)</label>
                {balanceDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setFolioAmount(balanceDue)}
                    className="text-[11px] text-blue-700 underline font-semibold hover:text-blue-900"
                  >
                    미납 전액 (¥{balanceDue.toLocaleString()}) 입력
                  </button>
                )}
              </div>
              <input
                type="number"
                step="any"
                min="1"
                value={folioAmount || ''}
                placeholder="예: 15000"
                onChange={(e) => setFolioAmount(Number(e.target.value))}
                className="w-full rounded border border-slate-300 bg-white p-2 font-mono text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">상세 내용 (승인번호/메모)</label>
              <input
                type="text"
                placeholder="예: 현대카드 8자리 승인 / 영수증 발행"
                value={folioMemo}
                onChange={(e) => setFolioMemo(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolioModalMode('NONE')}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isPostingFolio}
                className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                {isPostingFolio ? '등록 중...' : '수납 등록 확정 (-)'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}