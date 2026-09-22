import apiClient from './client';
import type { ApiResponse, FloorMapResponseDto, LoginResponse } from '../types/pms';

export interface ReservationDetailDto {
    reservationId: string;
    guestName: string;
    roomType: string;
    roomTypeName: string;
    checkInDate: string;
    stayNights: number;
    assignedRoomNumber: string | null;
    status: string;
    specialRequests: string;
}

export const pmsService = {
    // 1. 직원 로그인
    login: async (staffId: string, password: string): Promise<LoginResponse> => {
        const res = await apiClient.post<ApiResponse<LoginResponse>>('/api/auth/login', {
            staffId,
            password,
        });
        return res.data.data;
    },

    // 2. 191실 룸 인디케이터 매트릭스 조회
    getRoomIndicator: async (targetDate?: string): Promise<FloorMapResponseDto> => {
        const params = targetDate ? { targetDate } : {};
        const res = await apiClient.get<ApiResponse<FloorMapResponseDto>>('/api/rooms/indicator', { params });
        return res.data.data;
    },

    // 3. 예약 다조건 검색
    getReservations: async (params: { targetDate?: string; guestName?: string; status?: string }): Promise<ReservationDetailDto[]> => {
        const res = await apiClient.get<ApiResponse<ReservationDetailDto[]>>('/api/reservations', { params });
        return res.data.data;
    },

    // 4. 단건 예약 상세
    getReservationDetail: async (reservationId: string): Promise<ReservationDetailDto> => {
        const res = await apiClient.get<ApiResponse<ReservationDetailDto>>(`/api/reservations/${reservationId}`);
        return res.data.data;
    },

    // 5. 룸 체인지 실행
    changeRoom: async (reservationId: string, newRoomNumber: string, reason: string) => {
        const res = await apiClient.post<ApiResponse<unknown>>(`/api/reservations/${reservationId}/room-change`, {
            newRoomNumber,
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
};