export interface CollabPayloads {
  large: K6Fixture;
  medium: K6Fixture;
  small: K6Fixture;
}

export interface K6Fixture {
  awarenessUpdates: Record<string, string>;
  description: string;
  label: string;
  syncStep1: string;
  syncStep2: Record<string, string>;
  syncUpdates: Record<string, string>;
}

declare const payloads: CollabPayloads;
export default payloads;
