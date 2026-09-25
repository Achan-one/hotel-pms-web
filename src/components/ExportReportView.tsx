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
    <div className="flex max-w-[950px] flex-col gap-4 font-sans text-slate-800">
      <div className="rounded border border-slate-300 bg-white p-5 shadow-2xs">
        <div className="mb-1 flex items-center gap-2">
          <FileDown className="h-5 w-5 text-blue-700" />
          <h2 className="text-base font-bold text-slate-900">운영 데이터 및 실무 리포트 엑스포트 (CSV)</h2>
        </div>
        <p className="text-xs text-slate-500">
          프론트 데스크 실무 보고서 및 룸-태그 인벤토리 매트릭스를 UTF-8 BOM CSV 형식으로 즉시 추출합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 리포트 1 */}
        <div className="flex flex-col justify-between gap-4 rounded border border-slate-300 bg-white p-4 shadow-2xs">
          <div>
            <div className="mb-1 flex items-center gap-1.5 font-bold text-slate-800 text-xs">
              <Users size={16} className="text-emerald-700" />
              <span>1. 숙박자 리스트 (In-House)</span>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              체류일자 기준 실제 투숙(재실) 중인 인원 목록입니다. (기준 영업일자: {businessDate} 초과 불가)
            </p>

            <label className="mb-1 block text-[11px] font-semibold text-slate-600">체류 기준 일자</label>
            <input
              type="date"
              max={businessDate}
              value={stayTargetDate}
              onChange={(e) => setStayTargetDate(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadInHouse}
            disabled={isStayingDownloading}
            className="flex w-full items-center justify-center gap-1 rounded bg-slate-800 p-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            <FileDown size={14} />
            {isStayingDownloading ? '생성 중...' : '숙박자 CSV 다운로드'}
          </button>
        </div>

        {/* 리포트 2 */}
        <div className="flex flex-col justify-between gap-4 rounded border border-slate-300 bg-white p-4 shadow-2xs">
          <div>
            <div className="mb-1 flex items-center gap-1.5 font-bold text-slate-800 text-xs">
              <BookmarkCheck size={16} className="text-blue-700" />
              <span>2. 예약자 리스트</span>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              선택한 체크인 일자의 전체 예약 원장과 배정 상태를 출력합니다.
            </p>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">체크인 일자</label>
                <input
                  type="date"
                  value={reserveStartDate}
                  onChange={(e) => setReserveStartDate(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">상태 필터</label>
                <select
                  value={reserveStatus}
                  onChange={(e) => setReserveStatus(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
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
            className="flex w-full items-center justify-center gap-1 rounded bg-slate-800 p-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            <FileDown size={14} />
            {isReserveDownloading ? '생성 중...' : '예약자 CSV 다운로드'}
          </button>
        </div>

        {/* 리포트 3 */}
        <div className="flex flex-col justify-between gap-4 rounded border border-slate-300 bg-white p-4 shadow-2xs">
          <div>
            <div className="mb-1 flex items-center gap-1.5 font-bold text-slate-800 text-xs">
              <Tag size={16} className="text-purple-700" />
              <span>3. 태그 & 요청사항 리스트</span>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              고객 원문 요청, AI 파싱 태그, 배정 객실의 보유 태그를 대조합니다.
            </p>

            <label className="mb-1 block text-[11px] font-semibold text-slate-600">도착 기준 일자</label>
            <input
              type="date"
              value={tagTargetDate}
              onChange={(e) => setTagTargetDate(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadSpecialRequests}
            disabled={isTagDownloading}
            className="flex w-full items-center justify-center gap-1 rounded bg-slate-800 p-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            <FileDown size={14} />
            {isTagDownloading ? '생성 중...' : '태그 & 요청사항 CSV 다운로드'}
          </button>
        </div>

        {/* 리포트 4 */}
        <div className="flex flex-col justify-between gap-4 rounded border border-slate-300 bg-white p-4 shadow-2xs">
          <div>
            <div className="mb-1 flex items-center gap-1.5 font-bold text-slate-800 text-xs">
              <Layers size={16} className="text-amber-700" />
              <span>4. 룸 태그 인벤토리</span>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              191실 전 객실의 보유 태그 목록과 태그별 배치 객실 목록을 다운로드합니다.
            </p>

            <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-2 text-[11px] text-slate-600">
              건축 물리 특성 및 관리자 커스텀 태그 전체 반영
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadRoomTags}
              disabled={isRoomTagsDownloading}
              className="flex flex-1 items-center justify-center gap-1 rounded bg-slate-800 p-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Building size={13} />
              {isRoomTagsDownloading ? '생성 중...' : '방별 태그 CSV'}
            </button>

            <button
              type="button"
              onClick={handleDownloadTagMatrix}
              disabled={isTagMatrixDownloading}
              className="flex flex-1 items-center justify-center gap-1 rounded border border-slate-300 bg-white p-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <Tag size={13} />
              {isTagMatrixDownloading ? '생성 중...' : '태그별 방 CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}