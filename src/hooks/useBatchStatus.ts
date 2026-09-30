import { useEffect, useRef, useState } from 'react';
import { pmsService } from '../api/pmsService';
import type { BatchStatus } from '../types/pms';

const IDLE: BatchStatus = { active: false };
const POLL_INTERVAL_MS = 3000;

/**
 * 서버의 일괄 배정, 해제 진행 여부를 주기적으로 확인한다.
 * 진행 중인 동안 다른 직원의 화면은 예약을 조회만 할 수 있어야 하므로, 화면들이 이 값을 보고 읽기 전용으로 전환한다.
 * 진행이 끝나는 순간에는 onFinished를 불러 화면이 최신 배정 결과를 다시 읽게 한다.
 */
export function useBatchStatus(enabled: boolean, onFinished?: () => void): BatchStatus {
  const [status, setStatus] = useState<BatchStatus>(IDLE);
  const wasActive = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!enabled) {
      setStatus(IDLE);
      wasActive.current = false;
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const next = await pmsService.getBatchStatus();
        if (cancelled) return;
        setStatus(next);
        if (wasActive.current && !next.active) {
          onFinishedRef.current?.();
        }
        wasActive.current = next.active;
      } catch {
        // 일시적인 조회 실패는 무시하고 다음 주기에 다시 확인한다. 서버가 막아 주므로 화면 전환이 늦어도 안전하다.
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled]);

  return status;
}
