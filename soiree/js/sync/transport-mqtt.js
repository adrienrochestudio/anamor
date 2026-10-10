// ============================================================
// transport-mqtt.js : relais par brokers MQTT publics (WebSocket)
//
// Connexion simultanee a trois brokers. Chaque message part sur
// tous ceux qui sont connectes ; les doublons sont ecartes plus
// haut (room.js). Un broker en panne ne coupe rien.
// Les messages "retenus" (couloirs) sont gardes en memoire et
// republies a chaque (re)connexion d'un broker.
// mqtt.js est fourni par vendor/mqtt.min.js (window.mqtt).
// ============================================================
export const BROKERS = [
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://broker.emqx.io:8084/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];

// test uniquement : ?broker=ws://localhost:port remplace la liste
function brokerList(){
  const o = new URLSearchParams(location.search).get("broker");
  if (o && /^wss?:\/\/localhost(:\d+)?(\/|$)/.test(o)) return [o];
  return BROKERS;
}

export function createMqttTransport({ base, onMessage, onStatus }){
  const lib = window.mqtt;
  if (!lib) throw new Error("mqtt library missing");
  const retained = new Map();      // topic -> payload (mes messages retenus)
  const clients = [];
  const id = "anamor_" + Math.random().toString(36).slice(2, 10);

  const status = () => onStatus && onStatus(clients.filter(c => c.connected).length);

  brokerList().forEach((url, i) => {
    let c;
    try {
      c = lib.connect(url, {
        clientId: id + "_" + i,
        clean: true,
        keepalive: 30,
        reconnectPeriod: 2500,
        connectTimeout: 8000,
        protocolVersion: 4,
      });
    } catch (e){
      console.warn("broker", url, e);
      return;
    }
    c.on("connect", () => {
      c.subscribe(base + "/#", { qos:0 });
      for (const [t, p] of retained) c.publish(t, p, { qos:0, retain:true });
      status();
    });
    c.on("message", (topic, payload, packet) => {
      if (!topic.startsWith(base + "/")) return;
      onMessage(topic.slice(base.length + 1), payload.toString(), !!(packet && packet.retain));
    });
    c.on("close", status);
    c.on("offline", status);
    c.on("error", e => console.warn("broker", url, e && e.message));
    clients.push(c);
  });

  return {
    publish(suffix, payload, { retain = false } = {}){
      const t = base + "/" + suffix;
      if (retain) retained.set(t, payload);
      for (const c of clients) if (c.connected) c.publish(t, payload, { qos:0, retain });
    },
    connected(){ return clients.filter(c => c.connected).length; },
    close(){ clients.forEach(c => { try { c.end(true); } catch {} }); },
  };
}
