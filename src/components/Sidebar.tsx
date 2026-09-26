import type { LoginResponse } from '../types/pms';
import {
  LayoutGrid,
  CalendarCheck,
  Sparkles,
  Tags,
  Users,
  FileSpreadsheet,
  Terminal,
  LogOut,
  Building2,
  Landmark,
} from 'lucide-react';

export type TabType =
  | 'INDICATOR'
  | 'RESERVATIONS'
  | 'BATCH_ASSIGN'
  | 'TAGS'
  | 'STAFF_MGMT'
  | 'CITY_LEDGER'
  | 'EXPORT'
  | 'SIMULATION';

interface Props {
  currentUser: LoginResponse;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onLogout: () => void;
}

export default function Sidebar({ currentUser, activeTab, onSelectTab, onLogout }: Props) {
  const isAdmin = currentUser.role === 'ROLE_ADMIN';

  return (
    <aside className="flex h-full w-full flex-col justify-between border-r border-slate-300 bg-[#0f172a] text-slate-300 select-none">
      <div>
        {/* 상단 호텔 브랜드 헤더 */}
        <div className="flex h-11 items-center gap-2.5 border-b border-slate-800 px-4">
          <Building2 size={18} className="text-blue-500" />
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-tight text-white">GRAND PMS</span>
            <span className="text-[9px] font-semibold text-slate-400">FRONT DESK SYSTEM</span>
          </div>
        </div>

        {/* 메인 메뉴 목록 */}
        <nav className="flex flex-col gap-0.5 p-2 text-xs font-medium">
          <button
            onClick={() => onSelectTab('INDICATOR')}
            className={`flex w-full items-center gap-2.5 rounded px-3 py-2 transition ${
              activeTab === 'INDICATOR'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <LayoutGrid size={15} />
            <span>191실 룸 매트릭스</span>
          </button>

          <button
            onClick={() => onSelectTab('RESERVATIONS')}
            className={`flex w-full items-center gap-2.5 rounded px-3 py-2 transition ${
              activeTab === 'RESERVATIONS'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <CalendarCheck size={15} />
            <span>예약 검색 & 원장 관리</span>
          </button>

          <button
            onClick={() => onSelectTab('BATCH_ASSIGN')}
            className={`flex w-full items-center gap-2.5 rounded px-3 py-2 transition ${
              activeTab === 'BATCH_ASSIGN'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Sparkles size={15} />
            <span>일괄 자동 배정</span>
          </button>

          <button
            onClick={() => onSelectTab('TAGS')}
            className={`flex w-full items-center gap-2.5 rounded px-3 py-2 transition ${
              activeTab === 'TAGS'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Tags size={15} />
            <span>태그 사전 관리</span>
          </button>

          {/* 🚀 [신규] OTA 정산 원장 (City Ledger) 탭 */}
          <button
            onClick={() => onSelectTab('CITY_LEDGER')}
            className={`flex w-full items-center gap-2.5 rounded px-3 py-2 transition ${
              activeTab === 'CITY_LEDGER'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Landmark size={15} />
            <span>OTA 정산 원장 (City Ledger)</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => onSelectTab('STAFF_MGMT')}
              className={`flex w-full items-center gap-2.5 rounded px-3 py-2 transition ${
                activeTab === 'STAFF_MGMT'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Users size={15} />
              <span>직원 계정 발급</span>
            </button>
          )}

          <button
            onClick={() => onSelectTab('EXPORT')}
            className={`flex w-full items-center gap-2.5 rounded px-3 py-2 transition ${
              activeTab === 'EXPORT'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>데이터 엑스포트 (CSV)</span>
          </button>

          <button
            onClick={() => onSelectTab('SIMULATION')}
            className={`flex w-full items-center gap-2.5 rounded px-3 py-2 transition ${
              activeTab === 'SIMULATION'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <Terminal size={15} />
            <span>Dev Mode</span>
          </button>
        </nav>
      </div>

      {/* 하단 사용자 정보 및 로그아웃 */}
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-white">{currentUser.staffName}</span>
            <span className="block text-[10px] text-slate-400">{currentUser.roleDescription}</span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-700 bg-slate-800/60 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
        >
          <LogOut size={13} />
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}