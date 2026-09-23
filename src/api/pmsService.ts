import apiClient from './client';
import type { ApiResponse, FloorMapResponseDto, LoginResponse } from '../types/pms';

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

// 구버전/신버전 타입 호환용 별칭
export type ReservationDto = ReservationDetailDto;

export interface ReservationSearchParams {
  guestName?: string;
  reservationId?: string;
  checkInDate?: string;
  stayingDate?: string;
  status?: string;
  tag?: string;
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

  // 시뮬레이터 연동 메서드
  seedSampleReservations: async () => {
    const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/seed-samples');
    return res.data;
  },
  seedSampleData: async () => {
    return pmsService.seedSampleReservations();
  },

  simulateLincoln: async () => {
    const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/lincoln-mock');
    return res.data;
  },
  simulateLincolnXml: async () => {
    return pmsService.simulateLincoln();
  },

  bulkSimulate50And30: async (customNotes?: string[]) => {
    const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/bulk-simulate-50-and-30', {
      customNotes: customNotes || [],
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
};

export default pmsService;