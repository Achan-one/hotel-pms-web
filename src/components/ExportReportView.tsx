import { useState } from 'react';
import { pmsService } from '../api/pmsService';
import { FileDown, Users, BookmarkCheck, Tag, Building, Layers } from 'lucide-react';

interface Props {
  businessDate: string;
}

export default function ExportReportView({ businessDate }: Props) {
  const [stayTargetDate, setStayTargetDate] = useState(businessDate);
  const [isStayingDownloading, setIsStayingDownloading] = useState(false);

  const [reserveStartDate, setReserveStartDate] = useState(businessDate);
  const [reserveStatus, setReserveStatus] = useState<string>('');
  const [isReserveDownloading, setIsReserveDownloading] = useState(false);

  const [tagTargetDate, setTagTargetDate] = useState(businessDate);
  const [isTagDownloading, setIsTagDownloading] = useState(false);

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
    <div className="flex max-w-[1050px] flex-col gap-6 text-slate-100">
      {/* 타이틀 배너 */}
      <div className="rounded-xl border border-white/10 bg-[#131d36] p-7">
        <div className="mb-1.5 flex items-center gap-2.5">
          <FileDown className="h-6 w-6 text-sky-400" />
          <h2 className="text-xl font-bold">운영 데이터 및 실무 리포트 엑스포트 (CSV)</h2>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          프론트 데스크 실무 보고서 및 룸-태그 인벤토리 매트릭스를 UTF-8 BOM CSV 형식으로 즉시 추출합니다.
        </p>
      </div>

      {/* 리포트 카드 그리드 (2열) */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* 리포트 1: 숙박자 리스트 (In-House) */}
        <div className="flex flex-col justify-between gap-5 rounded-xl border border-white/10 bg-[#131d36] p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-400">
              <Users size={20} />
              <h3 className="text-base font-bold">1. 숙박자 리스트 (In-House)</h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">
              체류일자 기준 실제 투숙(재실) 중인 인원 목록입니다. (기준 영업일자: {businessDate} 초과 불가)
            </p>

            <label className="mb-1 block text-xs text-slate-300">체류 기준 일자</label>
            <input
              type="date"
              max={businessDate}
              value={stayTargetDate}
              onChange={(e) => setStayTargetDate(e.target.value)}
              className="w-full rounded border border-[#293548] bg-[#0b1329] p-2 text-xs text-white focus:border-sky-400"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadInHouse}
            disabled={isStayingDownloading}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-600 p-2.5 text-xs font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed"
          >
            <FileDown size={15} />
            {isStayingDownloading ? 'CSV 생성 중...' : '숙박자 CSV 다운로드'}
          </button>
        </div>

        {/* 리포트 2: 예약자 리스트 (Bookings) */}
        <div className="flex flex-col justify-between gap-5 rounded-xl border border-white/10 bg-[#131d36] p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sky-400">
              <BookmarkCheck size={20} />
              <h3 className="text-base font-bold">2. 예약자 리스트</h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">
              선택한 체크인 일자의 전체 예약 원장과 배정 상태를 출력합니다.
            </p>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-300">체크인 일자</label>
                <input
                  type="date"
                  value={reserveStartDate}
                  onChange={(e) => setReserveStartDate(e.target.value)}
                  className="w-full rounded border border-[#293548] bg-[#0b1329] p-2 text-xs text-white focus:border-sky-400"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-300">상태 필터</label>
                <select
                  value={reserveStatus}
                  onChange={(e) => setReserveStatus(e.target.value)}
                  className="w-full rounded border border-[#293548] bg-[#0b1329] p-2 text-xs text-white focus:border-sky-400"
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
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 p-2.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed"
          >
            <FileDown size={15} />
            {isReserveDownloading ? 'CSV 생성 중...' : '예약자 CSV 다운로드'}
          </button>
        </div>

        {/* 리포트 3: 태그 & 요청사항 리스트 */}
        <div className="flex flex-col justify-between gap-5 rounded-xl border border-white/10 bg-[#131d36] p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-purple-400">
              <Tag size={20} />
              <h3 className="text-base font-bold">3. 태그 & 요청사항 리스트</h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">
              고객 원문 요청, AI 파싱 태그, <b>배정 객실의 실제 보유 태그</b> 및 HARD 제약 미충족 사유를 전수 대조합니다.
            </p>

            <label className="mb-1 block text-xs text-slate-300">도착 기준 일자</label>
            <input
              type="date"
              value={tagTargetDate}
              onChange={(e) => setTagTargetDate(e.target.value)}
              className="w-full rounded border border-[#293548] bg-[#0b1329] p-2 text-xs text-white focus:border-sky-400"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadSpecialRequests}
            disabled={isTagDownloading}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-purple-600 p-2.5 text-xs font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed"
          >
            <FileDown size={15} />
            {isTagDownloading ? 'CSV 생성 중...' : '태그 & 요청사항 CSV 다운로드'}
          </button>
        </div>

        {/* 리포트 4: 룸 태그 인디케이터 (인벤토리) */}
        <div className="flex flex-col justify-between gap-5 rounded-xl border border-white/10 bg-[#131d36] p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-amber-400">
              <Layers size={20} />
              <h3 className="text-base font-bold">4. 룸 태그 인디케이터 (인벤토리)</h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">
              191실 전 객실의 보유 태그 목록(방 기준)과 각 태그별 배치 객실 번호 목록(태그 기준)을 다운로드합니다.
            </p>

            <div className="rounded border border-dashed border-slate-700 bg-[#0b1329] p-2.5 text-[11px] text-slate-400">
              건축 물리 특성 및 어드민 커스텀 태그 전체 반영
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadRoomTags}
              disabled={isRoomTagsDownloading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-600 p-2.5 text-xs font-bold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed"
            >
              <Building size={14} />
              {isRoomTagsDownloading ? '생성 중...' : '방별 태그 CSV'}
            </button>

            <button
              type="button"
              onClick={handleDownloadTagMatrix}
              disabled={isTagMatrixDownloading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-700 p-2.5 text-xs font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed"
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