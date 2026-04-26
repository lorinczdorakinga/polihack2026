import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (url) => {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null); 

  // Üzenetküldő függvény (React -> Python)
  const sendMessage = (msg) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    } else {
      console.warn("WebSocket nincs nyitva, nem lehetett elküldeni:", msg);
    }
  };

  useEffect(() => {
    let reconnectTimeout;

    const connect = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log("WebSocket csatlakozva!");
        setIsConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          setData(parsedData);
        } catch (error) {
          console.error("Hiba a JSON feldolgozásakor:", error);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        console.log("WebSocket kapcsolat megszakadt. Újracsatlakozás 3mp múlva...");
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket hiba:", error);
        ws.current.close();
      };
    };

    connect();

    // Takarítás, ha a komponens megszűnik
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]);

  // Visszaadjuk a data és isConnected mellett a sendMessage-et is!
  return { data, isConnected, sendMessage };
};