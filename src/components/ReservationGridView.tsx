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

type SortField = 'roomNumber' | 'guestName' | 'reservationId' | 'checkInDate' | 'stayNights' | 'status';
type SortOrder = 'asc' | 'desc';

const GRID_STATE_SESSION_KEY = 'PMS_RESERVATION_GRID_STATE_V1';

export default function ReservationGridView({ businessDate, onSelectReservation }: Props) {
  const savedState = useMemo(() => {
    try {
      const saved = sessionStorage.getItem(GRID_STATE_SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore JSON parse error
    }
    return {};
  }, []);

  const [reservationList, setReservationList] = useState<ReservationDetailDto[]>([]);
  const [loading, setLoading] = useState(false);

  // 검색 조건
  const [searchGuestName, setSearchGuestName] = useState<string>(savedState.guestName ?? '');
  const [searchReservationId, setSearchReservationId] = useState<string>(savedState.reservationId ?? '');
  const [searchCheckInDate, setSearchCheckInDate] = useState<string>(savedState.checkInDate ?? '');
  const [searchStayingDate, setSearchStayingDate] = useState<string>(savedState.stayingDate ?? '');
  const [searchStatus, setSearchStatus] = useState<string>(savedState.status ?? '');
  const [searchTag, setSearchTag] = useState<string>(savedState.tag ?? '');
  const [searchOta, setSearchOta] = useState<string>(savedState.otaChannel ?? '');

  // 태그 팝오버 및 카탈로그
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [registeredTags, setRegisteredTags] = useState<Array<{ code: string; name: string }>>([]);

  // 정렬 조건
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
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reservationList, searchTag, sortField, sortOrder]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={11} className="text-slate-500" />;
    return sortOrder === 'asc' ? <ArrowUp size={11} className="text-sky-400" /> : <ArrowDown size={11} className="text-sky-400" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CHECKED_IN':
        return <span className="rounded border border-red-500/40 bg-red-500/20 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-red-400">투숙중</span>;
      case 'ASSIGNED':
        return <span className="rounded border border-blue-500/40 bg-blue-500/20 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-blue-400">배정완료</span>;
      case 'PENDING':
        return <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-amber-400">미배정</span>;
      case 'CHECKED_OUT':
        return <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-slate-400">퇴실완료</span>;
      case 'CANCELLED':
        return <span className="rounded border border-red-800 bg-red-950 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-red-300">취소(노쇼)</span>;
      default:
        return <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="flex w-full flex-col gap-3.5">
      {/* 1. 상단 바: 타이틀 & 초기화 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-100">
            예약 원장 및 정밀 데이터 그리드
          </h2>
          <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-sky-400">
            Live Grid
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
          className="flex items-center gap-1.5 rounded border border-white/10 bg-[#131d36] px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          <RefreshCw size={12} className={loading ? 'spin' : ''} /> 조건 초기화
        </button>
      </div>

      {/* 2. 퀵 필터 칩 바 & 태그 팝오버 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md border border-white/5 bg-slate-900 p-1">
          {[
            { label: '전체', active: !searchCheckInDate && !searchStayingDate && !searchStatus, onClick: () => { setSearchCheckInDate(''); setSearchStayingDate(''); setSearchStatus(''); void executeSearch(searchGuestName, searchReservationId, '', '', '', searchTag, searchOta); } },
            { label: '당일 도착', active: searchCheckInDate === businessDate, dotColor: 'bg-emerald-500', onClick: () => { const nCI = searchCheckInDate === businessDate ? '' : businessDate; setSearchCheckInDate(nCI); setSearchStayingDate(''); setSearchStatus(''); void executeSearch(searchGuestName, searchReservationId, nCI, '', '', searchTag, searchOta); } },
            { label: '현재 재실', active: searchStatus === 'CHECKED_IN', dotColor: 'bg-red-500', onClick: () => { const nStay = searchStayingDate === businessDate ? '' : businessDate; const nStat = searchStatus === 'CHECKED_IN' ? '' : 'CHECKED_IN'; setSearchStayingDate(nStay); setSearchCheckInDate(''); setSearchStatus(nStat); void executeSearch(searchGuestName, searchReservationId, '', nStay, nStat, searchTag, searchOta); } },
            { label: '배정 완료', active: searchStatus === 'ASSIGNED', dotColor: 'bg-blue-500', onClick: () => { const nStat = searchStatus === 'ASSIGNED' ? '' : 'ASSIGNED'; setSearchStatus(nStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', nStat, searchTag, searchOta); } },
            { label: '미배정', active: searchStatus === 'PENDING', dotColor: 'bg-amber-500', onClick: () => { const nStat = searchStatus === 'PENDING' ? '' : 'PENDING'; setSearchStatus(nStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', nStat, searchTag, searchOta); } },
            { label: '취소/노쇼', active: searchStatus === 'CANCELLED', dotColor: 'bg-slate-500', onClick: () => { const nStat = searchStatus === 'CANCELLED' ? '' : 'CANCELLED'; setSearchStatus(nStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', nStat, searchTag, searchOta); } },
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={chip.onClick}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs whitespace-nowrap transition ${
                chip.active
                  ? 'border-b-2 border-sky-400 bg-slate-800 font-bold text-slate-100'
                  : 'border-b-2 border-transparent font-medium text-slate-400 hover:text-slate-200'
              }`}
            >
              {chip.dotColor && <span className={`h-1.5 w-1.5 rounded-full ${chip.dotColor}`} />}
              {chip.label}
            </button>
          ))}
        </div>

        {/* 태그 팝오버 필터 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsTagPopoverOpen(prev => !prev)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${
              searchTag
                ? 'border-sky-400 bg-sky-400/20 text-sky-400'
                : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <TagIcon size={12} />
            {searchTag ? `선택 태그: ${searchTag}` : '🏷️ 태그 카탈로그 필터...'}
          </button>

          {isTagPopoverOpen && (
            <div className="absolute top-[115%] left-0 z-50 flex w-[340px] flex-col gap-2 rounded-lg border border-sky-400 bg-[#131d36] p-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <span className="text-xs font-bold text-slate-100">필터링할 태그를 선택하세요</span>
                <div className="flex items-center gap-1.5">
                  {searchTag && (
                    <button
                      onClick={() => {
                        setSearchTag('');
                        void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, '', searchOta);
                        setIsTagPopoverOpen(false);
                      }}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300"
                    >
                      필터 해제
                    </button>
                  )}
                  <button onClick={() => setIsTagPopoverOpen(false)} className="text-slate-400 hover:text-slate-200">
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="flex max-h-[160px] flex-wrap gap-1.5 overflow-y-auto pr-1">
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
                      className={`rounded px-2 py-1 text-xs font-semibold transition ${
                        isSelected
                          ? 'border border-sky-400 bg-sky-600 text-white'
                          : 'border border-[#293548] bg-[#0b1329] text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {t.name} <span className="text-[10px] opacity-60">({t.code})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. 인풋 필터 바 6열 */}
      <div className="rounded-md border border-white/10 bg-[#131d36] p-3 px-4">
        <div className="grid grid-cols-6 gap-2">
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] text-slate-400">
              <Search size={10} className="text-sky-400" /> 예약자 성명
            </label>
            <input
              type="text"
              placeholder="성명 검색..."
              value={searchGuestName}
              onChange={(e) => { const v = e.target.value; setSearchGuestName(v); void executeSearch(v, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, searchTag, searchOta); }}
              className="w-full rounded border border-[#293548] bg-[#0b1329] p-2 text-xs text-white focus:border-sky-400"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] text-slate-400">
              <Search size={10} className="text-sky-400" /> 예약ID
            </label>
            <input
              type="text"
              placeholder="예약번호..."
              value={searchReservationId}
              onChange={(e) => { const v = e.target.value; setSearchReservationId(v); void executeSearch(searchGuestName, v, searchCheckInDate, searchStayingDate, searchStatus, searchTag, searchOta); }}
              className="w-full rounded border border-[#293548] bg-[#0b1329] p-2 font-mono text-xs text-white focus:border-sky-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">상태 필터</label>
            <select
              value={searchStatus}
              onChange={(e) => { const v = e.target.value; setSearchStatus(v); void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, v, searchTag, searchOta); }}
              className="w-full rounded border border-[#293548] bg-[#0b1329] p-2 text-xs text-white focus:border-sky-400"
            >
              <option value="">(전체 상태)</option>
              <option value="CHECKED_IN">투숙중</option>
              <option value="ASSIGNED">배정완료</option>
              <option value="PENDING">미배정</option>
              <option value="CHECKED_OUT">퇴실완료</option>
              <option value="CANCELLED">취소(노쇼)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] text-sky-400">
              <Globe size={10} /> OTA 채널
            </label>
            <select
              value={searchOta}
              onChange={(e) => { const v = e.target.value; setSearchOta(v); void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, searchTag, v); }}
              className="w-full rounded border border-sky-400 bg-[#0b1329] p-2 text-xs font-semibold text-sky-400 focus:border-sky-300"
            >
              <option value="">(전체 OTA)</option>
              <option value="AGODA">Agoda</option>
              <option value="BOOKING_COM">Booking.com</option>
              <option value="EXPEDIA">Expedia</option>
              <option value="RAKUTEN">Rakuten</option>
              <option value="TRIP_COM">Trip.com</option>
              <option value="AIRBNB">Airbnb</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">체크인 일자</label>
            <input
              type="date"
              value={searchCheckInDate}
              onChange={(e) => { const v = e.target.value; setSearchCheckInDate(v); void executeSearch(searchGuestName, searchReservationId, v, searchStayingDate, searchStatus, searchTag, searchOta); }}
              className="w-full rounded border border-[#293548] bg-[#0b1329] p-1.5 text-xs text-white focus:border-sky-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-amber-400">재실 체류일자</label>
            <input
              type="date"
              value={searchStayingDate}
              onChange={(e) => { const v = e.target.value; setSearchStayingDate(v); void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, v, searchStatus, searchTag, searchOta); }}
              className="w-full rounded border border-[#293548] bg-[#0b1329] p-1.5 text-xs text-white focus:border-sky-400"
            />
          </div>
        </div>
      </div>

      {/* 4. PMS 테이블 */}
      <div className="overflow-hidden rounded-md border border-white/10 bg-[#131d36]">
        <div className="flex items-center justify-between border-b border-[#293548] bg-[#0b1329] px-4 py-2.5">
          <span className="text-xs text-slate-400">
            조회 결과: <b className="font-bold text-sky-400">{filteredAndSortedList.length}</b>건
          </span>
          <span className="text-[11px] text-slate-500">
            선택한 정렬 컬럼/방향은 상세 페이지를 다녀와도 그대로 유지됩니다
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#293548] bg-slate-900 text-slate-400 select-none">
                <th onClick={() => handleSort('roomNumber')} className="w-[85px] cursor-pointer px-3.5 py-2.5 hover:text-slate-200">
                  <div className="flex items-center gap-1">호실 {renderSortIcon('roomNumber')}</div>
                </th>
                <th onClick={() => handleSort('status')} className="w-[90px] cursor-pointer px-3.5 py-2.5 hover:text-slate-200">
                  <div className="flex items-center gap-1">상태 {renderSortIcon('status')}</div>
                </th>
                <th onClick={() => handleSort('reservationId')} className="w-[120px] cursor-pointer px-3.5 py-2.5 hover:text-slate-200">
                  <div className="flex items-center gap-1">예약ID {renderSortIcon('reservationId')}</div>
                </th>
                <th onClick={() => handleSort('guestName')} className="w-[140px] cursor-pointer px-3.5 py-2.5 hover:text-slate-200">
                  <div className="flex items-center gap-1">투숙객 성명 {renderSortIcon('guestName')}</div>
                </th>
                <th className="w-[130px] px-3.5 py-2.5">계약 룸타입</th>
                <th onClick={() => handleSort('checkInDate')} className="w-[105px] cursor-pointer px-3.5 py-2.5 hover:text-slate-200">
                  <div className="flex items-center gap-1">체크인 {renderSortIcon('checkInDate')}</div>
                </th>
                <th onClick={() => handleSort('stayNights')} className="w-[60px] cursor-pointer px-3.5 py-2.5 text-center hover:text-slate-200">
                  <div className="flex items-center justify-center gap-1">박수 {renderSortIcon('stayNights')}</div>
                </th>
                <th className="px-3.5 py-2.5">고객 요청 / AI 추출 태그</th>
                <th className="w-[75px] px-3.5 py-2.5 text-center">제어</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-14 text-center text-slate-500">
                    <Search size={28} className="mx-auto mb-1.5 block opacity-30" />
                    일치하는 예약 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((res) => {
                  const pref = res.tagPreference?.preferredTags || [];
                  const avoid = res.tagPreference?.avoidTags || [];

                  return (
                    <tr key={res.reservationId} className="border-b border-white/5 transition hover:bg-white/[0.02]">
                      <td className={`px-3.5 py-2.5 font-mono text-sm font-extrabold ${res.assignedRoomNumber ? 'text-emerald-400' : 'text-red-400'}`}>
                        {res.assignedRoomNumber ? `${res.assignedRoomNumber}호` : '미배정'}
                      </td>
                      <td className="px-3.5 py-2.5">{getStatusBadge(res.status)}</td>
                      <td className="px-3.5 py-2.5 font-mono text-sky-400">{res.reservationId}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-100">{res.operationalGuestName || res.guestName}</td>
                      <td className="px-3.5 py-2.5 text-slate-400">{res.roomType || res.bookedRoomType}</td>
                      <td className="px-3.5 py-2.5 text-slate-300">{res.checkInDate}</td>
                      <td className="px-3.5 py-2.5 text-center font-bold text-slate-100">{res.stayNights}박</td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
                          {res.internalStaffMemo && res.internalStaffMemo.startsWith('[') && (
                            <span className="rounded border border-sky-400/30 bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-400">
                              {res.internalStaffMemo.split(']')[0] + ']'}
                            </span>
                          )}
                          {pref.map(t => (
                            <span key={t} className="rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                              +{t}
                            </span>
                          ))}
                          {avoid.map(t => (
                            <span key={t} className="rounded border border-red-500/30 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                              -{t}
                            </span>
                          ))}
                          {pref.length === 0 && avoid.length === 0 && !res.internalStaffMemo && (
                            <span className="text-xs text-slate-600">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <button
                          onClick={() => onSelectReservation(res)}
                          className="rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-sky-500"
                        >
                          제어
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