import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (url) => {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  // useRef-ben tároljuk a kapcsolatot, hogy ne renderelődjön újra feleslegesen
  const ws = useRef(null); 

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

  return { data, isConnected };
};