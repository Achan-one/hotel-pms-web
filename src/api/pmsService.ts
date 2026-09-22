import apiClient from './client';
import type { ApiResponse, FloorMapResponseDto, LoginResponse } from '../types/pms';

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
    login: async (staffId: string, password: string): Promise<LoginResponse> => {
        const res = await apiClient.post<ApiResponse<LoginResponse>>('/api/auth/login', {
            staffId,
            password,
        });
        return res.data.data;
    },

    getRoomIndicator: async (targetDate?: string): Promise<FloorMapResponseDto> => {
        const params = targetDate ? { targetDate } : {};
        const res = await apiClient.get<ApiResponse<FloorMapResponseDto>>('/api/rooms/indicator', { params });
        return res.data.data;
    },

    getReservations: async (params: ReservationSearchParams): Promise<ReservationDetailDto[]> => {
        const res = await apiClient.get<ApiResponse<ReservationDetailDto[]>>('/api/reservations', { params });
        return res.data.data;
    },

    getReservationDetail: async (reservationId: string): Promise<ReservationDetailDto> => {
        const res = await apiClient.get<ApiResponse<ReservationDetailDto>>(`/api/reservations/${reservationId}`);
        return res.data.data;
    },

    manualAssign: async (reservationId: string, targetRoomNumber: string) => {
        const res = await apiClient.post<ApiResponse<void>>(`/api/reservations/${reservationId}/manual-assign`, {
            targetRoomNumber,
        });
        return res.data;
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

    seedSampleReservations: async () => {
        const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/seed-samples');
        return res.data;
    },

    simulateLincoln: async () => {
        const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/lincoln-mock');
        return res.data;
    },

    bulkSimulate50And30: async () => {
        const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/bulk-simulate-50-and-30');
        return res.data;
    },

    clearReservations: async () => {
        const res = await apiClient.post<ApiResponse<unknown>>('/api/simulation/clear');
        return res.data;
    },
};