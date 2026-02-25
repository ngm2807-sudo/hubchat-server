const WebSocket = require("ws");

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });

console.log("Hub Chat Server running on port 3000");

let rooms = {};

wss.on("connection", function connection(ws) {

    let currentRoom = null;

    ws.on("message", function incoming(data) {

        try {
            const msg = JSON.parse(data);

            if (msg.type === "join") {
                currentRoom = msg.room;

                if (!rooms[currentRoom]) {
                    rooms[currentRoom] = [];
                }

                rooms[currentRoom].push(ws);
            }

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
        }
    });


});
