import { useState } from 'react';
import { pmsService } from '../api/pmsService';
import { FileDown, Users, BookmarkCheck, Tag, Building, Layers } from 'lucide-react';

interface Props {
  businessDate: string;
}

export default function ExportReportView({ businessDate }: Props) {
  // 1. 숙박자(In-House) 리스트
  const [stayTargetDate, setStayTargetDate] = useState(businessDate);
  const [isStayingDownloading, setIsStayingDownloading] = useState(false);

  // 2. 예약자(Reservations) 리스트
  const [reserveStartDate, setReserveStartDate] = useState(businessDate);
  const [reserveStatus, setReserveStatus] = useState<string>('');
  const [isReserveDownloading, setIsReserveDownloading] = useState(false);

  // 3. 태그 & 요청사항 리스트 (배정객실보유태그 포함)
  const [tagTargetDate, setTagTargetDate] = useState(businessDate);
  const [isTagDownloading, setIsTagDownloading] = useState(false);

  // 4. 룸 태그 인디케이터 (방별 태그 & 태그별 방)
  const [isRoomTagsDownloading, setIsRoomTagsDownloading] = useState(false);
  const [isTagMatrixDownloading, setIsTagMatrixDownloading] = useState(false);

  const handleDownloadInHouse = async () => {
    if (stayTargetDate > businessDate) {
      alert(`숙박자 리스트는 현재 영업일자(${businessDate}) 이후의 미래 일자로 조회할 수 없습니다.`);
      return;
    }
    setIsStayingDownloading(true);
    try {
      await pmsService.downloadInHouseCsv(stayTargetDate);
    } catch (err) {
      console.error(err);
      alert('숙박자 리스트 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsStayingDownloading(false);
    }
  };

  const handleDownloadReservations = async () => {
    setIsReserveDownloading(true);
    try {
      await pmsService.downloadReservationsCsv(reserveStartDate, reserveStatus || undefined);
    } catch (err) {
      console.error(err);
      alert('예약자 리스트 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsReserveDownloading(false);
    }
  };

  const handleDownloadSpecialRequests = async () => {
    setIsTagDownloading(true);
    try {
      await pmsService.downloadSpecialRequestsCsv(tagTargetDate);
    } catch (err) {
      console.error(err);
      alert('태그 및 요청사항 리스트 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsTagDownloading(false);
    }
  };

  const handleDownloadRoomTags = async () => {
    setIsRoomTagsDownloading(true);
    try {
      await pmsService.downloadRoomTagsCsv();
    } catch (err) {
      console.error(err);
      alert('191실 객실별 보유 태그 CSV 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsRoomTagsDownloading(false);
    }
  };

  const handleDownloadTagMatrix = async () => {
    setIsTagMatrixDownloading(true);
    try {
      await pmsService.downloadTagMatrixCsv();
    } catch (err) {
      console.error(err);
      alert('태그별 보유 객실 매핑 CSV 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsTagMatrixDownloading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1050px', display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#f8fafc' }}>
      
      {/* 타이틀 배너 */}
      <div style={{ backgroundColor: '#131d36', padding: '1.8rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.4rem' }}>
          <FileDown size={26} color="#38bdf8" />
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>운영 데이터 및 실무 리포트 엑스포트 (CSV)</h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
          프론트 데스크 실무 보고서 및 룸-태그 인벤토리 매트릭스를 UTF-8 BOM CSV 형식으로 즉시 추출합니다.
        </p>
      </div>

      {/* 리포트 카드 그리드 (2열) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.2rem' }}>
        
        {/* 리포트 1: 숙박자 리스트 (In-House) */}
        <div style={{ backgroundColor: '#131d36', padding: '1.4rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '0.6rem' }}>
              <Users size={20} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>1. 숙박자 리스트 (In-House)</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1rem' }}>
              체류일자 기준 실제 투숙(재실) 중인 인원 목록입니다. (기준 영업일자: {businessDate} 초과 불가)
            </p>

            <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}>체류 기준 일자</label>
            <input
              type="date"
              max={businessDate}
              value={stayTargetDate}
              onChange={(e) => setStayTargetDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '5px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.82rem', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadInHouse}
            disabled={isStayingDownloading}
            style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', backgroundColor: '#0284c7', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: isStayingDownloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <FileDown size={15} />
            {isStayingDownloading ? 'CSV 생성 중...' : '숙박자 CSV 다운로드'}
          </button>
        </div>

        {/* 리포트 2: 예약자 리스트 (Bookings) */}
        <div style={{ backgroundColor: '#131d36', padding: '1.4rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '0.6rem' }}>
              <BookmarkCheck size={20} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>2. 예약자 리스트</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1rem' }}>
              선택한 체크인 일자의 전체 예약 원장과 배정 상태를 출력합니다.
            </p>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#cbd5e1', marginBottom: '3px' }}>체크인 일자</label>
                <input
                  type="date"
                  value={reserveStartDate}
                  onChange={(e) => setReserveStartDate(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '5px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.78rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#cbd5e1', marginBottom: '3px' }}>상태 필터</label>
                <select
                  value={reserveStatus}
                  onChange={(e) => setReserveStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '5px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.78rem', boxSizing: 'border-box' }}
                >
                  <option value="">(전체 상태)</option>
                  <option value="PENDING">미배정</option>
                  <option value="ASSIGNED">배정완료</option>
                  <option value="CHECKED_IN">투숙중</option>
                  <option value="CHECKED_OUT">퇴실완료</option>
                  <option value="CANCELLED">취소</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadReservations}
            disabled={isReserveDownloading}
            style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', backgroundColor: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: isReserveDownloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <FileDown size={15} />
            {isReserveDownloading ? 'CSV 생성 중...' : '예약자 CSV 다운로드'}
          </button>
        </div>

        {/* 리포트 3: 태그 & 고객 요청사항 리스트 (배정객실보유태그 포함) */}
        <div style={{ backgroundColor: '#131d36', padding: '1.4rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c084fc', marginBottom: '0.6rem' }}>
              <Tag size={20} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>3. 태그 & 요청사항 리스트</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1rem' }}>
              고객 원문 요청, AI 파싱 태그, <b>배정 객실의 실제 보유 태그</b> 및 HARD 제약 미충족 사유를 전수 대조합니다.
            </p>

            <label style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '4px' }}>도착 기준 일자</label>
            <input
              type="date"
              value={tagTargetDate}
              onChange={(e) => setTagTargetDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '5px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.82rem', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadSpecialRequests}
            disabled={isTagDownloading}
            style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: isTagDownloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <FileDown size={15} />
            {isTagDownloading ? 'CSV 생성 중...' : '태그 & 요청사항 CSV 다운로드'}
          </button>
        </div>

        {/* 리포트 4: 룸 태그 인디케이터 (객실 ↔ 태그 양방향 인벤토리) */}
        <div style={{ backgroundColor: '#131d36', padding: '1.4rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', marginBottom: '0.6rem' }}>
              <Layers size={20} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>4. 룸 태그 인디케이터 (인벤토리)</h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '1rem' }}>
              191실 전 객실의 보유 태그 목록(방 기준)과 각 태그별 배치 객실 번호 목록(태그 기준)을 다운로드합니다.
            </p>

            <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#0b1329', borderRadius: '6px', border: '1px dashed #334155', fontSize: '0.74rem', color: '#94a3b8' }}>
              건축 물리 특성 및 어드민 커스텀 태그 전체 반영
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDownloadRoomTags}
              disabled={isRoomTagsDownloading}
              style={{ flex: 1, padding: '0.65rem', borderRadius: '6px', backgroundColor: '#d97706', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.78rem', cursor: isRoomTagsDownloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
            >
              <Building size={14} />
              {isRoomTagsDownloading ? '생성 중...' : '방별 태그 CSV'}
            </button>

            <button
              type="button"
              onClick={handleDownloadTagMatrix}
              disabled={isTagMatrixDownloading}
              style={{ flex: 1, padding: '0.65rem', borderRadius: '6px', backgroundColor: '#b45309', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.78rem', cursor: isTagMatrixDownloading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
            >
              <Tag size={14} />
              {isTagMatrixDownloading ? '생성 중...' : '태그별 방 CSV'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}