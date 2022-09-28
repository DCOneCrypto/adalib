import { proxy } from "valtio";
import { solanaClusters } from "../defaults/clusters";
import Store from "../store";
import { ClusterSubscribeRequestMethods } from "../types/requests";
import { waitForOpenConnection } from "./websocket";

export const ClusterFactory = (function () {
  let socket: WebSocket | undefined;
  let listeners: Record<
    number,
    { callback: (params: any) => void; method: string; id: number }
  > = proxy({});
  function setSocket() {
    const cluster = new Store().getCluster();
    const endpoint = solanaClusters[cluster].endpoint;
    socket = new WebSocket(endpoint.replace("http", "ws"));

    socket.onmessage = (ev) => {
      const data = JSON.parse(ev.data);

      console.log({ data, listeners });

      // If request is a subscribtion init notification
      // Copy data to new ID (request ID -> Subscribtion ID)
      if (data.id) {
        listeners[data.result] = { ...listeners[data.id] };
        delete listeners[data.id];
      }

      if (data.params?.subscription) {
        console.log("Found subscription", data.params.subscription);
        listeners[data.params.subscription].callback(data.params.result);
      }
    };
  }

  function registerListener<
    Method extends keyof ClusterSubscribeRequestMethods
  >(
    method: Method,
    params: ClusterSubscribeRequestMethods[Method]["params"],
    callback: (params: any) => void
  ) {
    if (!socket) setSocket();
    const id = new Store().getNewRequestId();
    socket!.send(
      JSON.stringify({
        method,
        params,
        jsonrpc: "2.0",
        id,
      })
    );

    listeners[id] = { method, callback, id };
  }

  return {
    registerListener,
    getSocket: async function () {
      if (!socket) {
        setSocket();
      }
      waitForOpenConnection(socket!);
      return socket;
    },
  };
})();
