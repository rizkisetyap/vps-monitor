"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import io from "socket.io-client";

export default function LogViewer() {
  const termRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal>();

  useEffect(() => {
    term.current = new Terminal({ rows: 20 });
    (term.current as any).options.readOnly = true;
    const fitAddon = new FitAddon();
    term.current.loadAddon(fitAddon);
    term.current.open(termRef.current!);
    fitAddon.fit();

    const socket = io({ path: "/api/logs/socket" });
    socket.on("log", (data) => {
      term.current?.write(data);
    });

    return () => {
      socket.disconnect();
      term.current?.dispose();
    };
  }, []);

  return <div ref={termRef} className="h-full w-full" />;
}