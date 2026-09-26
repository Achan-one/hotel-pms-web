import { useState, useEffect } from 'react';
import { pmsService } from '../api/pmsService';
import type { CityLedgerRecordDto } from '../api/pmsService';
import { Landmark, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';

export default function CityLedgerView() {
  const [records, setRecords] = useState<CityLedgerRecordDto[]>([]);
  const [channelTotals, setChannelTotals] = useState<Record<string, number>>({});
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');

  const fetchCityLedger = async () => {
    setLoading(true);
    try {
      const data = await pmsService.getCityLedgerSummary();
      setRecords(data.records || []);
      setChannelTotals(data.channelTotals || {});
      setGrandTotal(data.grandTotal || 0);
    } catch (err) {
      console.error('City Ledger 데이터 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCityLedger();
  }, []);

  const filteredRecords = selectedChannel === 'ALL'
    ? records
    : records.filter(r => r.channelType === selectedChannel);

  return (
    <div className="flex w-full flex-col gap-3 font-sans text-slate-800">
      
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between rounded border border-slate-300 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Landmark size={20} className="text-blue-700" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">OTA 정산 원장 (City Ledger / Accounts Receivable)</h2>
              <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                AUTO-SETTLED ON CHECKOUT
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              사전 결제(PREPAID) 투숙객이 체크아웃할 때 자동으로 이전된 OTA별 후불 청구 외상매출금 장부입니다.
            </p>
          </div>
        </div>

        <button
          onClick={fetchCityLedger}
          className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {/* 상단 채널별 매출 집계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded border border-blue-300 bg-blue-50/60 p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-900">전체 OTA 청구 합계 (Grand Total)</span>
          <div className="mt-1 font-mono font-extrabold text-xl text-blue-950">
            ¥{grandTotal.toLocaleString()}
          </div>
          <span className="text-[10px] text-blue-700">총 {records.length}건 누적 청구</span>
        </div>

        {Object.entries(channelTotals).map(([channel, total]) => (
          <div key={channel} className="rounded border border-slate-300 bg-white p-4 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500">{channel}</span>
            <div className="mt-1 font-mono font-bold text-lg text-slate-800">
              ¥{total.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">정산 청구 대기</span>
          </div>
        ))}
      </div>

      {/* 필터 탭 & 상세 명세서 테이블 */}
      <div className="overflow-hidden rounded border border-slate-300 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-700" />
            <h3 className="text-xs font-bold text-slate-900">OTA별 세부 청구 명세서</h3>
          </div>

          {/* 채널 필터 버튼 */}
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setSelectedChannel('ALL')}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                selectedChannel === 'ALL'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              전체 보기
            </button>
            {Object.keys(channelTotals).map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                  selectedChannel === ch
                    ? 'bg-blue-600 text-white font-bold'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-600 font-semibold">
              <th className="px-4 py-2 w-28">정산 일자</th>
              <th className="px-4 py-2 w-32">OTA 채널</th>
              <th className="px-4 py-2 w-36">OTA 예약 번호</th>
              <th className="px-4 py-2 w-32">고객 성명</th>
              <th className="px-4 py-2 w-44">투숙 기간</th>
              <th className="px-4 py-2 text-right w-36">청구 금액 (¥)</th>
              <th className="px-4 py-2 text-center w-24">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  {loading ? '데이터를 불러오는 중입니다...' : '정산 이체된 City Ledger 내역이 없습니다. (체크아웃 시 자동 적재)'}
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-slate-600">{r.settledDate}</td>
                  <td className="px-4 py-2 font-bold text-slate-800">{r.channelType}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-blue-700">{r.channelReservationNo}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">{r.guestName}</td>
                  <td className="px-4 py-2 font-mono text-slate-600">{r.checkInDate} ~ {r.checkOutDate}</td>
                  <td className="px-4 py-2 text-right font-mono font-extrabold text-blue-700">
                    ¥{r.billedAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 size={10} /> 정산 대기
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}