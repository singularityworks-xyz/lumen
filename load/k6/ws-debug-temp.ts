import { sleep } from "k6";
import { WebSocket } from "k6/websockets";

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const ws = new WebSocket(
    "ws://127.0.0.1:3202/ws/collab/ws-load-shared",
    null,
    {
      headers: {
        "x-e2e-bypass": "true",
        "x-e2e-user-id": "e2e-load-user",
      },
    }
  );

  console.log(
    `initial readyState=${String((ws as { readyState?: unknown }).readyState)}`
  );

  ws.onopen = () => {
    console.log(
      `onopen readyState=${String((ws as { readyState?: unknown }).readyState)}`
    );
    ws.send("hello");
  };

  ws.addEventListener("open", () => {
    console.log("addEventListener open fired");
  });

  ws.onmessage = (event) => {
    console.log(`onmessage type=${typeof event.data}`);
  };

  ws.onerror = () => {
    console.log("onerror fired");
  };

  ws.onclose = () => {
    console.log(
      `onclose readyState=${String((ws as { readyState?: unknown }).readyState)}`
    );
  };

  for (let i = 0; i < 20; i++) {
    console.log(
      `loop ${i} readyState=${String((ws as { readyState?: unknown }).readyState)}`
    );
    sleep(0.25);
  }

  ws.close();
  sleep(0.5);
}
