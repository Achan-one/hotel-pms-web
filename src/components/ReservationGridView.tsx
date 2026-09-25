import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ReservationDetailDto } from '../api/pmsService';
import { pmsService } from '../api/pmsService';
import apiClient from '../api/client';
import {
  Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Tag as TagIcon, X, Globe
} from 'lucide-react';

interface Props {
  businessDate: string;
  onSelectReservation: (reservation: ReservationDetailDto) => void;
}

type SortField = 'roomNumber' | 'guestName' | 'reservationId' | 'checkInDate' | 'stayNights' | 'status' | 'channel';
type SortOrder = 'asc' | 'desc';

const GRID_STATE_SESSION_KEY = 'PMS_RESERVATION_GRID_STATE_V1';

export default function ReservationGridView({ businessDate, onSelectReservation }: Props) {
  const savedState = useMemo(() => {
    try {
      const saved = sessionStorage.getItem(GRID_STATE_SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  }, []);

  const [reservationList, setReservationList] = useState<ReservationDetailDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchGuestName, setSearchGuestName] = useState<string>(savedState.guestName ?? '');
  const [searchReservationId, setSearchReservationId] = useState<string>(savedState.reservationId ?? '');
  const [searchCheckInDate, setSearchCheckInDate] = useState<string>(savedState.checkInDate ?? '');
  const [searchStayingDate, setSearchStayingDate] = useState<string>(savedState.stayingDate ?? '');
  const [searchStatus, setSearchStatus] = useState<string>(savedState.status ?? '');
  const [searchTag, setSearchTag] = useState<string>(savedState.tag ?? '');
  const [searchOta, setSearchOta] = useState<string>(savedState.otaChannel ?? '');

  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [registeredTags, setRegisteredTags] = useState<Array<{ code: string; name: string }>>([]);

  const [sortField, setSortField] = useState<SortField>(savedState.sortField ?? 'roomNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>(savedState.sortOrder ?? 'asc');

  useEffect(() => {
    sessionStorage.setItem(GRID_STATE_SESSION_KEY, JSON.stringify({
      guestName: searchGuestName,
      reservationId: searchReservationId,
      checkInDate: searchCheckInDate,
      stayingDate: searchStayingDate,
      status: searchStatus,
      tag: searchTag,
      otaChannel: searchOta,
      sortField,
      sortOrder
    }));
  }, [searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, searchTag, searchOta, sortField, sortOrder]);

  useEffect(() => {
    apiClient.get('/api/admin/tags')
      .then((res) => {
        const list = res.data?.data || [];
        setRegisteredTags(list.map((t: any) => ({ code: t.code, name: t.name })));
      })
      .catch(() => console.error('태그 사전 목록 로드 실패'));
  }, []);

  const executeSearch = useCallback(async (
    gName = searchGuestName,
    rId = searchReservationId,
    cDate = searchCheckInDate,
    sDate = searchStayingDate,
    stat = searchStatus,
    tagVal = searchTag,
    otaVal = searchOta
  ) => {
    setLoading(true);
    try {
      const list = await pmsService.getReservations({
        guestName: gName.trim() || undefined,
        reservationId: rId.trim() || undefined,
        checkInDate: cDate || undefined,
        stayingDate: sDate || undefined,
        status: stat || undefined,
        tag: tagVal.trim() || undefined,
        otaChannel: otaVal || undefined,
      });
      setReservationList(list);
    } catch (err) {
      console.error('예약 검색 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, searchTag, searchOta]);

  useEffect(() => {
    void executeSearch();
  }, [executeSearch]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedList = useMemo(() => {
    let result = [...reservationList];

    if (searchTag.trim()) {
      const q = searchTag.trim().toUpperCase();
      result = result.filter(r => {
        const prefMatch = r.tagPreference?.preferredTags?.some(t => t.toUpperCase().includes(q));
        const avoidMatch = r.tagPreference?.avoidTags?.some(t => t.toUpperCase().includes(q));
        const memoMatch = r.rawRequestText?.toUpperCase().includes(q) || r.rawRequestText?.includes(searchTag.trim());
        return prefMatch || avoidMatch || memoMatch;
      });
    }

    return result.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortField) {
        case 'roomNumber':
          valA = a.assignedRoomNumber ? a.assignedRoomNumber : '9999';
          valB = b.assignedRoomNumber ? b.assignedRoomNumber : '9999';
          break;
        case 'guestName':
          valA = a.operationalGuestName || a.guestName || '';
          valB = b.operationalGuestName || b.guestName || '';
          break;
        case 'reservationId':
          valA = a.reservationId;
          valB = b.reservationId;
          break;
        case 'checkInDate':
          valA = a.checkInDate;
          valB = b.checkInDate;
          break;
        case 'stayNights':
          valA = a.stayNights;
          valB = b.stayNights;
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        case 'channel':
          valA = a.channelInfo?.channelType || '';
          valB = b.channelInfo?.channelType || '';
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reservationList, searchTag, sortField, sortOrder]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={11} className="text-slate-400" />;
    return sortOrder === 'asc' ? <ArrowUp size={11} className="text-slate-800" /> : <ArrowDown size={11} className="text-slate-800" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CHECKED_IN':
        return <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">투숙중</span>;
      case 'ASSIGNED':
        return <span className="rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">배정완료</span>;
      case 'PENDING':
        return <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">미배정</span>;
      case 'CHECKED_OUT':
        return <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">퇴실완료</span>;
      case 'CANCELLED':
        return <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">취소</span>;
      default:
        return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{status}</span>;
    }
  };

  const getOtaBadge = (channelType?: string) => {
    switch (channelType) {
      case 'AGODA':
        return <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">Agoda</span>;
      case 'BOOKING_COM':
        return <span className="rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">Booking.com</span>;
      case 'EXPEDIA':
        return <span className="rounded border border-yellow-300 bg-yellow-50 px-1.5 py-0.5 text-[10px] font-bold text-yellow-800">Expedia</span>;
      case 'RAKUTEN':
        return <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Rakuten</span>;
      case 'TRIP_COM':
        return <span className="rounded border border-cyan-300 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">Trip.com</span>;
      case 'AIRBNB':
        return <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">Airbnb</span>;
      default:
        return <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">DIRECT</span>;
    }
  };

  return (
    <div className="flex w-full flex-col gap-2.5 font-sans text-slate-800">
      
      {/* 1. 상단 바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold tracking-tight text-slate-900">
            예약 원장 및 정밀 그리드
          </h2>
          <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
            LEDGER
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(GRID_STATE_SESSION_KEY);
            setSearchGuestName(''); setSearchReservationId(''); setSearchCheckInDate('');
            setSearchStayingDate(''); setSearchStatus(''); setSearchTag(''); setSearchOta('');
            setSortField('roomNumber'); setSortOrder('asc');
            void executeSearch('', '', '', '', '', '', '');
          }}
          className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 조건 초기화
        </button>
      </div>

      {/* 2. 퀵 필터 탭 바 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-300">
        <div className="flex">
          {[
            { label: '전체', active: !searchCheckInDate && !searchStayingDate && !searchStatus, onClick: () => { setSearchCheckInDate(''); setSearchStayingDate(''); setSearchStatus(''); void executeSearch(searchGuestName, searchReservationId, '', '', '', searchTag, searchOta); } },
            { label: '당일 도착', active: searchCheckInDate === businessDate, onClick: () => { const nCI = searchCheckInDate === businessDate ? '' : businessDate; setSearchCheckInDate(nCI); setSearchStayingDate(''); setSearchStatus(''); void executeSearch(searchGuestName, searchReservationId, nCI, '', '', searchTag, searchOta); } },
            { label: '현재 재실', active: searchStatus === 'CHECKED_IN', onClick: () => { const nStay = searchStayingDate === businessDate ? '' : businessDate; const nStat = searchStatus === 'CHECKED_IN' ? '' : 'CHECKED_IN'; setSearchStayingDate(nStay); setSearchCheckInDate(''); setSearchStatus(nStat); void executeSearch(searchGuestName, searchReservationId, '', nStay, nStat, searchTag, searchOta); } },
            { label: '배정 완료', active: searchStatus === 'ASSIGNED', onClick: () => { const nStat = searchStatus === 'ASSIGNED' ? '' : 'ASSIGNED'; setSearchStatus(nStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', nStat, searchTag, searchOta); } },
            { label: '미배정', active: searchStatus === 'PENDING', onClick: () => { const nStat = searchStatus === 'PENDING' ? '' : 'PENDING'; setSearchStatus(nStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', nStat, searchTag, searchOta); } },
            { label: '취소/노쇼', active: searchStatus === 'CANCELLED', onClick: () => { const nStat = searchStatus === 'CANCELLED' ? '' : 'CANCELLED'; setSearchStatus(nStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', nStat, searchTag, searchOta); } },
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={chip.onClick}
              className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-[1px] ${
                chip.active
                  ? 'border-blue-600 text-blue-700 font-bold bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* 태그 팝오버 필터 */}
        <div className="relative ml-auto pb-1">
          <button
            type="button"
            onClick={() => setIsTagPopoverOpen(prev => !prev)}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold shadow-2xs transition ${
              searchTag
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <TagIcon size={12} />
            {searchTag ? `태그: ${searchTag}` : '태그 필터...'}
          </button>

          {isTagPopoverOpen && (
            <div className="absolute top-[110%] right-0 z-50 flex w-[300px] flex-col gap-2 rounded border border-slate-300 bg-white p-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="text-xs font-bold text-slate-800">태그 선택</span>
                <div className="flex items-center gap-2">
                  {searchTag && (
                    <button
                      onClick={() => {
                        setSearchTag('');
                        void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, '', searchOta);
                        setIsTagPopoverOpen(false);
                      }}
                      className="text-[11px] text-rose-600 hover:underline"
                    >
                      해제
                    </button>
                  )}
                  <button onClick={() => setIsTagPopoverOpen(false)} className="text-slate-400 hover:text-slate-800">
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="flex max-h-[160px] flex-wrap gap-1 overflow-y-auto">
                {registeredTags.map(t => {
                  const isSelected = searchTag === t.code;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => {
                        setSearchTag(t.code);
                        void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, t.code, searchOta);
                        setIsTagPopoverOpen(false);
                      }}
                      className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                        isSelected
                          ? 'border border-blue-600 bg-blue-600 text-white font-bold'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. 검색 폼 바 */}
      <div className="rounded border border-slate-300 bg-white p-2.5 shadow-2xs">
        <div className="grid grid-cols-6 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">예약자 성명</label>
            <input
              type="text"
              placeholder="성명 검색"
              value={searchGuestName}
              onChange={(e) => { const v = e.target.value; setSearchGuestName(v); void executeSearch(v, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, searchTag, searchOta); }}
              className="w-full rounded border border-slate-300 bg-white p-1 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">예약ID</label>
            <input
              type="text"
              placeholder="예약번호"
              value={searchReservationId}
              onChange={(e) => { const v = e.target.value; setSearchReservationId(v); void executeSearch(searchGuestName, v, searchCheckInDate, searchStayingDate, searchStatus, searchTag, searchOta); }}
              className="w-full rounded border border-slate-300 bg-white p-1 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">상태</label>
            <select
              value={searchStatus}
              onChange={(e) => { const v = e.target.value; setSearchStatus(v); void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, v, searchTag, searchOta); }}
              className="w-full rounded border border-slate-300 bg-white p-1 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="">(전체 상태)</option>
              <option value="CHECKED_IN">투숙중</option>
              <option value="ASSIGNED">배정완료</option>
              <option value="PENDING">미배정</option>
              <option value="CHECKED_OUT">퇴실완료</option>
              <option value="CANCELLED">취소</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">OTA 채널</label>
            <select
              value={searchOta}
              onChange={(e) => { const v = e.target.value; setSearchOta(v); void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, searchTag, v); }}
              className="w-full rounded border border-slate-300 bg-white p-1 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="">(전체 채널)</option>
              <option value="AGODA">Agoda</option>
              <option value="BOOKING_COM">Booking.com</option>
              <option value="EXPEDIA">Expedia</option>
              <option value="RAKUTEN">Rakuten</option>
              <option value="TRIP_COM">Trip.com</option>
              <option value="AIRBNB">Airbnb</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">체크인 일자</label>
            <input
              type="date"
              value={searchCheckInDate}
              onChange={(e) => { const v = e.target.value; setSearchCheckInDate(v); void executeSearch(searchGuestName, searchReservationId, v, searchStayingDate, searchStatus, searchTag, searchOta); }}
              className="w-full rounded border border-slate-300 bg-white p-1 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600">재실 체류일자</label>
            <input
              type="date"
              value={searchStayingDate}
              onChange={(e) => { const v = e.target.value; setSearchStayingDate(v); void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, v, searchStatus, searchTag, searchOta); }}
              className="w-full rounded border border-slate-300 bg-white p-1 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 4. 데이터 그리드 테이블 (예약 채널 열 신설) */}
      <div className="overflow-hidden rounded border border-slate-300 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3.5 py-1.5">
          <span className="text-xs font-medium text-slate-600">
            조회 결과: <b className="font-bold text-slate-900">{filteredAndSortedList.length}</b>건
          </span>
          <span className="text-[11px] text-slate-400">
            채널 및 요청사항 독립 색인 적용 중
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 select-none">
                <th onClick={() => handleSort('roomNumber')} className="w-20 cursor-pointer px-3 py-2 hover:bg-slate-200">
                  <div className="flex items-center gap-1 font-bold">호실 {renderSortIcon('roomNumber')}</div>
                </th>
                <th onClick={() => handleSort('status')} className="w-24 cursor-pointer px-3 py-2 hover:bg-slate-200">
                  <div className="flex items-center gap-1 font-bold">상태 {renderSortIcon('status')}</div>
                </th>
                <th onClick={() => handleSort('channel')} className="w-28 cursor-pointer px-3 py-2 hover:bg-slate-200">
                  <div className="flex items-center gap-1 font-bold"><Globe size={11} /> 예약 채널 {renderSortIcon('channel')}</div>
                </th>
                <th onClick={() => handleSort('reservationId')} className="w-32 cursor-pointer px-3 py-2 hover:bg-slate-200">
                  <div className="flex items-center gap-1 font-bold">예약ID {renderSortIcon('reservationId')}</div>
                </th>
                <th onClick={() => handleSort('guestName')} className="w-36 cursor-pointer px-3 py-2 hover:bg-slate-200">
                  <div className="flex items-center gap-1 font-bold">고객 성명 {renderSortIcon('guestName')}</div>
                </th>
                <th className="w-32 px-3 py-2 font-bold">계약 룸타입</th>
                <th onClick={() => handleSort('checkInDate')} className="w-28 cursor-pointer px-3 py-2 hover:bg-slate-200">
                  <div className="flex items-center gap-1 font-bold">체크인 {renderSortIcon('checkInDate')}</div>
                </th>
                <th onClick={() => handleSort('stayNights')} className="w-16 cursor-pointer px-3 py-2 text-center hover:bg-slate-200">
                  <div className="flex items-center justify-center gap-1 font-bold">박수 {renderSortIcon('stayNights')}</div>
                </th>
                <th className="px-3 py-2 font-bold">고객 요청 메모 및 AI 태그</th>
                <th className="w-16 px-3 py-2 text-center font-bold">제어</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    <Search size={22} className="mx-auto mb-1 block opacity-30" />
                    일치하는 예약 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((res) => {
                  const pref = res.tagPreference?.preferredTags || [];
                  const avoid = res.tagPreference?.avoidTags || [];

                  // 인계 메모에서 [OTA] 프리픽스를 제외한 순수 고객 요청 텍스트 추출
                  let cleanNote = res.rawRequestText || '';
                  if (!cleanNote && res.internalStaffMemo) {
                    cleanNote = res.internalStaffMemo.replace(/^\[.*?\]\s*/, '');
                  }

                  return (
                    <tr key={res.reservationId} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className={`px-3 py-2 font-mono font-bold ${res.assignedRoomNumber ? 'text-blue-700' : 'text-slate-400'}`}>
                        {res.assignedRoomNumber ? `${res.assignedRoomNumber}호` : '-'}
                      </td>
                      <td className="px-3 py-2">{getStatusBadge(res.status)}</td>
                      <td className="px-3 py-2">{getOtaBadge(res.channelInfo?.channelType)}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">{res.reservationId}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{res.operationalGuestName || res.guestName}</td>
                      <td className="px-3 py-2 text-slate-600">{res.roomType || res.bookedRoomType}</td>
                      <td className="px-3 py-2 text-slate-600">{res.checkInDate}</td>
                      <td className="px-3 py-2 text-center font-medium text-slate-800">{res.stayNights}박</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                          {cleanNote && (
                            <span className="truncate max-w-[220px] text-slate-700 font-medium" title={cleanNote}>
                              {cleanNote}
                            </span>
                          )}
                          {pref.map(t => (
                            <span key={t} className="rounded border border-emerald-300 bg-emerald-50 px-1 py-0.2 text-[10px] text-emerald-800 shrink-0">
                              +{t}
                            </span>
                          ))}
                          {avoid.map(t => (
                            <span key={t} className="rounded border border-rose-300 bg-rose-50 px-1 py-0.2 text-[10px] text-rose-800 shrink-0">
                              -{t}
                            </span>
                          ))}
                          {!cleanNote && pref.length === 0 && avoid.length === 0 && (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => onSelectReservation(res)}
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-100"
                        >
                          열기
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}