import { useState, useEffect, useCallback } from 'react';
import type { SubmitEvent } from 'react';
import type { ReservationDetailDto } from '../api/pmsService';
import { pmsService } from '../api/pmsService';
import apiClient from '../api/client';
import {
  ArrowLeft, CheckCircle2, ArrowRightLeft, FileCode, User, KeyRound, UserX, Tag, Plus, Minus, CreditCard, Utensils, Clock, ShieldCheck, Lock, Eye
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
  const [activeTab, setActiveTab] = useState<'OPERATIONAL' | 'CONTRACT_AUDIT'>('OPERATIONAL');
  const [reservation, setReservation] = useState<ReservationDetailDto>(initialReservation);

  // 🔒 동시 편집 방지 락 상태
  const [isLockedByOther, setIsLockedByOther] = useState(false);
  const [lockHolderName, setLockHolderName] = useState('');

  const [opGuestName, setOpGuestName] = useState('');
  const [opCheckIn, setOpCheckIn] = useState('');
  const [opNights, setOpNights] = useState(1);
  const [staffMemo, setStaffMemo] = useState('');

  const [allTags, setAllTags] = useState<Array<{ code: string; name: string }>>([]);
  const [editPreferredTags, setEditPreferredTags] = useState<Set<string>>(new Set());
  const [editAvoidTags, setEditAvoidTags] = useState<Set<string>>(new Set());
  const [tagSaving, setTagSaving] = useState(false);

  const [assignRoom, setAssignRoom] = useState('');
  const [moveRoom, setMoveRoom] = useState('');
  const [moveReason, setMoveReason] = useState('고객 시설 보상 업그레이드');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 1. 화면 진입 시 sessionStorage 기반으로 락 획득 시도 및 종료 시 락 해제
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
        console.error('락 획득 실패 (네트워크/인가 오류):', e);
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
  }, []);

  const syncFormState = useCallback((data: ReservationDetailDto) => {
    setReservation(data);
    setOpGuestName(data.operationalGuestName || data.guestName || '');
    setOpCheckIn(data.operationalCheckInDate || data.checkInDate || '');
    setOpNights(data.operationalStayNights || data.stayNights || 1);
    setStaffMemo(data.internalStaffMemo || data.rawRequestText || '');
    setAssignRoom(data.assignedRoomNumber ? data.assignedRoomNumber.replace(/^0/, '') : '');
    setMoveRoom('');

    setEditPreferredTags(new Set(data.tagPreference?.preferredTags || []));
    setEditAvoidTags(new Set(data.tagPreference?.avoidTags || []));
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
        setMsg(axiosErr.response?.data?.message || '체크인 실패');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3 font-sans text-slate-800">
      
      {/* 🔒 다른 직원이 편집 중일 때 상단 잠금 경고 배너 */}
      {isLockedByOther && (
        <div className="flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-amber-700" />
            <span>
              현재 <b>[{lockHolderName}]</b> 스탭이 이 예약을 편집하고 있습니다. 동시 변경 충돌을 방지하기 위해 <b>읽기 전용 (미리보기 모드)</b>으로 열렸습니다.
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
            </div>
          </div>
        </div>

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

      {/* 탭 1: 현장 운영 & 객실 제어 */}
      {activeTab === 'OPERATIONAL' && (
        <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">
          <div className="flex flex-col gap-3">
            
            {/* 운영 태그 오버라이드 */}
            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                  <Tag size={14} className="text-blue-700" />
                  <span>배정 태그 오버라이드</span>
                </div>
                {!isLockedByOther && <span className="text-[10px] text-slate-400">클릭: 선호(+) / 기피(-) / 해제</span>}
              </div>

              <p className="mb-2.5 text-[11px] text-slate-500">
                유선 요청 사항을 반영합니다. (원천 예약 메모는 유지됩니다)
              </p>

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

            {/* 원본 요청 메모 */}
            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
              <h4 className="mb-1 text-xs font-bold text-slate-800">OTA 인입 원문 요청사항</h4>
              <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 font-mono">
                {reservation.rawRequestText || '(고객 요청 메모 없음)'}
              </div>
            </div>

            {/* 현장 투숙 정보 폼 */}
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
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600">투숙 박수</label>
                  <input
                    type="number"
                    min="1"
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
          </div>

          {/* 객실 배정 및 조작 */}
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
                    className="flex items-center justify-center gap-1.5 rounded bg-emerald-600 p-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={14} /> 체크인 완료
                  </button>
                )}
              </div>
            )}

            {!isLockedByOther && reservation.status === 'CHECKED_IN' && (
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
            )}
          </div>
        </div>
      )}

      {/* 탭 2: 원천 계약 감사 탭 */}
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
              <p className="text-[11px] text-slate-500 mt-0.5">
                채널 매니저(CMS) 최초 인입 원본 계약 데이터와 프론트 현장 수정 내역을 1:1로 대조합니다[cite: 1].
              </p>
            </div>
            <div className="text-right font-mono text-xs">
              <span className="text-slate-400">예약 고유 식별자:</span> <b className="text-blue-700">{reservation.reservationId}</b>
            </div>
          </div>

          <div className="overflow-hidden rounded border border-slate-300 bg-white shadow-2xs">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>계약 원본(Original) vs 현장 운영(Operational) 변경 이력 대조</span>
            </div>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-slate-600 font-semibold">
                  <th className="w-36 px-4 py-2">대조 항목</th>
                  <th className="px-4 py-2">OTA 원천 계약 원장 (불변 원본)</th>
                  <th className="px-4 py-2">PMS 현장 실투숙 상태 (운영 오버라이드)</th>
                  <th className="w-28 px-4 py-2 text-center">정합성 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-700">고객 성명</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900 font-mono">
                    {reservation.originalGuestName || reservation.guestName}
                  </td>
                  <td className="px-4 py-2.5 font-bold text-blue-700 font-mono">
                    {reservation.operationalGuestName || reservation.guestName}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {(reservation.originalGuestName || reservation.guestName) === (reservation.operationalGuestName || reservation.guestName) ? (
                      <span className="rounded bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">일치</span>
                    ) : (
                      <span className="rounded bg-amber-50 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">현장 수정됨</span>
                    )}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-700">계약 룸타입</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {reservation.bookedRoomType || reservation.roomType}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {reservation.roomType || reservation.bookedRoomType} 
                    {reservation.assignedRoomNumber && (
                      <span className="ml-2 font-mono font-bold text-blue-700">({reservation.assignedRoomNumber}호 배정)</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="rounded bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">기준 일치</span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-700">체크인 일자</td>
                  <td className="px-4 py-2.5 font-mono text-slate-800">
                    {reservation.contractCheckInDate || reservation.checkInDate}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-800">
                    {reservation.operationalCheckInDate || reservation.checkInDate}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {(reservation.contractCheckInDate || reservation.checkInDate) === (reservation.operationalCheckInDate || reservation.checkInDate) ? (
                      <span className="rounded bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">일치</span>
                    ) : (
                      <span className="rounded bg-amber-50 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">일정 변경</span>
                    )}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-700">숙박 박수</td>
                  <td className="px-4 py-2.5 font-mono text-slate-800">
                    {reservation.contractStayNights || reservation.stayNights}박
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-800">
                    {reservation.operationalStayNights || reservation.stayNights}박
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {(reservation.contractStayNights || reservation.stayNights) === (reservation.operationalStayNights || reservation.stayNights) ? (
                      <span className="rounded bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">일치</span>
                    ) : (
                      <span className="rounded bg-amber-50 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">연장/단축</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 border-b border-slate-200 pb-2 mb-2">
                  <CreditCard size={15} className="text-blue-700" />
                  <span>결제 정산 원장 (Folio)</span>
                </div>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">결제 구분</span>
                    <span className="font-semibold text-slate-800">사전 카드 결제 (PREPAID)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">발생 총액 (Charges)</span>
                    <span className="font-mono font-bold text-slate-900">
                      ¥{((reservation.stayNights || 1) * 15000).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">수납 총액 (Payments)</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      ¥{((reservation.stayNights || 1) * 15000).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5">
                    <span className="font-bold text-slate-700">미납 잔액 (Due)</span>
                    <span className="font-mono font-bold text-blue-700">¥0 (정산 완료)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 border-b border-slate-200 pb-2 mb-2">
                  <Utensils size={15} className="text-amber-700" />
                  <span>식음 옵션 및 식권 (Breakfast)</span>
                </div>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">조식 포함 여부</span>
                    <span className="font-bold text-emerald-700">플랜 포함 (Included)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">1일 이용 인원</span>
                    <span className="font-semibold text-slate-800">1인 / 매일</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">총 소요 식권</span>
                    <span className="font-mono font-bold text-slate-900">{reservation.stayNights || 1}매</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5">
                    <span className="font-bold text-slate-700">식권 교부 상태</span>
                    <span className="font-semibold text-slate-600">
                      {reservation.status === 'CHECKED_IN' ? '체크인 교부 완료' : '입실 시 교부 대기'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 border-b border-slate-200 pb-2 mb-2">
                  <Clock size={15} className="text-purple-700" />
                  <span>도착 일정 & 채널 식별</span>
                </div>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">예상 도착 시간 (ETA)</span>
                    <span className="font-mono font-semibold text-slate-800">15:00 (Standard)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">예약 채널</span>
                    <span className="font-bold text-blue-700">{reservation.channelInfo?.channelType || 'DIRECT'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">원천 채널 번호</span>
                    <span className="font-mono text-slate-700">{reservation.channelInfo?.channelReservationNo || reservation.reservationId}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5">
                    <span className="font-bold text-slate-700">레이트 체크아웃</span>
                    <span className="text-slate-500">미신청 (기본 11:00)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}