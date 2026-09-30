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
    tags?: string[];
}

export interface FloorMapResponseDto {
    targetDate: string;
    totalRooms: number;
    occupiedRooms: number;
    vacantRooms: number;
    occupancyRatePercent: number;
    floorRooms: Record<string, RoomMatrixItemDto[]>;
}

// 룸 매트릭스에 나오는 태그 코드를 사람이 읽는 이름으로 바꾸기 위한 목록. 모든 직원이 볼 수 있다.
export interface TagCatalogItem {
    code: string;
    name: string;
    description: string;
    category: string;
    strictness: string;
}

// 일괄 배정, 해제가 서버에서 진행 중인지. 진행 중이면 예약은 조회만 할 수 있다.
export interface BatchStatus {
    active: boolean;
    operation?: 'BATCH_ASSIGN' | 'BATCH_UNASSIGN';
    label?: string;
    staffId?: string;
    targetDate?: string;
    startedAt?: string;
}

export interface BatchUnassignResult {
    checkInDate: string;
    releasedReservationIds: string[];
    keptInHouseCount: number;
}
