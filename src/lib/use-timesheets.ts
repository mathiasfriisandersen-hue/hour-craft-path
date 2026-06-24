import { useEffect, useState } from "react";
import { listAll, type Timesheet, seedIfEmpty } from "./timesheet-store";

export function useTimesheets(): Timesheet[] {
  const [list, setList] = useState<Timesheet[]>([]);
  useEffect(() => {
    seedIfEmpty();
    setList(listAll());
    const h = () => setList(listAll());
    window.addEventListener("timesheets-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("timesheets-changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return list;
}
