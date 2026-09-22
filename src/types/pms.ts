export type StaffRole = 'ROLE_ADMIN' | 'ROLE_STAFF' | 'ROLE_PART_TIME' | 'ROLE_GUEST';

export type RoomStatus =
    | 'VACANT'
    | 'OCCUPIED'
    | 'ASSIGNED'
    | 'BLOCKED'
    | 'OUT'
    | 'CLEANING'
    | 'BREAK';

export type RoomType =
    | 'MODERATE_DOUBLE'
    | 'SUPERIOR_TWIN'
    | 'SUPERIOR_DOUBLE'
    | 'RESIDENTIAL_DOUBLE'
    | 'EXECUTIVE_DOUBLE';

export type ReservationStatus =
    | 'PENDING'
    | 'ASSIGNED'
    | 'DUE_IN'
    | 'CHECKED_IN'
    | 'CHECKED_OUT'
    | 'CANCELLED';

export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

export interface LoginResponse {
    token: string;
    tokenType: string;
    staffId: string;
    staffName: string;
    role: StaffRole;
    roleDescription: string;
}

export interface RoomMatrixItemDto {
    roomNumber: string;
    floor: number;
    roomType: RoomType;
    roomTypeName: string;
    nearElevator: boolean;
    cornerRoom: boolean;
    status: RoomStatus;
    reservationId: string | null;
    guestName: string | null;
    stayPeriodStr: string | null;
}

export interface FloorMapResponseDto {
    targetDate: string;
    totalRooms: number;
    occupiedRooms: number;
    vacantRooms: number;
    occupancyRatePercent: number;
    floorRooms: Record<string, RoomMatrixItemDto[]>;
}