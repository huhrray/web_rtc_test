let express = require("express");
let https = require("https");
let app = express();
const fs = require('fs');
let cors = require("cors");
app.use(cors());
app.get("/", (req,res)=>{
    res.send({ express: 'YOUR EXPRESS BACKEND IS CONNECTED TO REACT' })
})
const options = {
    key: fs.readFileSync('./private.pem'),
    cert: fs.readFileSync('./public.pem'),
    rejectUnauthorized: false,
    requestCert: true,
    agent: false
};
let server = https.createServer(options, app);
let socketio = require("socket.io");
let io = socketio(server, {
    cors: {
        origin :"*",
        credentials :true   
    }
});

const PORT = process.env.PORT || 5000;

let users = {};

let socketToRoom = {};

const maximum = 2;

io.on("connection", (socket) => {
    socket.on("join_room", (data) => {
        if (users[data.room]) {
            const length = users[data.room].length;
            if (length === maximum) {
                socket.to(socket.id).emit("room_full");
                return;
            }
            users[data.room].push({ id: socket.id });
        } else {
            users[data.room] = [{ id: socket.id }];
        }
        socketToRoom[socket.id] = data.room;

        socket.join(data.room);
        console.log(`FROM SERVER::::[${socketToRoom[socket.id]}]: ${socket.id} enter`);

        const usersInThisRoom = users[data.room].filter(
            (user) => user.id !== socket.id
        );

        console.log("FROM SERVER::::",usersInThisRoom);

        io.sockets.to(socket.id).emit("all_users", usersInThisRoom);
    });

    socket.on("offer", (sdp) => {
        console.log("FROM SERVER::::"+"offer: " + socket.id);
        socket.broadcast.emit("getOffer", sdp);
    });

    socket.on("answer", (sdp) => {
        console.log("FROM SERVER::::"+"answer: " + socket.id);
        socket.broadcast.emit("getAnswer", sdp);
    });

    socket.on("candidate", (candidate) => {
        console.log("FROM SERVER::::"+"candidate: " + socket.id);
        socket.broadcast.emit("getCandidate", candidate);
    });

    socket.on("disconnect", () => {
        console.log(`[${socketToRoom[socket.id]}]: ${socket.id} exit`);
        const roomID = socketToRoom[socket.id];
        let room = users[roomID];
        if (room) {
            room = room.filter((user) => user.id !== socket.id);
            users[roomID] = room;
            if (room.length === 0) {
                delete users[roomID];
                return;
            }
        }
        socket.broadcast.to(room).emit("user_exit", { id: socket.id });
        console.log("FROM SERVER::::"+users);
    });
});

server.listen(PORT,"192.168.0.2", () => {
    console.log(`server running on ${PORT}`, server.address());
});