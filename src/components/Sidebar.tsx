import type { LoginResponse } from '../types/pms';
import {
    Hotel, Grid, Search, Sparkles, LogOut, UserCheck, Beaker, Tag, FileDown
} from 'lucide-react';

export type TabType = 'INDICATOR' | 'RESERVATIONS' | 'BATCH_ASSIGN' | 'TAGS' | 'EXPORT' | 'SIMULATION';

interface SidebarProps {
    currentUser: LoginResponse;
    activeTab: TabType;
    onSelectTab: (tab: TabType) => void;
    onLogout: () => void;
}

export default function Sidebar({ currentUser, activeTab, onSelectTab, onLogout }: SidebarProps) {
    const menuItems: { id: TabType; label: string; icon: typeof Grid }[] = [
        { id: 'INDICATOR', label: '191실 룸 인디케이터', icon: Grid },
        { id: 'RESERVATIONS', label: '예약 검색 & 통합 관리', icon: Search },
        { id: 'BATCH_ASSIGN', label: 'AI 당일 일괄 배정', icon: Sparkles },
        { id: 'TAGS', label: '태그 사전 관리 (Admin)', icon: Tag },
        { id: 'EXPORT', label: '데이터 엑스포트 (CSV)', icon: FileDown },
        { id: 'SIMULATION', label: 'OTA/린칸 테스트 랩', icon: Beaker },
    ];

    return (
        <aside style={{
            width: '260px', backgroundColor: '#0f172a', borderRight: '1px solid #1e293b',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            padding: '1.5rem 1rem', height: '100vh', position: 'sticky', top: 0, boxSizing: 'border-box'
        }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 0.5rem 1.5rem', borderBottom: '1px solid #1e293b', marginBottom: '1.5rem' }}>
                    <Hotel size={28} color="#38bdf8" />
                    <div>
                        <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>GRAND PMS</h1>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>FRONT DESK SYSTEM</span>
                    </div>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onSelectTab(item.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                                    padding: '0.8rem 1rem', borderRadius: '8px', border: 'none',
                                    backgroundColor: isActive ? (item.id === 'SIMULATION' ? '#e11d48' : '#0284c7') : 'transparent',
                                    color: isActive ? '#ffffff' : '#94a3b8', fontWeight: isActive ? 700 : 500,
                                    fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left'
                                }}
                            >
                                <Icon size={18} color={isActive ? '#ffffff' : '#94a3b8'} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                    <UserCheck size={16} color="#38bdf8" />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{currentUser.staffName}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.8rem' }}>
                    권한: {currentUser.roleDescription}
                </div>
                <button
                    onClick={onLogout}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        width: '100%', padding: '0.5rem', borderRadius: '6px', backgroundColor: '#334155',
                        color: '#f8fafc', border: 'none', cursor: 'pointer', fontSize: '0.8rem'
                    }}
                >
                    <LogOut size={14} /> 로그아웃
                </button>
            </div>
        </aside>
    );
}