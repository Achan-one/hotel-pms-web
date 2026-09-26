import apiClient from './client';
import type { ApiResponse, FloorMapResponseDto, LoginResponse, StaffRole } from '../types/pms';

export interface TagPreferenceDto {
  preferredTags: string[];
  avoidTags: string[];
}

export interface ReservationDetailDto {
  reservationId: string;
  originalGuestName?: string;
  bookedRoomType?: string;
  contractCheckInDate?: string;
  contractStayNights?: number;
  rawRequestText?: string;
  rawXmlPayload?: string;

  operationalGuestName?: string;
  operationalCheckInDate?: string;
  operationalStayNights?: number;
  internalStaffMemo?: string;
  assignedRoomNumber: string | null;
  previousRoomNumber?: string | null;

  tagPreference?: TagPreferenceDto;
  preference?: {
    floorPref?: string;
    elevatorPref?: string;
    cornerPref?: string;
    preferQuiet?: boolean;
  };

  guestName: string;
  roomType: string;
  checkInDate: string;
  stayNights: number;
  status: string;
  specialRequests?: string;
  channelInfo?: {
    channelType: string;
    channelReservationNo: string;
    planName: string;
  };
}

export type ReservationDto = ReservationDetailDto;

export interface ReservationSearchParams {
  guestName?: string;
  reservationId?: string;
  checkInDate?: string;
  stayingDate?: string;
  status?: string;
  tag?: string;
  otaChannel?: string;
}

export interface CreateStaffRequest {
  staffId: string;
  password: string;
  name: string;
  role: StaffRole;
}

export interface NightAuditResultDto {
  previousBusinessDate: string;
  newBusinessDate: string;
  noShowCount: number;
  noShowReservationIds: string[];
  roomChargePostedCount: number;
  totalRoomRevenuePosted: number;
  success: boolean;
  message: string;
}

function triggerFileDownload(blobData: BlobPart, fileName: string) {
  const blob = new Blob([blobData], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export const pmsService = {
  // 인증
  login: async (staffId: string, password: string): Promise<LoginResponse> => {
    const res = await apiClient.post<ApiResponse<LoginResponse>>('/api/auth/login', {
      staffId,
      password,
    });
    return res.data.data;
  },

  // 관리자 전용 직원 계정 발급 (ROLE_ADMIN 전용)
  createStaff: async (data: CreateStaffRequest) => {
    const res = await apiClient.post<ApiResponse<void>>('/api/admin/staff', data);
    return res.data;
  },

  // 룸 인디케이터
  getRoomIndicator: async (targetDate?: string): Promise<FloorMapResponseDto> => {
    const params = targetDate ? { targetDate } : {};
    const res = await apiClient.get<ApiResponse<FloorMapResponseDto>>('/api/rooms/indicator', { params });
    return res.data.data;
  },
  fetchRoomIndicator: async (targetDate?: string): Promise<FloorMapResponseDto> => {
    return pmsService.getRoomIndicator(targetDate);
  },

  // 예약 조회
  getReservations: async (params?: ReservationSearchParams): Promise<ReservationDetailDto[]> => {
    const res = await apiClient.get<ApiResponse<ReservationDetailDto[]>>('/api/reservations', { params });
    return res.data.data;
  },
  searchReservations: async (condition?: Record<string, any>): Promise<ReservationDetailDto[]> => {
    return pmsService.getReservations(condition);
  },

  getReservationDetail: async (reservationId: string): Promise<ReservationDetailDto> => {
    const res = await apiClient.get<ApiResponse<ReservationDetailDto>>(`/api/reservations/${reservationId}`);
    return res.data.data;
  },

  // 수동 배정 및 제어
  manualAssign: async (reservationId: string, targetRoomNumber: string) => {
    const res = await apiClient.post<ApiResponse<void>>(`/api/reservations/${reservationId}/manual-assign`, {
      targetRoomNumber,
    });
    return res.data;
  },
  manualAssignRoom: async (reservationId: string, targetRoomNumber: string) => {
    return pmsService.manualAssign(reservationId, targetRoomNumber);
  },

  unassignRoom: async (reservationId: string) => {
    const res = await apiClient.delete<ApiResponse<void>>(`/api/reservations/${reservationId}/assign`);
    return res.data;
  },

  updateOperationalOverride: async (reservationId: string, data: {
    operationalGuestName?: string;
    operationalCheckInDate?: string;
    operationalStayNights?: number;
    internalStaffMemo?: string;
  }) => {
    const res = await apiClient.patch<ApiResponse<void>>(`/api/reservations/${reservationId}/operational-override`, data);
    return res.data;
  },

  changeRoom: async (reservationId: string, targetRoomNumber: string, reason: string, moveDate?: string) => {
    const res = await apiClient.post<ApiResponse<unknown>>(`/api/reservations/${reservationId}/room-change`, {
      targetRoomNumber,
      moveDate,
      reason,
    });
    return res.data;
  },

  runBatchAssign: async (checkInDate: string) => {
    const res = await apiClient.post<ApiResponse<unknown>>('/api/reservations/batch-assign', {
      checkInDate,
    });
    return res.data;
  },

  checkIn: async (reservationId: string) => {
    const res = await apiClient.post<ApiResponse<void>>(`/api/reservations/${reservationId}/check-in`);
    return res.data;
  },

  checkOut: async (reservationId: string, checkOutDate?: string) => {
    const params = checkOutDate ? { checkOutDate } : {};
    const res = await apiClient.post<ApiResponse<void>>(`/api/reservations/${reservationId}/check-out`, null, { params });
    return res.data;
  },

  // 나이트 오딧 (야간 일일 마감)
  runNightAudit: async (targetDate: string): Promise<ApiResponse<NightAuditResultDto>> => {
    const res = await apiClient.post<ApiResponse<NightAuditResultDto>>('/api/reservations/night-audit', null, {
      params: { targetDate },
    });
    return res.data;
  },

  // 🎲 기준일자 기반 50명 동적 시드 생성
  generateDynamicTestData: async (baseDate: string): Promise<ApiResponse<string>> => {
    const res = await apiClient.post<ApiResponse<string>>('/api/reservations/generate-test-data', null, {
      params: { baseDate },
    });
    return res.data;
  },

  // 🚀 [보정] 영업일자를 쿼리 파라미터로 함께 전송하여 날짜 불일치 방어
  seedSampleReservations: async (targetDate?: string) => {
    const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/seed-samples', null, {
      params: targetDate ? { targetDate } : {},
    });
    return res.data;
  },
  seedSampleData: async (targetDate?: string) => {
    return pmsService.seedSampleReservations(targetDate);
  },

  simulateLincoln: async (targetDate?: string) => {
    const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/lincoln-mock', null, {
      params: targetDate ? { targetDate } : {},
    });
    return res.data;
  },
  simulateLincolnXml: async (targetDate?: string) => {
    return pmsService.simulateLincoln(targetDate);
  },

  bulkSimulate50And30: async (customNotes?: string[], targetDate?: string) => {
    const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/bulk-simulate-50-and-30', {
      customNotes: customNotes || [],
    }, {
      params: targetDate ? { targetDate } : {},
    });
    return res.data;
  },

  clearReservations: async () => {
    const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/clear');
    return res.data;
  },
  clearAllSimulationData: async () => {
    return pmsService.clearReservations();
  },
  updateOperationalTags: async (reservationId: string, data: { preferredTags: string[]; avoidTags: string[] }) => {
    const res = await apiClient.patch<ApiResponse<void>>(`/api/reservations/${reservationId}/operational-tags`, data);
    return res.data;
  },

  downloadInHouseCsv: async (targetDate: string) => {
    const res = await apiClient.get('/api/reports/in-house/csv', {
      params: { targetDate },
      responseType: 'blob',
    });
    triggerFileDownload(res.data, `숙박자리스트_${targetDate}.csv`);
  },

  downloadReservationsCsv: async (startDate: string, status?: string) => {
    const res = await apiClient.get('/api/reports/reservations/csv', {
      params: { startDate, status: status || undefined },
      responseType: 'blob',
    });
    triggerFileDownload(res.data, `예약자리스트_${startDate}.csv`);
  },

  downloadSpecialRequestsCsv: async (targetDate: string) => {
    const res = await apiClient.get('/api/reports/special-requests/csv', {
      params: { targetDate },
      responseType: 'blob',
    });
    triggerFileDownload(res.data, `태그_요청사항리스트_${targetDate}.csv`);
  },

  downloadRoomTagsCsv: async () => {
    const res = await apiClient.get('/api/reports/room-tags/csv', {
      responseType: 'blob',
    });
    triggerFileDownload(res.data, '191실_객실별_보유태그인벤토리.csv');
  },

  downloadTagMatrixCsv: async () => {
    const res = await apiClient.get('/api/reports/tag-matrix/csv', {
      responseType: 'blob',
    });
    triggerFileDownload(res.data, '태그별_보유객실매핑_매트릭스.csv');
  },

  // 서버 DB의 공식 영업일자 조회
  getSystemBusinessDate: async (): Promise<string> => {
    const res = await apiClient.get<ApiResponse<{ businessDate: string }>>('/api/system/business-date');
    return res.data.data.businessDate;
  },

  // 서버 DB 공식 영업일자 수동 보정
  setSystemBusinessDate: async (businessDate: string): Promise<string> => {
    const res = await apiClient.put<ApiResponse<{ businessDate: string }>>('/api/system/business-date', { businessDate });
    return res.data.data.businessDate;
  },

  // 🔒 편집 락 (Lock) API
  acquireLock: async (
    reservationId: string,
    staffId: string,
    staffName: string
  ): Promise<{ isLockedByOther: boolean; lockedByStaffName: string }> => {
    const res = await apiClient.post<ApiResponse<{ isLockedByOther: boolean; lockedByStaffName: string }>>(
      `/api/reservations/${reservationId}/lock`,
      { staffId, staffName }
    );
    return res.data.data;
  },

  releaseLock: async (reservationId: string, staffId: string) => {
    try {
      await apiClient.delete(`/api/reservations/${reservationId}/lock`, {
        params: { staffId },
      });
    } catch {
      // unmount 시 에러 무시
    }
  },

  checkLock: async (reservationId: string): Promise<{ isLockedByOther: boolean; lockedByStaffName: string }> => {
    const res = await apiClient.get<ApiResponse<{ isLockedByOther: boolean; lockedByStaffName: string }>>(
      `/api/reservations/${reservationId}/lock`
    );
    return res.data.data;
  },
  // 모든 설정 및 데이터 완벽 초기화 (Full Reset)
  resetAllSettings: async (): Promise<{ success: boolean; businessDate: string; message: string }> => {
    const res = await apiClient.post<ApiResponse<{ success: boolean; businessDate: string; message: string }>>(
      '/api/simulation/reset-all-settings'
    );
    return res.data.data;
  },
};

export default pmsService;