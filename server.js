const WebSocket = require("ws");

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });

console.log("Hub Chat Server running on port " + port);

let rooms = {};

// =============================
// FUNCTION: BROADCAST ONLINE COUNT
// =============================
function broadcastOnline(room) {
    if (!rooms[room]) return;

    const count = rooms[room].length;

    rooms[room].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: "online_count",
                count: count
            }));
        }
    });
}

wss.on("connection", function connection(ws) {

    let currentRoom = null;

    ws.on("message", function incoming(data) {

        try {
            const msg = JSON.parse(data);

            // =============================
            // JOIN ROOM
            // =============================
            if (msg.type === "join") {
                currentRoom = msg.room;

                if (!rooms[currentRoom]) {
                    rooms[currentRoom] = [];
                }

                rooms[currentRoom].push(ws);

                // Gửi số online ngay khi join
                broadcastOnline(currentRoom);
            }

            // =============================
            // CHAT
            // =============================
            if (msg.type === "chat" && currentRoom) {
                rooms[currentRoom].forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: "chat",
                            user: msg.user,
                            text: msg.text
                        }));
                    }
                });
            }

        } catch (err) {
            console.log("Invalid message");
        }

    });

    ws.on("close", function() {
        if (currentRoom && rooms[currentRoom]) {

            rooms[currentRoom] =
                rooms[currentRoom].filter(client => client !== ws);

            // Cập nhật lại online khi có người rời
            broadcastOnline(currentRoom);

            // Nếu room trống thì xoá luôn cho sạch RAM
            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
            }
        }
    });

});
