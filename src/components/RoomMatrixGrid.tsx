import type { ReactNode } from 'react';
import type { RoomMatrixItemDto } from '../types/pms';

interface Props {
  floorRooms: Record<string, RoomMatrixItemDto[]>;
  // 객실 칸 하나를 어떻게 그릴지는 쓰는 화면이 정한다(예약 현황, 태그 보기 등).
  renderRoom: (room: RoomMatrixItemDto) => ReactNode;
}

const ROOMS_PER_FLOOR = 16;

/**
 * 191실 룸 매트릭스의 뼈대. 층 행, 호수 헤더, 13호 결번과 14~15층 설비실 표시를 그린다.
 * 예약 현황 화면과 태그 사전의 객실 매트릭스가 같은 도면을 쓰도록 공통으로 뺐다.
 */
export default function RoomMatrixGrid({ floorRooms, renderRoom }: Props) {
  return (
    <>
      {/* 가로 축 호수 헤더 */}
      <div className="mb-1 flex items-center gap-1 border-b border-slate-300/80 pb-1">
        <div className="w-10 min-w-[40px] text-center text-[10px] font-bold uppercase text-slate-500">층 / 호</div>
        <div className="grid flex-1 grid-cols-16 gap-1">
          {Array.from({ length: ROOMS_PER_FLOOR }, (_, i) => i + 1).map((r) => (
            <div
              key={r}
              className={`text-center font-mono text-[10px] font-bold ${r === 13 ? 'text-slate-400' : 'text-slate-600'}`}
            >
              {r < 10 ? `0${r}` : `${r}`}
            </div>
          ))}
        </div>
      </div>

      {/* 층별 행 */}
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1">
        {Object.entries(floorRooms)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([floorStr, rooms]) => {
            const floor = Number(floorStr);
            const prefix = floor < 10 ? `0${floor}` : `${floor}`;
            const roomMap = new Map(rooms.map((r) => [r.roomNumber, r]));

            return (
              <div key={floor} className="flex min-h-0 flex-1 items-stretch gap-1">
                <div className="flex w-10 min-w-[40px] select-none items-center justify-center rounded border border-slate-300 bg-slate-100 font-mono text-xs font-extrabold text-slate-700 shadow-2xs">
                  {floor}F
                </div>

                <div className="grid flex-1 grid-cols-16 gap-1">
                  {Array.from({ length: ROOMS_PER_FLOOR }, (_, rIdx) => rIdx + 1).map((r) => {
                    const padRoom = r < 10 ? `0${r}` : `${r}`;
                    const roomNo = `${prefix}${padRoom}`;

                    if (r === 13) {
                      return (
                        <div
                          key={r}
                          title="13호 서양권 금기 결번"
                          className="flex h-full select-none items-center justify-center rounded border border-dashed border-slate-300 bg-slate-100/60 font-mono text-[10px] text-slate-400"
                        >
                          결번
                        </div>
                      );
                    }

                    if (floor >= 14 && (r === 3 || r === 7)) {
                      return (
                        <div
                          key={r}
                          title="공조/설비실 결번"
                          className="flex h-full select-none items-center justify-center rounded border border-slate-300 bg-slate-200/80 font-mono text-[9px] font-semibold text-slate-500"
                        >
                          설비
                        </div>
                      );
                    }

                    const room = roomMap.get(roomNo);
                    if (!room) return <div key={roomNo} className="h-full min-w-0" />;

                    return <div key={room.roomNumber} className="contents">{renderRoom(room)}</div>;
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
