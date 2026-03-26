const WebSocket = require("ws");

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });

console.log("Hub Chat Server running on port " + port);

const OWNER_NAME = "AccphuBaeMinh";

// rooms[roomId] = [ws, ws, ...]
let rooms = {};

// hwidMap[roomId][username] = "hwid_string"
let hwidMap = {};

// =============================
// BROADCAST ONLINE COUNT
// =============================
function broadcastOnline(room) {
    if (!rooms[room]) return;
    const activeClients = rooms[room].filter(c => c.readyState === WebSocket.OPEN);
    const count = activeClients.length;
    activeClients.forEach(client => {
        client.send(JSON.stringify({ type: "online_count", count }));
    });
    console.log(`[Room ${room}] Online: ${count}`);
}

// =============================
// CONNECTION
// =============================
wss.on("connection", function(ws) {
    let currentRoom = null;
    let currentUser = null;

    ws.on("message", function(data) {
        try {
            const msg = JSON.parse(data);

            // ---- JOIN ----
            if (msg.type === "join") {
                currentRoom = msg.room;
                currentUser = msg.user || "Unknown";

                if (!rooms[currentRoom]) rooms[currentRoom] = [];
                if (!hwidMap[currentRoom]) hwidMap[currentRoom] = {};

                rooms[currentRoom].push(ws);

                // Lưu HWID nếu có
                if (msg.hwid) {
                    hwidMap[currentRoom][currentUser] = msg.hwid;
                    console.log(`[HWID] ${currentUser} → ${msg.hwid}`);
                }

                broadcastOnline(currentRoom);
            }

            // ---- CHAT ----
            if (msg.type === "chat" && currentRoom) {
                const payload = JSON.stringify({
                    type: "chat",
                    user: msg.user,
                    text: msg.text
                });
                rooms[currentRoom].forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(payload);
                    }
                });
            }

            // ---- HWID REQUEST (chỉ AccphuBaeMinh) ----
            if (msg.type === "hwid_request" && currentRoom) {
                // Kiểm tra requester có phải owner không
                if (msg.requester !== OWNER_NAME) {
                    ws.send(JSON.stringify({ type: "hwid_denied" }));
                    console.log(`[HWID] Denied request from ${msg.requester}`);
                    return;
                }

                const target = msg.target;
                const hwid = hwidMap[currentRoom]?.[target] || null;

                ws.send(JSON.stringify({
                    type: "hwid_response",
                    target: target,
                    hwid: hwid || "NOT FOUND (user chưa join hoặc executor không hỗ trợ)"
                }));

                console.log(`[HWID] ${OWNER_NAME} requested HWID of ${target} → ${hwid || "NOT FOUND"}`);
            }

        } catch (err) {
            console.log("Invalid message:", err.message);
        }
    });

    ws.on("close", function() {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom] = rooms[currentRoom].filter(c => c !== ws);

            // Xoá HWID khi user rời
            if (currentUser && hwidMap[currentRoom]) {
                delete hwidMap[currentRoom][currentUser];
            }

            broadcastOnline(currentRoom);

            // Dọn room trống
            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
                delete hwidMap[currentRoom];
            }
        }
    });
});
