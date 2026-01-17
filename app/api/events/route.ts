import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { eventManager, EventData } from '@/app/lib/events';

/**
 * Server-Sent Events (SSE) endpoint
 * 
 * Clients connect to this endpoint to receive real-time updates
 * without polling. The connection stays open and sends events as they occur.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = parseInt(session.user.id);

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      const connectMessage = `data: ${JSON.stringify({ 
        type: 'connected', 
        userId,
        timestamp: new Date().toISOString() 
      })}\n\n`;
      controller.enqueue(encoder.encode(connectMessage));

      // Subscribe to events for this user
      const unsubscribe = eventManager.subscribe(userId, (event: EventData) => {
        const message = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error('Error sending SSE event:', error);
        }
      });

      // Send periodic heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (error) {
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds

      // Cleanup on connection close
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch (error) {
          // Connection already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
