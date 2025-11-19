import { useEffect } from "react";
import { mockBoards, mockWorkspaces } from "../data/mock-data";
import { useKanbanStore } from "../store/kanban-store";

/**
 * Hook to initialize the kanban store with mock data
 * In production, this would fetch data from tRPC
 */
export function useKanbanInit() {
  const initializeWithMockData = useKanbanStore(
    (state) => state.initializeWithMockData
  );

  useEffect(() => {
    // Initialize with mock data
    initializeWithMockData(mockWorkspaces, mockBoards);
  }, [initializeWithMockData]);
}
