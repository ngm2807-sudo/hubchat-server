const WebSocket = require("ws");

const port = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port });

console.log("Hub Chat Server running on port " + port);

// =============================
// ROLE CONFIG
// =============================
const ADMINS = {
    owners: ["AccphuBaeMinh"],
    staffs: ["Staff_Name_1", "Staff_Name_2"],
};

function getRole(username) {
    if (ADMINS.owners.includes(username)) return "owner";
    if (ADMINS.staffs.includes(username)) return "staff";
    return null;
}

function canRequestHWID(username) {
    return ADMINS.owners.includes(username) || ADMINS.staffs.includes(username);
}

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
    "dịt","dit","đit",
    "lồn","l0n",
    "cặc","cac","c4c",
    "buồi","buoi",
    "đụ",
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
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "gi");
        result = result.replace(regex, "*".repeat(word.length));
    }
    return result;
}

// =============================
// STATE
// =============================
// rooms[roomId]  = [ws, ...]
// hwidMap[roomId][username] = "hwid"
let rooms   = {};
let hwidMap = {};

// =============================
// BROADCAST ONLINE COUNT
// =============================
function broadcastOnline(room) {
    if (!rooms[room]) return;
    const active = rooms[room].filter(c => c.readyState === WebSocket.OPEN);
    const count  = active.length;
    const payload = JSON.stringify({ type: "online_count", count });
    active.forEach(c => c.send(payload));
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

                if (!rooms[currentRoom])   rooms[currentRoom]   = [];
                if (!hwidMap[currentRoom]) hwidMap[currentRoom] = {};

                rooms[currentRoom].push(ws);

                if (msg.hwid) {
                    hwidMap[currentRoom][currentUser] = msg.hwid;
                    console.log(`[HWID saved] ${currentUser} → ${msg.hwid}`);
                }

                broadcastOnline(currentRoom);
            }

            // ---- CHAT ----
            if (msg.type === "chat" && currentRoom) {
                const role    = getRole(msg.user);   // "owner" | "staff" | null
                const filtered = filterBadWords(msg.text || "");

                const payload = JSON.stringify({
                    type: "chat",
                    user: msg.user,      // tên sạch — client tự render tag
                    role: role,          // client dùng để hiện [OWNER]/[STAFF] + màu
                    text: filtered,
                });

                rooms[currentRoom].forEach(c => {
                    if (c.readyState === WebSocket.OPEN) c.send(payload);
                });
            }

            // ---- HWID REQUEST (owner & staff) ----
            if (msg.type === "hwid_request" && currentRoom) {
                if (!canRequestHWID(msg.requester)) {
                    ws.send(JSON.stringify({ type: "hwid_denied" }));
                    console.log(`[HWID] DENIED for ${msg.requester}`);
                    return;
                }

                const target = msg.target;
                const hwid   = hwidMap[currentRoom]?.[target] || null;

                ws.send(JSON.stringify({
                    type:   "hwid_response",
                    target: target,
                    hwid:   hwid || "NOT FOUND (user chưa join hoặc executor không hỗ trợ)",
                }));

                console.log(`[HWID] ${msg.requester} → ${target}: ${hwid || "NOT FOUND"}`);
            }

        } catch (err) {
            console.log("Invalid message:", err.message);
        }
    });

    ws.on("close", function() {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom] = rooms[currentRoom].filter(c => c !== ws);

            if (currentUser && hwidMap[currentRoom]) {
                delete hwidMap[currentRoom][currentUser];
            }

            broadcastOnline(currentRoom);

            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
                delete hwidMap[currentRoom];
            }
        }
    });
});
