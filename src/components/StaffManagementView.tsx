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

      setResultMsg({ text: res.message || `[${name}] 신규 직원이 등록되었습니다.` });
      setLastCreated({ staffId: staffId.trim(), name: name.trim(), role });

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
    <div className="flex max-w-[800px] flex-col gap-4 font-sans text-slate-800">
      <div className="rounded border border-slate-300 bg-white p-5 shadow-2xs">
        <h2 className="mb-1 text-base font-bold text-slate-900">직원 계정 발급 및 인사 권한 관리</h2>
        <p className="text-xs text-slate-500">
          총지배인(ROLE_ADMIN) 권한으로 신규 입사 직원의 사번과 초기 비밀번호를 생성하고 역할을 부여합니다.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Award size={14} className="text-blue-700" /> 관리자 (ROLE_ADMIN)
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            배정, 룸 체인지, 태그 사전 관리 및 직원 계정 발급 권한
          </p>
        </div>

        <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Shield size={14} className="text-emerald-700" /> 정직원 (ROLE_STAFF)
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            일괄 배정, 수동 객실 지정, 룸 체인지 및 입퇴실 처리
          </p>
        </div>

        <div className="rounded border border-slate-300 bg-white p-3.5 shadow-2xs">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <User size={14} className="text-amber-700" /> 아르바이트 (ROLE_PART_TIME)
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            191실 매트릭스 열람, 현장 체크인 및 퇴실 정산만 허용
          </p>
        </div>
      </div>

      {resultMsg && (
        <div className={`flex items-center gap-2 rounded border p-3 text-xs font-semibold ${
          resultMsg.isError ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'
        }`}>
          {resultMsg.isError ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{resultMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded border border-slate-300 bg-white p-5 shadow-2xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <KeyRound size={13} className="text-slate-500" /> 사번 (로그인 ID)
            </label>
            <input
              type="text"
              placeholder="예: staff_2026_01"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <User size={13} className="text-slate-500" /> 성명
            </label>
            <input
              type="text"
              placeholder="예: 홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Lock size={13} className="text-slate-500" /> 초기 비밀번호
            </label>
            <input
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Shield size={13} className="text-slate-500" /> 역할 및 권한
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="ROLE_STAFF">정직원 (ROLE_STAFF)</option>
              <option value="ROLE_PART_TIME">아르바이트 (ROLE_PART_TIME)</option>
              <option value="ROLE_ADMIN">관리자 (ROLE_ADMIN)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 flex items-center justify-center gap-1.5 rounded bg-blue-600 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          <UserPlus size={14} />
          {loading ? '계정 생성 중...' : '신규 직원 계정 발급'}
        </button>
      </form>

      {lastCreated && (
        <div className="flex items-center justify-between rounded border border-slate-300 bg-white p-3 text-xs shadow-2xs">
          <div>
            <span className="font-bold text-slate-900">{lastCreated.name} ({lastCreated.staffId})</span>
            <span className="ml-2 font-mono text-slate-500">[{lastCreated.role}]</span>
          </div>
          <span className="text-slate-400">발급 완료</span>
        </div>
      )}
    </div>
  );
}