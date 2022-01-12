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

const PORT = process.env.PORT || 7000;

let users = {};
let userCount = 1
let user_obj = {};
let socketToRoom = {};
const maximum = 2;

// 채팅메세지 시간 구하기
function getTime() {
    const now = new Date();
    const hours = now.getHours() < 10 ? "0" + now.getHours() : now.getHours();
    const minutes = now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes();
    const seconds = now.getSeconds() < 10 ? "0" + now.getSeconds() : now.getSeconds();    
    return `${hours}:${minutes}:${seconds}`;
}
io.on("connection", (socket) => {
    var name = "User_" + userCount++;  
    // Add user in the user_obj 
    user_obj[socket.id] =  name 
    io.to(socket.id).emit('default_name',name);
    socket.emit("default_name",name)
    io.sockets.emit( "notice", `${name} 입장하셨습니다.`);
    // update_list();

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
        console.log(`[${socketToRoom[socket.id]}]: ${socket.id} enter`);

        const usersInThisRoom = users[data.room].filter(
            (user) => user.id !== socket.id
        );

        console.log(usersInThisRoom);

        io.sockets.to(socket.id).emit("all_users", usersInThisRoom);
    });

    socket.on("offer", (sdp) => {
        console.log("offer: " + socket.id);
        socket.broadcast.emit("getOffer", sdp);
    });

    socket.on("answer", (sdp) => {
        console.log("answer: " + socket.id);
        socket.broadcast.emit("getAnswer", sdp);
    });

    socket.on("candidate", (candidate) => {
        console.log("candidate: " + socket.id);
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
        console.log(users);
    });

    const msgTime = getTime();

    socket.on( "sendMsg", ( msg ) =>{
        const data = { msg, msgTime};
        io.emit("newMsg", data)
    });


});

server.listen(PORT,"192.168.0.2",() => {
    console.log(`server running on ${PORT}`, server.address());
});