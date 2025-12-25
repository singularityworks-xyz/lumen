// biome-ignore lint/performance/noBarrelFile: it's okay for index files to re-export
export {
  type CollaboratorInfo,
  roomManager,
  type WsConnection,
} from "./room-manager";
export { collabRoutes } from "./routes";
