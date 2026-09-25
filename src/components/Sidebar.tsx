import type { LoginResponse } from '../types/pms';
import {
  Hotel, Grid, Search, CheckSquare, LogOut, UserCheck, Beaker, Tag, FileDown, UserPlus
} from 'lucide-react';

export type TabType = 'INDICATOR' | 'RESERVATIONS' | 'BATCH_ASSIGN' | 'TAGS' | 'STAFF_MGMT' | 'EXPORT' | 'SIMULATION';

interface SidebarProps {
  currentUser: LoginResponse;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onLogout: () => void;
}

export default function Sidebar({ currentUser, activeTab, onSelectTab, onLogout }: SidebarProps) {
  const menuItems: { id: TabType; label: string; icon: typeof Grid; adminOnly?: boolean }[] = [
    { id: 'INDICATOR', label: '191실 룸 매트릭스', icon: Grid },
    { id: 'RESERVATIONS', label: '예약 검색 & 원장 관리', icon: Search },
    { id: 'BATCH_ASSIGN', label: '일괄 자동 배정', icon: CheckSquare },
    { id: 'TAGS', label: '태그 사전 관리', icon: Tag },
    { id: 'STAFF_MGMT', label: '직원 계정 발급', icon: UserPlus, adminOnly: true },
    { id: 'EXPORT', label: '데이터 엑스포트 (CSV)', icon: FileDown },
    { id: 'SIMULATION', label: '채널 매니저 연동 랩', icon: Beaker },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-[230px] flex-col justify-between border-r border-slate-300 bg-[#1e293b] p-3.5 font-sans text-white">
      <div>
        <div className="mb-4 flex items-center gap-2.5 border-b border-slate-700/80 px-2 pb-3.5">
          <Hotel className="h-5 w-5 text-sky-400" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">GRAND PMS</h1>
            <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">FRONT DESK SYSTEM</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {menuItems
            .filter(item => !item.adminOnly || currentUser.role === 'ROLE_ADMIN')
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-xs font-semibold transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
                  {item.label}
                </button>
              );
            })}
        </nav>
      </div>

      <div className="rounded border border-slate-700 bg-slate-800/80 p-3">
        <div className="mb-0.5 flex items-center gap-1.5">
          <UserCheck size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-100">{currentUser.staffName}</span>
        </div>
        <div className="mb-2 text-[10px] text-slate-400">
          {currentUser.roleDescription}
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-600 bg-slate-700/80 py-1.5 text-[11px] font-medium text-slate-200 transition hover:bg-slate-600 hover:text-white"
        >
          <LogOut size={13} /> 로그아웃
        </button>
      </div>
    </aside>
  );
}