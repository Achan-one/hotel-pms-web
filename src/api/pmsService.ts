import apiClient from './client';
import type { ApiResponse, FloorMapResponseDto, LoginResponse } from '../types/pms';

export interface ReservationDetailDto {
    reservationId: string;
    // 1. [불변] OTA 원천 계약 정보
    originalGuestName?: string;
    bookedRoomType?: string;
    contractCheckInDate?: string;
    contractStayNights?: number;
    rawRequestText?: string;
    rawXmlPayload?: string;

    // 2. [가변] PMS 현장 운영 오버라이드
    operationalGuestName?: string;
    operationalCheckInDate?: string;
    operationalStayNights?: number;
    internalStaffMemo?: string;
    assignedRoomNumber: string | null;
    previousRoomNumber?: string | null;

    // 3. UI 및 공통 호환 필드
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

export interface ReservationSearchParams {
    guestName?: string;
    reservationId?: string;
    checkInDate?: string;
    stayingDate?: string;
    status?: string;
}

export const pmsService = {
    // 1. 로그인
    login: async (staffId: string, password: string): Promise<LoginResponse> => {
        const res = await apiClient.post<ApiResponse<LoginResponse>>('/api/auth/login', {
            staffId,
            password,
        });
        return res.data.data;
    },

    // 2. 191실 룸 인디케이터 매트릭스
    getRoomIndicator: async (targetDate?: string): Promise<FloorMapResponseDto> => {
        const params = targetDate ? { targetDate } : {};
        const res = await apiClient.get<ApiResponse<FloorMapResponseDto>>('/api/rooms/indicator', { params });
        return res.data.data;
    },

    // 3. 다조건 예약 검색
    getReservations: async (params: ReservationSearchParams): Promise<ReservationDetailDto[]> => {
        const res = await apiClient.get<ApiResponse<ReservationDetailDto[]>>('/api/reservations', { params });
        return res.data.data;
    },

    // 4. 단건 상세 조회
    getReservationDetail: async (reservationId: string): Promise<ReservationDetailDto> => {
        const res = await apiClient.get<ApiResponse<ReservationDetailDto>>(`/api/reservations/${reservationId}`);
        return res.data.data;
    },

    // 5. 입실 전 수동 호실 배정/재배정
    manualAssign: async (reservationId: string, targetRoomNumber: string) => {
        const res = await apiClient.post<ApiResponse<void>>(`/api/reservations/${reservationId}/manual-assign`, {
            targetRoomNumber,
        });
        return res.data;
    },

    // 6. 현장 운영 오버라이드 갱신 (계약 원본 보존)
    updateOperationalOverride: async (reservationId: string, data: {
        operationalGuestName?: string;
        operationalCheckInDate?: string;
        operationalStayNights?: number;
        internalStaffMemo?: string;
    }) => {
        const res = await apiClient.patch<ApiResponse<void>>(`/api/reservations/${reservationId}/operational-override`, data);
        return res.data;
    },

    // 7. 룸 체인지 실행
    changeRoom: async (reservationId: string, targetRoomNumber: string, reason: string, moveDate?: string) => {
        const res = await apiClient.post<ApiResponse<unknown>>(`/api/reservations/${reservationId}/room-change`, {
            targetRoomNumber,
            moveDate,
            reason,
        });
        return res.data;
    },

    // 8. 당일 일괄 배정
    runBatchAssign: async (checkInDate: string) => {
        const res = await apiClient.post<ApiResponse<unknown>>('/api/reservations/batch-assign', {
            checkInDate,
        });
        return res.data;
    },

    // 9. 체크인 실행
    checkIn: async (reservationId: string) => {
        const res = await apiClient.post<ApiResponse<void>>(`/api/reservations/${reservationId}/check-in`);
        return res.data;
    },

    // 10. 체크아웃 실행
    checkOut: async (reservationId: string, checkOutDate?: string) => {
        const params = checkOutDate ? { checkOutDate } : {};
        const res = await apiClient.post<ApiResponse<void>>(`/api/reservations/${reservationId}/check-out`, null, { params });
        return res.data;
    },

    // 11. 시뮬레이터 API
    seedSampleReservations: async () => {
        const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/seed-samples');
        return res.data;
    },

    simulateLincoln: async () => {
        const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/lincoln-mock');
        return res.data;
    },

    clearReservations: async () => {
        const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/clear');
        return res.data;
    },
};