import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ReservationDetailDto } from '../api/pmsService';
import { pmsService } from '../api/pmsService';
import apiClient from '../api/client';
import {
  Search, Settings, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Tag as TagIcon, X
} from 'lucide-react';

interface Props {
  businessDate: string;
  onSelectReservation: (reservation: ReservationDetailDto) => void;
}

type SortField = 'roomNumber' | 'guestName' | 'reservationId' | 'checkInDate' | 'stayNights' | 'status';
type SortOrder = 'asc' | 'desc';

export default function ReservationGridView({ businessDate, onSelectReservation }: Props) {
  const [reservationList, setReservationList] = useState<ReservationDetailDto[]>([]);
  const [loading, setLoading] = useState(false);

  // 검색 조건
  const [searchGuestName, setSearchGuestName] = useState('');
  const [searchReservationId, setSearchReservationId] = useState('');
  const [searchCheckInDate, setSearchCheckInDate] = useState('');
  const [searchStayingDate, setSearchStayingDate] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchTag, setSearchTag] = useState('');

  // 🏷️ 태그 팝오버 및 카탈로그
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [registeredTags, setRegisteredTags] = useState<Array<{ code: string; name: string }>>([]);

  // 정렬
  const [sortField, setSortField] = useState<SortField>('roomNumber');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // 태그 사전 목록 로드
  useEffect(() => {
    apiClient.get('/api/admin/tags')
      .then((res) => {
        const list = res.data?.data || [];
        setRegisteredTags(list.map((t: any) => ({ code: t.code, name: t.name })));
      })
      .catch(() => console.error('태그 사전 로드 실패'));
  }, []);

  const executeSearch = useCallback(async (
    gName = searchGuestName,
    rId = searchReservationId,
    cDate = searchCheckInDate,
    sDate = searchStayingDate,
    stat = searchStatus,
    tagVal = searchTag
  ) => {
    setLoading(true);
    try {
      const list = await pmsService.getReservations({
        guestName: gName.trim() || undefined,
        reservationId: rId.trim() || undefined,
        checkInDate: cDate || undefined,
        stayingDate: sDate || undefined,
        status: stat || undefined,
        tag: tagVal.trim() || undefined
      });
      setReservationList(list);
    } catch (err) {
      console.error('예약 검색 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, searchTag]);

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

  // 💡 [핵심] 백엔드 필터링 + 프론트엔드 즉각 매칭 2중 방어 필터링
  const filteredAndSortedList = useMemo(() => {
    let result = [...reservationList];

    // 태그 필터가 켜져 있으면 클라이언트 메모리 상에서도 완벽 일치 보장
    if (searchTag.trim()) {
      const q = searchTag.trim().toUpperCase();
      result = result.filter(r => {
        const prefMatch = r.tagPreference?.preferredTags?.some(t => t.toUpperCase().includes(q));
        const avoidMatch = r.tagPreference?.avoidTags?.some(t => t.toUpperCase().includes(q));
        const memoMatch = r.rawRequestText?.toUpperCase().includes(q) || r.rawRequestText?.includes(searchTag.trim());
        return prefMatch || avoidMatch || memoMatch;
      });
    }

    // 정렬 수행
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
    if (sortField !== field) return <ArrowUpDown size={11} color="#475569" />;
    return sortOrder === 'asc' ? <ArrowUp size={11} color="#38bdf8" /> : <ArrowDown size={11} color="#38bdf8" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CHECKED_IN':
        return <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', whiteSpace: 'nowrap' }}>투숙중</span>;
      case 'ASSIGNED':
        return <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', whiteSpace: 'nowrap' }}>배정완료</span>;
      case 'PENDING':
        return <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', whiteSpace: 'nowrap' }}>미배정</span>;
      case 'CHECKED_OUT':
        return <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', whiteSpace: 'nowrap' }}>퇴실완료</span>;
      default:
        return <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#1e293b', color: '#64748b', whiteSpace: 'nowrap' }}>{status}</span>;
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      
      {/* 1. 상단 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
            예약 원장 및 정밀 데이터 그리드
          </h2>
          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600 }}>
            Live Grid
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setSearchGuestName(''); setSearchReservationId(''); setSearchCheckInDate('');
            setSearchStayingDate(''); setSearchStatus(''); setSearchTag('');
            void executeSearch('', '', '', '', '', '');
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.35rem 0.75rem', borderRadius: '5px', border: '1px solid rgba(255, 255, 255, 0.12)', backgroundColor: '#131d36', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
        >
          <RefreshCw size={12} className={loading ? 'spin' : ''} /> 조건 초기화
        </button>
      </div>

      {/* 2. 퀵 필터 칩 바 & 🏷️ 태그 팝오버 창 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '3px', padding: '3px', backgroundColor: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          {[
            { label: '전체', active: !searchCheckInDate && !searchStayingDate && !searchStatus, onClick: () => { setSearchCheckInDate(''); setSearchStayingDate(''); setSearchStatus(''); void executeSearch(searchGuestName, searchReservationId, '', '', '', searchTag); } },
            { label: '당일 도착', active: searchCheckInDate === businessDate, dotColor: '#10b981', onClick: () => { const nCI = searchCheckInDate === businessDate ? '' : businessDate; setSearchCheckInDate(nCI); setSearchStayingDate(''); setSearchStatus(''); void executeSearch(searchGuestName, searchReservationId, nCI, '', '', searchTag); } },
            { label: '현재 재실', active: searchStatus === 'CHECKED_IN', dotColor: '#ef4444', onClick: () => { const nStay = searchStayingDate === businessDate ? '' : businessDate; const nStat = searchStatus === 'CHECKED_IN' ? '' : 'CHECKED_IN'; setSearchStayingDate(nStay); setSearchCheckInDate(''); setSearchStatus(nStat); void executeSearch(searchGuestName, searchReservationId, '', nStay, nStat, searchTag); } },
            { label: '배정 완료', active: searchStatus === 'ASSIGNED', dotColor: '#3b82f6', onClick: () => { const nStat = searchStatus === 'ASSIGNED' ? '' : 'ASSIGNED'; setSearchStatus(nStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', nStat, searchTag); } },
            { label: '미배정', active: searchStatus === 'PENDING', dotColor: '#f59e0b', onClick: () => { const nStat = searchStatus === 'PENDING' ? '' : 'PENDING'; setSearchStatus(nStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', nStat, searchTag); } },
            { label: '취소', active: searchStatus === 'CANCELLED', dotColor: '#64748b', onClick: () => { const nStat = searchStatus === 'CANCELLED' ? '' : 'CANCELLED'; setSearchStatus(nStat); setSearchCheckInDate(''); setSearchStayingDate(''); void executeSearch(searchGuestName, searchReservationId, '', '', nStat, searchTag); } },
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={chip.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '0.35rem 0.7rem', borderRadius: '4px', border: 'none',
                backgroundColor: chip.active ? '#1e293b' : 'transparent',
                color: chip.active ? '#f8fafc' : '#94a3b8',
                borderBottom: chip.active ? '2px solid #38bdf8' : '2px solid transparent',
                fontSize: '0.75rem', fontWeight: chip.active ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {chip.dotColor && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: chip.dotColor }} />}
              {chip.label}
            </button>
          ))}
        </div>

        {/* 🏷️ 태그 팝오버 필터 선택 버튼 */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsTagPopoverOpen(prev => !prev)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '0.4rem 0.8rem', borderRadius: '6px',
              backgroundColor: searchTag ? 'rgba(56, 189, 248, 0.25)' : '#0f172a',
              border: `1px solid ${searchTag ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)'}`,
              color: searchTag ? '#38bdf8' : '#cbd5e1',
              fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <TagIcon size={12} />
            {searchTag ? `필터 태그: ${searchTag}` : '🏷️ 태그 카탈로그 필터...'}
          </button>

          {isTagPopoverOpen && (
            <div style={{
              position: 'absolute', top: '115%', left: 0, zIndex: 100,
              backgroundColor: '#131d36', border: '1px solid #38bdf8', borderRadius: '8px',
              padding: '0.8rem', width: '340px', boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>필터링할 태그를 선택하세요</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {searchTag && (
                    <button
                      onClick={() => {
                        setSearchTag('');
                        void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, '');
                        setIsTagPopoverOpen(false);
                      }}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}
                    >
                      필터 해제
                    </button>
                  )}
                  <button onClick={() => setIsTagPopoverOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '160px', overflowY: 'auto' }}>
                {registeredTags.map(t => {
                  const isSelected = searchTag === t.code;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => {
                        setSearchTag(t.code);
                        void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, t.code);
                        setIsTagPopoverOpen(false);
                      }}
                      style={{
                        padding: '3px 7px', borderRadius: '4px',
                        border: isSelected ? '1px solid #38bdf8' : '1px solid #293548',
                        backgroundColor: isSelected ? '#0284c7' : '#0b1329',
                        color: isSelected ? '#fff' : '#cbd5e1',
                        fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      {t.name} <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>({t.code})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. 인풋 필터 바 */}
      <div style={{ backgroundColor: '#131d36', padding: '0.8rem 1rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '3px' }}>
              <Search size={10} color="#38bdf8" /> 예약자 성명
            </label>
            <input
              type="text" placeholder="성명 검색..." value={searchGuestName}
              onChange={(e) => { const v = e.target.value; setSearchGuestName(v); void executeSearch(v, searchReservationId, searchCheckInDate, searchStayingDate, searchStatus, searchTag); }}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.78rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '3px' }}>
              <Search size={10} color="#38bdf8" /> 예약ID
            </label>
            <input
              type="text" placeholder="예약번호..." value={searchReservationId}
              onChange={(e) => { const v = e.target.value; setSearchReservationId(v); void executeSearch(searchGuestName, v, searchCheckInDate, searchStayingDate, searchStatus, searchTag); }}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.78rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '3px' }}>상태 필터</label>
            <select
              value={searchStatus}
              onChange={(e) => { const v = e.target.value; setSearchStatus(v); void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, searchStayingDate, v, searchTag); }}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.78rem', boxSizing: 'border-box' }}
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
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '3px' }}>체크인 일자</label>
            <input
              type="date" value={searchCheckInDate}
              onChange={(e) => { const v = e.target.value; setSearchCheckInDate(v); void executeSearch(searchGuestName, searchReservationId, v, searchStayingDate, searchStatus, searchTag); }}
              style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.78rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#fbbf24', marginBottom: '3px' }}>재실 체류일자</label>
            <input
              type="date" value={searchStayingDate}
              onChange={(e) => { const v = e.target.value; setSearchStayingDate(v); void executeSearch(searchGuestName, searchReservationId, searchCheckInDate, v, searchStatus, searchTag); }}
              style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.78rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      {/* 4. 📋 단정형 PMS 테이블 (white-space: nowrap 적용) */}
      <div style={{ backgroundColor: '#131d36', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', backgroundColor: '#0b1329', borderBottom: '1px solid #293548' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            조회 결과: <b style={{ color: '#38bdf8' }}>{filteredAndSortedList.length}</b>건
          </span>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
            헤더(호실/상태/성명/일정) 클릭 시 즉시 정렬
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #293548', userSelect: 'none' }}>
                <th onClick={() => handleSort('roomNumber')} style={{ padding: '0.65rem 0.9rem', cursor: 'pointer', width: '85px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>호실 {renderSortIcon('roomNumber')}</div>
                </th>
                <th onClick={() => handleSort('status')} style={{ padding: '0.65rem 0.9rem', cursor: 'pointer', width: '90px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>상태 {renderSortIcon('status')}</div>
                </th>
                <th onClick={() => handleSort('reservationId')} style={{ padding: '0.65rem 0.9rem', cursor: 'pointer', width: '120px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>예약ID {renderSortIcon('reservationId')}</div>
                </th>
                <th onClick={() => handleSort('guestName')} style={{ padding: '0.65rem 0.9rem', cursor: 'pointer', width: '140px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>투숙객 성명 {renderSortIcon('guestName')}</div>
                </th>
                <th style={{ padding: '0.65rem 0.9rem', width: '130px' }}>계약 룸타입</th>
                <th onClick={() => handleSort('checkInDate')} style={{ padding: '0.65rem 0.9rem', cursor: 'pointer', width: '105px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>체크인 {renderSortIcon('checkInDate')}</div>
                </th>
                <th onClick={() => handleSort('stayNights')} style={{ padding: '0.65rem 0.9rem', cursor: 'pointer', width: '60px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>박수 {renderSortIcon('stayNights')}</div>
                </th>
                <th style={{ padding: '0.65rem 0.9rem' }}>AI 추출 선호 / 기피 태그</th>
                <th style={{ padding: '0.65rem 0.9rem', width: '75px', textAlign: 'center' }}>제어</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                    <Search size={28} style={{ margin: '0 auto 6px auto', display: 'block', opacity: 0.3 }} />
                    일치하는 예약 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((res) => {
                  const pref = res.tagPreference?.preferredTags || [];
                  const avoid = res.tagPreference?.avoidTags || [];

                  return (
                    <tr key={res.reservationId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.15s' }}>
                      <td style={{ padding: '0.6rem 0.9rem', fontWeight: 800, color: res.assignedRoomNumber ? '#34d399' : '#f87171', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                        {res.assignedRoomNumber ? `${res.assignedRoomNumber}호` : '미배정'}
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>{getStatusBadge(res.status)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', fontFamily: 'monospace', color: '#38bdf8' }}>{res.reservationId}</td>
                      <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600, color: '#f8fafc' }}>{res.operationalGuestName || res.guestName}</td>
                      <td style={{ padding: '0.6rem 0.9rem', color: '#94a3b8' }}>{res.roomType || res.bookedRoomType}</td>
                      <td style={{ padding: '0.6rem 0.9rem', color: '#cbd5e1' }}>{res.checkInDate}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center', fontWeight: 700, color: '#f8fafc' }}>{res.stayNights}박</td>
                      <td style={{ padding: '0.6rem 0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                          {pref.map(t => (
                            <span key={t} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
                              +{t}
                            </span>
                          ))}
                          {avoid.map(t => (
                            <span key={t} style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700 }}>
                              -{t}
                            </span>
                          ))}
                          {pref.length === 0 && avoid.length === 0 && (
                            <span style={{ fontSize: '0.7rem', color: '#475569' }}>-</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'center' }}>
                        <button
                          onClick={() => onSelectReservation(res)}
                          style={{ padding: '0.3rem 0.65rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}
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