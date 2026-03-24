import { create } from "zustand";

interface CommentUIState {
  clearOpenCluster: () => void;
  focusCommentId: string | null;
  openCluster: (clusterId: string, focusCommentId?: string) => void;
  openClusterId: string | null;
}

export const useCommentUIStore = create<CommentUIState>((set) => ({
  openClusterId: null,
  focusCommentId: null,
  openCluster: (clusterId, focusCommentId) =>
    set({ openClusterId: clusterId, focusCommentId: focusCommentId ?? null }),
  clearOpenCluster: () => set({ openClusterId: null, focusCommentId: null }),
}));
