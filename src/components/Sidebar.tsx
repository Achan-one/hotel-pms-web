import type { LoginResponse } from '../types/pms';
import {
  Hotel, Grid, Search, Sparkles, LogOut, UserCheck, Beaker, Tag, FileDown, UserPlus
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
    { id: 'INDICATOR', label: '191실 룸 인디케이터', icon: Grid },
    { id: 'RESERVATIONS', label: '예약 검색 & 통합 관리', icon: Search },
    { id: 'BATCH_ASSIGN', label: 'AI 당일 일괄 배정', icon: Sparkles },
    { id: 'TAGS', label: '태그 사전 관리 (Admin)', icon: Tag },
    { id: 'STAFF_MGMT', label: '직원 계정 발급 (Admin)', icon: UserPlus, adminOnly: true },
    { id: 'EXPORT', label: '데이터 엑스포트 (CSV)', icon: FileDown },
    { id: 'SIMULATION', label: 'OTA/린칸 테스트 랩', icon: Beaker },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] flex-col justify-between border-r border-slate-800 bg-slate-900 p-6">
      <div>
        <div className="mb-6 flex items-center gap-2.5 border-b border-slate-800 px-2 pb-6">
          <Hotel className="h-7 w-7 text-sky-400" />
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white">GRAND PMS</h1>
            <span className="text-[11px] font-semibold text-slate-500">FRONT DESK SYSTEM</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5">
          {menuItems
            .filter(item => !item.adminOnly || currentUser.role === 'ROLE_ADMIN')
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isSim = item.id === 'SIMULATION';
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
                    isActive
                      ? isSim
                        ? 'bg-rose-600 text-white'
                        : 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                  {item.label}
                </button>
              );
            })}
        </nav>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="mb-1 flex items-center gap-2">
          <UserCheck size={16} className="text-sky-400" />
          <span className="text-sm font-semibold text-slate-100">{currentUser.staffName}</span>
        </div>
        <div className="mb-3 text-xs text-slate-400">
          권한: {currentUser.roleDescription}
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-700 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-600"
        >
          <LogOut size={14} /> 로그아웃
        </button>
      </div>
    </aside>
  );
}