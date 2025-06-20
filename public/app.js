
const pc     = new RTCPeerConnection({ iceServers:[{urls:'stun:stun.l.google.com:19302'}] });
const socket = io();

const log = msg => (document.getElementById('status').textContent = msg);
const roomInput = document.getElementById('room');

document.getElementById('join').onclick = async () => {
  const room = roomInput.value.trim();
  if (!room) return alert('Enter room id');
  socket.emit('join', room);
  log(`joined room “${room}”, waiting…`);
};

socket.on('ready', startNegotiation);
socket.on('signal', async data => {
  if (data.sdp) {
    await pc.setRemoteDescription(data);
    if (data.type === 'offer') {
      await pc.setLocalDescription(await pc.createAnswer());
      socket.emit('signal', { room: roomInput.value, data: pc.localDescription });
    }
  } else if (data.candidate) {
    pc.addIceCandidate(data);
  }
});

pc.onicecandidate = e => e.candidate &&
  socket.emit('signal', { room: roomInput.value, data: e.candidate });

pc.onconnectionstatechange = () => log(`WebRTC: ${pc.connectionState}`);

async function startNegotiation() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
  document.body.append(Object.assign(new Audio(), {srcObject:stream, muted:true, autoplay:true}));

  await pc.setLocalDescription(await pc.createOffer());
  socket.emit('signal', { room: roomInput.value, data: pc.localDescription });
}

pc.ontrack = ({streams:[remote]}) => {
  document.body.append(Object.assign(new Audio(), {srcObject:remote, autoplay:true}));
};
