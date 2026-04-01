const WebSocket = require("ws");

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });

console.log("Hub Chat Server running on port " + port);

// Danh sách những người có quyền đặc biệt
const ADMINS = {
    "owners": ["AccphuBaeMinh"], // Thêm tên Minh và bạn vào đây
    "staffs": ["Staff_Name_1", "Staff_Name_2"] // Sau này có staff thì thêm vào đây
};

// =============================
// BAD WORDS FILTER
// =============================
const BAD_WORDS = [
    // English
    "nigger","nigga","niga","n1gger","n1gga",
    "fuck","fck","fuuck","fvck",
    "shit","sh1t","sht",
    "bitch","b1tch","bytch",
    "dick","d1ck","dik",
    "pussy","cunt","whore","wh0re",
    "faggot","fag","f4g",
    "retard","ret4rd","bastard",
    "cock","c0ck","slut",
    "ass","a55",
    // Vietnamese
    "địt","dit","đit",
    "lồn","lon","l0n",
    "cặc","cac","c4c",
    "buồi","buoi",
    "đụ","du",
    "đéo","deo",
    "mẹ mày","me may",
    "bố mày","bo may",
    "con mẹ","con me",
    "đồ chó","thằng chó",
    "óc chó",
];

function filterBadWords(text) {
    let result = text;
    for (const word of BAD_WORDS) {
        // Escape regex special chars
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "gi");
        result = result.replace(regex, "*".repeat(word.length));
    }
    return result;
}

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
                let displayUser = msg.user;

                // Kiểm tra nếu là Owner
                if (ADMINS.owners.includes(msg.user)) {
                    // Tag OWNER màu Xanh dương sáng (Blue) và Trắng
                    displayUser = `${msg.user} <font color="rgb(0, 255, 255)">[</font><font color="rgb(255, 255, 255)">OWNER</font><font color="rgb(0, 255, 255)">]</font>`;
                } 
                // Kiểm tra nếu là Staff
                else if (ADMINS.staffs.includes(msg.user)) {
                    // Tag STAFF màu Vàng (đúng gu bạn thích)
                    displayUser = `${msg.user} <font color="rgb(255, 255, 0)">[STAFF]</font>`;
                }

                const payload = JSON.stringify({
                    type: "chat",
                    user: displayUser,
                    text: filterBadWords(msg.text || "")
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
