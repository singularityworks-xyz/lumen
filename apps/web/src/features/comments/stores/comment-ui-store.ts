import { create } from "zustand";

type CommentUIState = {
  openClusterId: string | null;
  focusCommentId: string | null;
  openCluster: (clusterId: string, focusCommentId?: string) => void;
  clearOpenCluster: () => void;
};

export const useCommentUIStore = create<CommentUIState>((set) => ({
  openClusterId: null,
  focusCommentId: null,
  openCluster: (clusterId, focusCommentId) =>
    set({ openClusterId: clusterId, focusCommentId: focusCommentId ?? null }),
  clearOpenCluster: () => set({ openClusterId: null, focusCommentId: null }),
}));
