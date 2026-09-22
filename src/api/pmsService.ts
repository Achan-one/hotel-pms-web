import apiClient from './client';
import type { ApiResponse, FloorMapResponseDto, LoginResponse } from '../types/pms';

export interface ReservationDetailDto {
    reservationId: string;
    guestName: string;
    roomType: string;
    bookedRoomType?: string;
    checkInDate: string;
    stayNights: number;
    assignedRoomNumber: string | null;
    status: string;
    rawRequestText?: string;
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
    stayingDate?: string; // 특정 날짜 기준 재실(In-House) 고객 필터링
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

    // 5. 룸 체인지 실행
    changeRoom: async (reservationId: string, targetRoomNumber: string, reason: string, moveDate?: string) => {
        const res = await apiClient.post<ApiResponse<unknown>>(`/api/reservations/${reservationId}/room-change`, {
            targetRoomNumber,
            moveDate,
            reason,
        });
        return res.data;
    },

    // 6. 당일 일괄 배정 실행
    runBatchAssign: async (checkInDate: string) => {
        const res = await apiClient.post<ApiResponse<unknown>>('/api/reservations/batch-assign', {
            checkInDate,
        });
        return res.data;
    },

    // 7. 체크인 실행
    checkIn: async (reservationId: string) => {
        const res = await apiClient.post<ApiResponse<void>>(`/api/reservations/${reservationId}/check-in`);
        return res.data;
    },

    // 8. 체크아웃 실행
    checkOut: async (reservationId: string, checkOutDate?: string) => {
        const params = checkOutDate ? { checkOutDate } : {};
        const res = await apiClient.post<ApiResponse<void>>(`/api/reservations/${reservationId}/check-out`, null, { params });
        return res.data;
    },

    // 9. 시뮬레이터 API
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