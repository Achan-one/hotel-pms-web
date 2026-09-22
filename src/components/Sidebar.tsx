import type { LoginResponse } from '../types/pms';
import {
    Hotel, Grid, Search, ArrowRightLeft, Sparkles, LogOut, UserCheck
} from 'lucide-react';

export type TabType = 'INDICATOR' | 'RESERVATIONS' | 'ROOM_MOVE' | 'BATCH_ASSIGN';

interface SidebarProps {
    currentUser: LoginResponse;
    activeTab: TabType;
    onSelectTab: (tab: TabType) => void;
    onLogout: () => void;
}

export default function Sidebar({ currentUser, activeTab, onSelectTab, onLogout }: SidebarProps) {
    const menuItems: { id: TabType; label: string; icon: typeof Grid }[] = [
        { id: 'INDICATOR', label: '191실 룸 인디케이터', icon: Grid },
        { id: 'RESERVATIONS', label: '예약 조회 & 체크인', icon: Search },
        { id: 'ROOM_MOVE', label: '룸 체인지 센터', icon: ArrowRightLeft },
        { id: 'BATCH_ASSIGN', label: 'AI 당일 일괄 배정', icon: Sparkles },
    ];

    return (
        <aside style={{
            width: '260px',
            backgroundColor: '#0f172a',
            borderRight: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.5rem 1rem',
            height: '100vh',
            position: 'sticky',
            top: 0,
            boxSizing: 'border-box'
        }}>
            {/* 상단 로고 & 메뉴 */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 0.5rem 1.5rem', borderBottom: '1px solid #1e293b', marginBottom: '1.5rem' }}>
                    <Hotel size={28} color="#38bdf8" />
                    <div>
                        <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '0.5px' }}>GRAND PMS</h1>
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
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '0.8rem 1rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: isActive ? '#0284c7' : 'transparent',
                                    color: isActive ? '#ffffff' : '#94a3b8',
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Icon size={18} color={isActive ? '#ffffff' : '#94a3b8'} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* 하단 로그인 근무자 프로필 및 로그아웃 */}
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        backgroundColor: '#334155',
                        color: '#f8fafc',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                    }}
                >
                    <LogOut size={14} /> 로그아웃
                </button>
            </div>
        </aside>
    );
}