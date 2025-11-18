const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// 클리닉별 카메라 스트림 저장
const cameraStreams = new Map() // { clinicId: { tabletSocketId, frame, timestamp } }

// 클리닉별 태블릿 소켓 매핑
const tabletSockets = new Map() // { clinicId: socketId }

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id)

    // 태블릿: clinicId 등록
    socket.on('tablet:register', (data) => {
      const { clinicId } = data
      console.log(`📱 Tablet ${socket.id} registered for clinic:`, clinicId)
      tabletSockets.set(clinicId, socket.id)
      socket.join(`tablet:${clinicId}`)
    })

    // 태블릿: 카메라 스트림 시작
    socket.on('tablet:start-stream', (data) => {
      const { clinicId } = data
      console.log(`📹 Tablet ${socket.id} starting stream for clinic:`, clinicId)

      cameraStreams.set(clinicId, {
        tabletSocketId: socket.id,
        frame: null,
        timestamp: Date.now()
      })

      socket.join(`tablet:${clinicId}`)
      socket.emit('tablet:stream-started', { clinicId })
    })

    // 태블릿: 카메라 프레임 전송
    socket.on('tablet:frame', (data) => {
      const { clinicId, frame } = data

      const streamData = cameraStreams.get(clinicId)
      if (streamData && streamData.tabletSocketId === socket.id) {
        streamData.frame = frame
        streamData.timestamp = Date.now()

        // 해당 클리닉을 보고 있는 관리자들에게 프레임 전송
        io.to(`admin:${clinicId}`).emit('admin:frame', { clinicId, frame })
      }
    })

    // 태블릿: 스트림 중지
    socket.on('tablet:stop-stream', (data) => {
      const { clinicId } = data
      console.log(`🛑 Tablet ${socket.id} stopping stream for clinic:`, clinicId)

      const streamData = cameraStreams.get(clinicId)
      if (streamData && streamData.tabletSocketId === socket.id) {
        cameraStreams.delete(clinicId)
        io.to(`admin:${clinicId}`).emit('admin:stream-stopped', { clinicId })
      }

      socket.leave(`tablet:${clinicId}`)
    })

    // 관리자: 특정 클리닉 스트림 시청 시작
    socket.on('admin:watch-stream', (data) => {
      const { clinicId } = data
      console.log(`👁️  Admin ${socket.id} watching stream for clinic:`, clinicId)

      socket.join(`admin:${clinicId}`)

      // 태블릿에 카메라 켜기 요청 전송
      const tabletSocketId = tabletSockets.get(clinicId)
      if (tabletSocketId) {
        console.log(`📹 Requesting camera start from tablet ${tabletSocketId}`)
        io.to(tabletSocketId).emit('tablet:start-camera-request')
      } else {
        console.log(`⚠️  No tablet found for clinic: ${clinicId}`)
        socket.emit('admin:stream-inactive', { clinicId })
      }

      // 현재 스트림이 있는지 확인
      const streamData = cameraStreams.get(clinicId)
      if (streamData && streamData.frame) {
        socket.emit('admin:frame', {
          clinicId,
          frame: streamData.frame
        })
        socket.emit('admin:stream-active', { clinicId })
      }
    })

    // 관리자: 스트림 시청 중지
    socket.on('admin:stop-watching', (data) => {
      const { clinicId } = data
      console.log(`👁️  Admin ${socket.id} stopped watching stream for clinic:`, clinicId)
      socket.leave(`admin:${clinicId}`)

      // 태블릿에 카메라 끄기 요청 전송
      const tabletSocketId = tabletSockets.get(clinicId)
      if (tabletSocketId) {
        console.log(`🛑 Requesting camera stop from tablet ${tabletSocketId}`)
        io.to(tabletSocketId).emit('tablet:stop-camera-request')
      }
    })

    // 연결 해제
    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id)

      // 태블릿이 연결 해제되면 해당 스트림 정리
      for (const [clinicId, streamData] of cameraStreams.entries()) {
        if (streamData.tabletSocketId === socket.id) {
          cameraStreams.delete(clinicId)
          io.to(`admin:${clinicId}`).emit('admin:stream-stopped', { clinicId })
        }
      }

      // tabletSockets에서도 제거
      for (const [clinicId, socketId] of tabletSockets.entries()) {
        if (socketId === socket.id) {
          tabletSockets.delete(clinicId)
          console.log(`📱 Tablet unregistered for clinic: ${clinicId}`)
        }
      }
    })
  })

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Socket.io server is running`)
    })
})
