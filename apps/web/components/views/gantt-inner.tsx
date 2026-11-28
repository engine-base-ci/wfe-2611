"use client";
// svar-gantt（@svar-ui/react-gantt v2・MIT・D-079）の実体。ブラウザ専用なので SSR に載せない（timeline.tsx が next/dynamic で読む）
import { Gantt, Willow, type IApi, type ILink, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";

export interface GanttInnerProps {
  tasks: ITask[];
  links: ILink[];
  onSelect: (id: string | null) => void;
}
export default function GanttInner({ tasks, links, onSelect }: GanttInnerProps) {
  const scales = [
    { unit: "month", step: 1, format: "yyyy年M月" },
    { unit: "week", step: 1, format: "w週" },
  ];
  return (
    <Willow>
      <Gantt
        tasks={tasks}
        links={links}
        scales={scales}
        init={(api: IApi) => {
          api.on("select-task", (e: { id?: string | number }) => onSelect(e.id ? String(e.id) : null));
        }}
      />
    </Willow>
  );
}
