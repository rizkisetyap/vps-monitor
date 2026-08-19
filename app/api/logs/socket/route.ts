import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { Server } from 'socket.io';

export async function GET(req: NextRequest) {
  if (!(global as any).io) {
    (global as any).io = new Server((global as any).httpServer, {
      path: '/api/logs/socket',
      addTrailingSlash: false,
    });
  }

  const io = (global as any).io;
  
  io.on('connection', (socket: any) => {
    const logProcess = spawn('pm2', ['logs', 'vps-monitor', '--lines', '100', '--nostream']);
    
    logProcess.stdout.on('data', (data) => {
      socket.emit('log', data.toString());
    });

    socket.on('disconnect', () => {
      logProcess.kill();
    });
  });

  return NextResponse.json({ message: 'Socket initialized' });
}