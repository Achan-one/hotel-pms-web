import { useState } from 'react';
import type { FormEvent } from 'react';
import { pmsService } from '../api/pmsService';
import type { StaffRole } from '../types/pms';
import { UserPlus, Shield, CheckCircle2, AlertCircle, KeyRound, User, Lock, Award } from 'lucide-react';

export default function StaffManagementView() {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('ROLE_STAFF');

  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [lastCreated, setLastCreated] = useState<{ staffId: string; name: string; role: StaffRole } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffId.trim() || !password.trim() || !name.trim()) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    setLoading(true);
    setResultMsg(null);

    try {
      const res = await pmsService.createStaff({
        staffId: staffId.trim(),
        password: password.trim(),
        name: name.trim(),
        role,
      });

      setResultMsg({ text: res.message || `[${name}] 신규 직원이 성공적으로 등록되었습니다.` });
      setLastCreated({ staffId: staffId.trim(), name: name.trim(), role });

      // 폼 초기화
      setStaffId('');
      setPassword('');
      setName('');
      setRole('ROLE_STAFF');
    } catch (err: unknown) {
      let errMsg = '직원 등록 중 오류가 발생했습니다.';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        errMsg = axiosErr.response?.data?.message || errMsg;
      }
      setResultMsg({ text: errMsg, isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#f8fafc' }}>
      
      {/* 1. 상단 안내 배너 */}
      <div style={{ backgroundColor: '#131d36', padding: '1.8rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.4rem' }}>
          <UserPlus size={26} color="#38bdf8" />
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>호텔 직원 계정 발급 및 인사 권한 관리</h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
          총지배인(ROLE_ADMIN) 권한으로 신규 입사 직원의 사번과 초기 비밀번호를 생성하고, 시스템 접근 역할을 부여합니다.
        </p>
      </div>

      {/* 2. 직무별 시스템 권한 안내 카드 (3열) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div style={{ backgroundColor: '#131d36', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
            <Award size={16} /> 호텔 관리자 (ROLE_ADMIN)
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
            모든 전산 제어(배정, 룸 체인지), 태그 사전 편집 및 <b>신규 직원 계정 발급</b> 권한 보유
          </p>
        </div>

        <div style={{ backgroundColor: '#131d36', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
            <Shield size={16} /> 정규사원 (ROLE_STAFF)
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
            일괄 자동 배정, 수동 객실 지정, 룸 체인지, 예약 원장 수정 및 체크인/아웃 수행
          </p>
        </div>

        <div style={{ backgroundColor: '#131d36', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
            <User size={16} /> 아르바이트 (ROLE_PART_TIME)
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
            191실 룸 인디케이터 열람, 현장 체크인 및 퇴실(체크아웃) 정산 제어만 허용
          </p>
        </div>
      </div>

      {/* 3. 처리 결과 알림 */}
      {resultMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          backgroundColor: resultMsg.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          color: resultMsg.isError ? '#fca5a5' : '#6ee7b7',
          border: `1px solid ${resultMsg.isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          padding: '0.85rem 1.2rem', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 600
        }}>
          {resultMsg.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{resultMsg.text}</span>
        </div>
      )}

      {/* 4. 신규 발급 입력 폼 */}
      <form onSubmit={handleSubmit} style={{
        backgroundColor: '#131d36', padding: '2rem', borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '1.2rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
              <KeyRound size={14} color="#38bdf8" /> 사번 / 로그인 ID
            </label>
            <input
              type="text"
              placeholder="예: staff_2026_01"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
              <User size={14} color="#38bdf8" /> 직원 성명 (실명)
            </label>
            <input
              type="text"
              placeholder="예: 김민수"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
              <Lock size={14} color="#38bdf8" /> 초기 임시 비밀번호
            </label>
            <input
              type="password"
              placeholder="초기 접속용 비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
              <Shield size={14} color="#38bdf8" /> 부여할 권한 및 역할
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              style={{ width: '100%', padding: '0.68rem 0.9rem', borderRadius: '6px', border: '1px solid #293548', backgroundColor: '#0b1329', color: '#fff', fontSize: '0.85rem' }}
            >
              <option value="ROLE_STAFF">정규사원 (ROLE_STAFF) - 일반 배정 및 운영</option>
              <option value="ROLE_PART_TIME">아르바이트 (ROLE_PART_TIME) - 단순 체크인/아웃</option>
              <option value="ROLE_ADMIN">호텔 관리자 (ROLE_ADMIN) - 전산 총괄</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '0.5rem', padding: '0.85rem', borderRadius: '6px',
            backgroundColor: loading ? '#0369a1' : '#0284c7', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <UserPlus size={18} />
          {loading ? '신규 계정 발급 중...' : '신규 직원 계정 발급 (DB 영구 저장)'}
        </button>
      </form>

      {/* 5. 직전 발급 내역 카드 */}
      {lastCreated && (
        <div style={{ backgroundColor: '#0b1329', padding: '1.2rem 1.5rem', borderRadius: '8px', border: '1px solid #293548', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, marginBottom: '2px' }}>방금 발급된 계정 정보</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {lastCreated.name} ({lastCreated.staffId}) - <span style={{ color: '#34d399' }}>{lastCreated.role}</span>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            해당 직원에게 사번과 초기 비밀번호를 안내해주세요.
          </span>
        </div>
      )}
    </div>
  );
}